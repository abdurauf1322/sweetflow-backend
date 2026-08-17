const storeRepository = require('../repositories/storeRepository');
const AppError = require('../utils/AppError');

const storeService = {
  async createStore(storeData) {
    const { initialDebt, ...data } = storeData;
    const existingStore = await storeRepository.findByPhone(data.phone);
    if (existingStore) {
      throw new AppError(`Store with phone number '${data.phone}' already exists`, 400);
    }
    
    const prisma = require('../utils/prisma');
    return prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          ...data,
          currentDebt: initialDebt || 0,
        }
      });
      
      if (initialDebt && initialDebt > 0) {
        await tx.paymentHistory.create({
          data: {
            storeId: store.id,
            amount: -initialDebt,
            paymentMethod: 'CASH',
            note: "Boshlang'ich qoldiq qarz"
          }
        });
      }
      
      return store;
    });
  },

  async getStoreById(id) {
    const store = await storeRepository.findById(id);
    if (!store) throw new AppError(`Store with ID ${id} not found`, 404);
    return store;
  },

  async getAllStores() {
    const prisma = require('../utils/prisma');
    const stores = await prisma.store.findMany({
      where: {
        isDeleted: false,
      },
      orderBy: {
        name: 'asc',
      },
      include: {
        supplyOrders: {
          where: {
            debtAmount: { gt: 0 },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            dueDate: true,
            createdAt: true,
          },
        },
      },
    });

    // Attach lastOrderDueDate and lastOrderCreatedAt to each store
    return stores.map(store => {
      const lastOrder = store.supplyOrders[0] || null;
      return {
        ...store,
        lastOrderDueDate: lastOrder?.dueDate || null,
        lastOrderCreatedAt: lastOrder?.createdAt || null,
        supplyOrders: undefined, // strip the nested array
      };
    });
  },

  async deleteStore(id) {
    const store = await storeRepository.findById(id);
    if (!store) {
      throw new AppError(`Store with ID ${id} not found`, 404);
    }

    // 1. Verify if store has outstanding debt
    if (Number(store.currentDebt) > 0) {
      throw new AppError(`Cannot delete store with unpaid debt of ${Number(store.currentDebt).toLocaleString()} so'm`, 400);
    }

    // 2. Verify if store has historical orders
    const prisma = require('../utils/prisma');
    const orderCount = await prisma.supplyOrder.count({
      where: { storeId: id },
    });

    if (orderCount > 0) {
      // Soft delete: flag isDeleted and rename phone to release unique index
      return prisma.store.update({
        where: { id },
        data: {
          isDeleted: true,
          phone: `${store.phone}_deleted_${Date.now()}`,
        },
      });
    } else {
      // Hard delete
      return prisma.store.delete({
        where: { id },
      });
    }
  },

  async getStoreCreditStatus(id) {
    const store = await storeRepository.findById(id);
    if (!store) {
      throw new AppError(`Store with ID ${id} not found`, 404);
    }

    const creditLimit = Number(store.creditLimit);
    const currentDebt = Number(store.currentDebt);
    const availableCredit = creditLimit - currentDebt;
    const percentUsed = creditLimit > 0 ? (currentDebt / creditLimit) * 100 : 0;

    return {
      storeId: store.id,
      storeName: store.name,
      creditLimit,
      currentDebt,
      availableCredit,
      percentUsed: parseFloat(percentUsed.toFixed(2)),
    };
  },

  async getOverdueStores() {
    const overdueStores = await storeRepository.findOverdueStores();
    const now = new Date();

    return overdueStores.map((store) => {
      let totalOverdueAmount = 0;
      let maxOverdueDays = 0;
      
      const orders = store.supplyOrders.map((order) => {
        const debt = Number(order.debtAmount);
        totalOverdueAmount += debt;
        
        const dueTime = new Date(order.dueDate).getTime();
        const diffTime = now.getTime() - dueTime;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > maxOverdueDays) {
          maxOverdueDays = diffDays;
        }

        return {
          orderId: order.id,
          totalAmount: Number(order.totalAmount),
          debtAmount: debt,
          dueDate: order.dueDate,
          overdueDays: diffDays,
        };
      });

      return {
        id: store.id,
        name: store.name,
        ownerName: store.ownerName,
        phone: store.phone,
        currentDebt: Number(store.currentDebt),
        totalOverdueAmount,
        maxOverdueDays,
        overdueOrders: orders,
      };
    });
  },

  async getStoreOrders(storeId) {
    const prisma = require('../utils/prisma');
    return prisma.supplyOrder.findMany({
      where: { storeId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, username: true, role: true }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async updateStore(id, storeData) {
    const { phone } = storeData;

    // 1. Verify store exists
    const store = await storeRepository.findById(id);
    if (!store) {
      throw new AppError(`Store with ID ${id} not found`, 404);
    }

    // 2. Verify phone number uniqueness if phone is changed
    if (phone !== store.phone) {
      const existingStore = await storeRepository.findByPhone(phone);
      if (existingStore) {
        throw new AppError(`Store with phone number '${phone}' already exists`, 400);
      }
    }

    // 3. Perform update
    const prisma = require('../utils/prisma');
    return prisma.store.update({
      where: { id },
      data: storeData,
    });
  },

  async createStorePayment(storeId, paymentData) {
    const prisma = require('../utils/prisma');
    const store = await storeRepository.findById(storeId);
    if (!store) {
      throw new AppError(`Store with ID ${storeId} not found`, 404);
    }

    const { amount, paymentMethod, note, discount = 0 } = paymentData;
    const currentDebt = Number(store.currentDebt);
    const totalDeduction = amount + discount;

    if (totalDeduction > currentDebt) {
      throw new AppError(`To'lov va chegirma summasi (${totalDeduction.toLocaleString()} so'm) joriy qarzdan (${currentDebt.toLocaleString()} so'm) ko'p bo'lishi mumkin emas`, 400);
    }

    // Perform transaction to save payment, decrease debt, and settle orders FIFO
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payment record for actual amount
      const payment = await tx.paymentHistory.create({
        data: {
          storeId,
          amount,
          paymentMethod,
          note,
        },
      });

      // 1b. Create Payment record for discount if > 0
      if (discount > 0) {
        await tx.paymentHistory.create({
          data: {
            storeId,
            amount: discount,
            paymentMethod: 'DISCOUNT',
            note: '🎁 Chegirma / Qarzdan kechish',
          },
        });
      }

      // 2. Decrement store debt
      await tx.store.update({
        where: { id: storeId },
        data: {
          currentDebt: {
            decrement: totalDeduction,
          },
        },
      });

      // 3. FIFO order debt settlement
      let remainingPayment = totalDeduction;
      const unpaidOrders = await tx.supplyOrder.findMany({
        where: {
          storeId,
          debtAmount: { gt: 0 },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      for (const order of unpaidOrders) {
        if (remainingPayment <= 0) break;

        const orderDebt = Number(order.debtAmount);
        if (remainingPayment >= orderDebt) {
          // Order fully paid
          await tx.supplyOrder.update({
            where: { id: order.id },
            data: {
              debtAmount: 0,
              status: 'PAID',
            },
          });
          remainingPayment -= orderDebt;
        } else {
          // Order partially paid
          await tx.supplyOrder.update({
            where: { id: order.id },
            data: {
              debtAmount: orderDebt - remainingPayment,
              status: 'PARTIALLY_PAID',
            },
          });
          remainingPayment = 0;
        }
      }

      // 4. Update system balance
      const balanceService = require('./balanceService');
      await balanceService.updateBalance(amount, tx);

      return payment;
    });

    // 5. Send Telegram Notification
    try {
      if (store.telegramChatId) {
        const telegramService = require('./telegramService');
        await telegramService.sendPaymentReceipt(store.telegramChatId, store.name, amount, discount, currentDebt - totalDeduction);
      }
    } catch (error) {
      console.error('Failed to send telegram payment receipt:', error.message);
    }

    return result;
  },

  async getStorePayments(storeId) {
    const prisma = require('../utils/prisma');
    return prisma.paymentHistory.findMany({
      where: { storeId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },
};

module.exports = storeService;
