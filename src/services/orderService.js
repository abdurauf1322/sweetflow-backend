const prisma = require('../utils/prisma');
const storeRepository = require('../repositories/storeRepository');
const productRepository = require('../repositories/productRepository');
const orderRepository = require('../repositories/orderRepository');
const AppError = require('../utils/AppError');

const orderService = {
  async createOrder(orderInput) {
    try {
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

        // Calculate quantity in pieces (pieces) with fallbacks
        let piecesNeeded = Number(item.quantity || 0);
        let itemPrice = Number(product.unitPrice || 0);

        if (item.unitType === 'BOX') {
          piecesNeeded = Number(item.quantity || 0) * Number(product.quantityInBox || 1);
          itemPrice = Number(product.boxPrice || 0);
        }

        // Check stock defensively
        const availableStock = Number(product.stockCount || 0);
        if (availableStock < piecesNeeded) {
          throw new AppError(
            `Insufficient stock for product '${product.name}'. Requested: ${item.quantity} ${item.unitType}(s) [Total ${piecesNeeded} pieces], Available: ${availableStock} pieces`,
            400
          );
        }

        const itemTotalPrice = Number(item.quantity || 0) * itemPrice;
        orderTotalAmount += itemTotalPrice;

        processedItems.push({
          productId: product.id,
          name: product.name,
          quantity: item.quantity,
          unitType: item.unitType,
          price: itemPrice,
          totalPrice: itemTotalPrice,
          currentStock: availableStock,
          newStock: Math.max(0, availableStock - piecesNeeded),
        });
      }

      const debtAmount = Math.max(0, orderTotalAmount - paidAmount);

      // 3. Verify Credit Limit
      if (debtAmount > 0) {
        const currentDebt = Number(store.currentDebt || 0);
        const creditLimit = Number(store.creditLimit || 0);
        if (currentDebt + debtAmount > creditLimit) {
          throw new AppError(
            `Order failed: Store credit limit exceeded. Current Debt: ${currentDebt}, Credit Limit: ${creditLimit}, Requested Order Debt: ${debtAmount}`,
            400
          );
        }
      }

      // 4. Calculate Due Date defensively
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + Number(store.paymentDays || 0));

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
          const qtyToReduce = Math.max(0, item.currentStock - item.newStock);
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

        // d. Update system balance with the paid amount
        if (paidAmount > 0) {
          const balanceService = require('./balanceService');
          await balanceService.updateBalance(paidAmount, tx);
        }

        return newOrder;
      }, { maxWait: 10000, timeout: 15000 });

      // 6. Telegram Botga Chek yuborish (Xato bersa ham buyurtma bekor bo'lmasligi kerak)
      try {
        if (store && store.telegramChatId) {
          const telegramService = require('./telegramService');
          telegramService.sendOrderInvoice(store.telegramChatId, result, store)
            .catch(botErr => console.error("⚠️ Telegramga chek yuborishda xato (buyurtma saqlandi):", botErr.message));
        }
      } catch (botErr) {
        console.error("⚠️ Telegram xizmati chaqirilganda sinxron xatolik (buyurtma saqlandi):", botErr);
      }

      return result;
    } catch (error) {
      console.error("ORDER_CREATE_ERROR:", error);
      throw error;
    }
  },
};

module.exports = orderService;
