const prisma = require('../utils/prisma');
const storeRepository = require('../repositories/storeRepository');
const productRepository = require('../repositories/productRepository');
const orderRepository = require('../repositories/orderRepository');
const AppError = require('../utils/AppError');

const orderService = {
  async createOrder(orderInput) {
    const { storeId, items } = orderInput;
    const paidAmount = Number(orderInput.paidAmount || 0);

    // 1. Fetch Store
    const store = await storeRepository.findById(storeId);
    if (!store) {
      throw new AppError(`Store with ID ${storeId} not found`, 404);
    }

    const processedItems = [];
    let orderTotalAmount = 0;

    // 2. Validate products and calculate prices/stock updates
    for (const item of items) {
      const product = await productRepository.findById(item.productId);
      if (!product) {
        throw new AppError(`Product with ID ${item.productId} not found`, 404);
      }

      // Calculate quantity in pieces (pieces)
      let piecesNeeded = item.quantity;
      let itemPrice = Number(product.unitPrice);

      if (item.unitType === 'BOX') {
        piecesNeeded = item.quantity * product.quantityInBox;
        itemPrice = Number(product.boxPrice);
      }

      // Check stock
      if (product.stockCount < piecesNeeded) {
        throw new AppError(
          `Insufficient stock for product '${product.name}'. Requested: ${item.quantity} ${item.unitType}(s) [Total ${piecesNeeded} pieces], Available: ${product.stockCount} pieces`,
          400
        );
      }

      const itemTotalPrice = item.quantity * itemPrice;
      orderTotalAmount += itemTotalPrice;

      processedItems.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitType: item.unitType,
        price: itemPrice,
        totalPrice: itemTotalPrice,
        currentStock: product.stockCount,
        newStock: product.stockCount - piecesNeeded,
      });
    }

    const debtAmount = Math.max(0, orderTotalAmount - paidAmount);

    // 3. Verify Credit Limit
    if (debtAmount > 0) {
      const currentDebt = Number(store.currentDebt);
      const creditLimit = Number(store.creditLimit);
      if (currentDebt + debtAmount > creditLimit) {
        throw new AppError(
          `Order failed: Store credit limit exceeded. Current Debt: ${currentDebt}, Credit Limit: ${creditLimit}, Requested Order Debt: ${debtAmount}`,
          400
        );
      }
    }

    // 4. Calculate Due Date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + store.paymentDays);

    // Determine status
    let status = 'PENDING';
    if (debtAmount === 0) {
      status = 'PAID';
    } else if (paidAmount > 0) {
      status = 'PARTIALLY_PAID';
    }

    // 5. Execute Transaction (Optimized atomic updates)
    const result = await prisma.$transaction(async (tx) => {
      // c. Save supply order first
      const newOrder = await tx.supplyOrder.create({
        data: {
          storeId,
          totalAmount: orderTotalAmount,
          debtAmount,
          dueDate,
          status,
          items: {
            create: processedItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitType: item.unitType,
              price: item.price,
              totalPrice: item.totalPrice,
            })),
          },
        },
        include: { items: { include: { product: true } }, store: true },
      });

      // a. Decrement stock counts atomically
      for (const item of processedItems) {
        const qtyToReduce = item.currentStock - item.newStock;
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockCount: {
              decrement: qtyToReduce
            }
          }
        });
      }

      // b. Increment store debt atomically
      if (debtAmount > 0) {
        await tx.store.update({
          where: { id: storeId },
          data: {
            currentDebt: {
              increment: debtAmount
            }
          }
        });
      }

      return newOrder;
    });

    // 6. Telegram Botga Chek yuborish (Xato bersa ham buyurtma bekor bo'lmasligi kerak)
    // Await ishlatilmaydi, fonda ishlaydi (7 soniyalik kechikishni yo'qotadi)
    if (store.telegramChatId) {
      const telegramService = require('./telegramService');
      telegramService.sendOrderInvoice(store.telegramChatId, result, store)
        .catch(botErr => console.error("⚠️ Telegramga chek yuborishda xato (buyurtma saqlandi):", botErr.message));
    }

    return result;
  },
};

module.exports = orderService;
