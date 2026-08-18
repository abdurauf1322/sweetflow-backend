const productRepository = require('../repositories/productRepository');
const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');

const productService = {
  async createProduct(productData) {
    const { categoryId, name } = productData;

    // 1. Verify if category exists
    const categoryExists = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!categoryExists) {
      throw new AppError(`Category with ID ${categoryId} does not exist`, 400);
    }

    // 2. Check if product with this name already exists
    const existingProduct = await productRepository.findByName(name);
    if (existingProduct) {
      throw new AppError(`Product with name '${name}' already exists`, 400);
    }

    return prisma.$transaction(async (tx) => {
      const product = await productRepository.create(productData, tx);

      // Deduct cost: boxes × boxCostPrice + pieces × costPrice
      const initBoxes  = Number(productData._addedBoxes  || 0);
      const initPieces = Number(productData._addedPieces || 0);
      const pieceCost  = Number(product.costPrice    || 0);
      const boxCost    = Number(product.boxCostPrice || 0);
      const totalCost  = (initBoxes * boxCost) + (initPieces * pieceCost);

      if (totalCost > 0) {
        const paymentType = productData._paymentType || 'CASH';
        const supplierName = productData._supplierName || null;
        const paidAmount = productData._paidAmount !== undefined ? Number(productData._paidAmount) : (paymentType === 'CASH' ? totalCost : 0);

        if (paidAmount > 0) {
          const balanceService = require('./balanceService');
          await balanceService.updateBalance(-paidAmount, tx);
        }

        await tx.purchaseHistory.create({
          data: {
            productId: product.id,
            addedBoxes: initBoxes,
            addedPieces: initPieces,
            boxCostPrice: boxCost,
            pieceCostPrice: pieceCost,
            totalCost: totalCost,
            paidAmount: paidAmount,
            paymentType: paymentType,
            supplierName: supplierName,
            debtAmount: paymentType === 'DEBT' ? totalCost - paidAmount : 0,
            isPaid: paymentType === 'DEBT' ? (totalCost - paidAmount <= 0) : true
          }
        });
      }
      return product;
    }, { maxWait: 10000, timeout: 15000 });
  },

  async getAllProducts() {
    return prisma.product.findMany({
      where: {
        isDeleted: false,
      },
      include: {
        category: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  },

  async deleteProduct(id) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new AppError(`Product with ID ${id} not found`, 404);
    }

    // 1. Check if product has historical order items or purchase history
    const orderItemCount = await prisma.supplyOrderItem.count({
      where: { productId: id },
    });

    const purchaseHistoryCount = await prisma.purchaseHistory.count({
      where: { productId: id },
    });

    if (orderItemCount > 0 || purchaseHistoryCount > 0) {
      // Soft delete: flag and rename name to release unique index
      return prisma.product.update({
        where: { id },
        data: {
          isDeleted: true,
          name: `${product.name}_deleted_${Date.now()}`,
        },
      });
    } else {
      // Hard delete
      return prisma.product.delete({
        where: { id },
      });
    }
  },

  async updateProduct(id, productData) {
    const { categoryId, name } = productData;

    // 1. Verify category exists
    const categoryExists = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!categoryExists) {
      throw new AppError(`Category with ID ${categoryId} does not exist`, 400);
    }

    return prisma.$transaction(async (tx) => {
      // 2. Verify product exists
      const product = await productRepository.findById(id, tx);
      if (!product) {
        throw new AppError(`Product with ID ${id} not found`, 404);
      }

      // 3. Verify name uniqueness if name is changed
      if (name !== product.name) {
        const existingProduct = await productRepository.findByName(name, tx);
        if (existingProduct) {
          throw new AppError(`Product with name '${name}' already exists`, 400);
        }
      }

      const oldStock   = Number(product.stockCount || 0);
      const pieceCost  = Number(productData.costPrice    !== undefined ? productData.costPrice    : product.costPrice);
      const boxCost    = Number(productData.boxCostPrice !== undefined ? productData.boxCostPrice : product.boxCostPrice);
      const qtyInBox   = Number(productData.quantityInBox !== undefined ? productData.quantityInBox : product.quantityInBox) || 1;

      // Added boxes and pieces from the incoming form values
      const addedBoxes  = Number(productData._addedBoxes  || 0);
      const addedPieces = Number(productData._addedPieces || 0);

      const newStock = oldStock + addedPieces + (addedBoxes * qtyInBox);

      // 4. Perform update — only pass fields that Prisma knows about
      const cleanData = {
        name:          productData.name,
        categoryId:    productData.categoryId,
        unitPrice:     productData.unitPrice,
        boxPrice:      productData.boxPrice,
        costPrice:     productData.costPrice,
        boxCostPrice:  productData.boxCostPrice,
        quantityInBox: productData.quantityInBox,
        stockCount:    newStock,
        minStockLimit: productData.minStockLimit,
        imageUrl:      productData.imageUrl !== undefined ? productData.imageUrl : product.imageUrl,
      };
      // Drop any undefined entries so Prisma doesn't try to set them to null
      Object.keys(cleanData).forEach(k => cleanData[k] === undefined && delete cleanData[k]);

      const updatedProduct = await tx.product.update({
        where: { id },
        data: cleanData,
        include: { category: true },
      });

      // 5. Deduct cost from balance only when new goods are explicitly added
      // _addedBoxes / _addedPieces are set by the controller from form input
      if (addedBoxes > 0 || addedPieces > 0) {
        const totalCost = (addedBoxes * boxCost) + (addedPieces * pieceCost);
        if (totalCost > 0) {
          const paymentType = productData._paymentType || 'CASH';
          const supplierName = productData._supplierName || null;
          const paidAmount = productData._paidAmount !== undefined ? Number(productData._paidAmount) : (paymentType === 'CASH' ? totalCost : 0);

          if (paidAmount > 0) {
            const balanceService = require('./balanceService');
            await balanceService.updateBalance(-paidAmount, tx);
          }

          await tx.purchaseHistory.create({
            data: {
              productId: product.id,
              addedBoxes: addedBoxes,
              addedPieces: addedPieces,
              boxCostPrice: boxCost,
              pieceCostPrice: pieceCost,
              totalCost: totalCost,
              paidAmount: paidAmount,
              paymentType: paymentType,
              supplierName: supplierName,
              debtAmount: paymentType === 'DEBT' ? totalCost - paidAmount : 0,
              isPaid: paymentType === 'DEBT' ? (totalCost - paidAmount <= 0) : true
            }
          });
        }
      }

      return updatedProduct;
    }, { maxWait: 10000, timeout: 15000 });
  },

  async getLowStockProducts() {
    return productRepository.findLowStock();
  },

  async payPurchaseDebt(purchaseId, amount) {
    return prisma.$transaction(async (tx) => {
      const purchase = await tx.purchaseHistory.findUnique({ where: { id: purchaseId } });
      if (!purchase) throw new AppError('Xarid topilmadi', 404);
      if (purchase.paymentType !== 'DEBT') throw new AppError('Naqd xarid uchun qarz to\'lab bo\'lmaydi', 400);
      
      const newPaidAmount = Number(purchase.paidAmount) + amount;
      if (newPaidAmount > Number(purchase.totalCost)) throw new AppError('Kiritilgan summa qoldiq qarzdan ko\'p bo\'lishi mumkin emas', 400);

      const newDebtAmount = Number(purchase.totalCost) - newPaidAmount;
      const isPaid = newDebtAmount <= 0;

      const balanceService = require('./balanceService');
      await balanceService.updateBalance(-amount, tx);

      const updatedPurchase = await tx.purchaseHistory.update({
        where: { id: purchaseId },
        data: { 
          paidAmount: newPaidAmount,
          debtAmount: newDebtAmount,
          isPaid: isPaid
        }
      });

      // Send Telegram bot alert
      try {
        const telegramService = require('./telegramService');
        const formattedAmount = Number(amount).toLocaleString('uz-UZ');
        const supplierName = purchase.supplierName || 'Noma\'lum';
        const message = `💸 <b>TA'MINOTCHIGA QARZ TO'LANDI</b>\n\n` +
          `👤 <b>Ta'minotchi:</b> ${supplierName}\n` +
          `💰 <b>To'landi:</b> ${formattedAmount} so'm\n` +
          `⚠️ <i>Kassa balansidan ayirildi.</i>`;
        await telegramService.sendAlert(message);
      } catch (err) {
        console.error('Failed to send Telegram alert for purchase debt payment:', err.message);
      }

      return updatedPurchase;
    }, { maxWait: 10000, timeout: 15000 });
  },

  async syncExistingStock() {
    return prisma.$transaction(async (tx) => {
      // Find all active products
      const products = await tx.product.findMany({
        where: { isDeleted: false },
        include: { purchaseHistory: true }
      });

      let totalSyncedCost = 0;
      let syncedProductsCount = 0;

      for (const product of products) {
        // If it already has a purchase history, skip it
        if (product.purchaseHistory && product.purchaseHistory.length > 0) {
          continue;
        }

        const stockCount = Number(product.stockCount || 0);
        if (stockCount <= 0) continue;

        const qtyInBox = Number(product.quantityInBox || 1);
        const boxes = Math.floor(stockCount / qtyInBox);
        const pieces = stockCount % qtyInBox;

        const boxCostPrice = Number(product.boxCostPrice || 0);
        const pieceCostPrice = Number(product.costPrice || 0);
        
        const totalCost = (boxes * boxCostPrice) + (pieces * pieceCostPrice);

        if (totalCost > 0) {
          await tx.purchaseHistory.create({
            data: {
              productId: product.id,
              addedBoxes: boxes,
              addedPieces: pieces,
              boxCostPrice: boxCostPrice,
              pieceCostPrice: pieceCostPrice,
              totalCost: totalCost,
              paidAmount: totalCost, // Paid in cash
              debtAmount: 0,
              isPaid: true,
              paymentType: 'CASH',
              supplierName: 'System Sync (Existing Stock)'
            }
          });

          totalSyncedCost += totalCost;
          syncedProductsCount++;
        }
      }

      if (totalSyncedCost > 0) {
        const balanceService = require('./balanceService');
        await balanceService.updateBalance(-totalSyncedCost, tx);
      }

      return {
        syncedProductsCount,
        totalSyncedCost
      };
    }, { maxWait: 30000, timeout: 60000 }); // give it a longer timeout in case of many products
  },
};

module.exports = productService;
