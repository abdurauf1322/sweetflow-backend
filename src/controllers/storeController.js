const storeService = require('../services/storeService');
const { createStoreSchema } = require('../validations/storeValidation');
const { createPaymentSchema } = require('../validations/paymentValidation');
const catchAsync = require('../utils/catchAsync');

const storeController = {
  createStore: catchAsync(async (req, res, next) => {
    // 1. Validate request body
    const validatedData = createStoreSchema.parse(req.body);

    // 2. Call service
    const store = await storeService.createStore(validatedData);

    // 3. Send response
    res.status(201).json({
      status: 'success',
      data: {
        store,
      },
    });
  }),

  getAllStores: catchAsync(async (req, res, next) => {
    const stores = await storeService.getAllStores();

    res.status(200).json({
      status: 'success',
      results: stores.length,
      data: {
        stores,
      },
    });
  }),

  getStoreCreditStatus: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const creditStatus = await storeService.getStoreCreditStatus(id);

    res.status(200).json({
      status: 'success',
      data: creditStatus,
    });
  }),

  getOverdueStores: catchAsync(async (req, res, next) => {
    const overdueStores = await storeService.getOverdueStores();

    res.status(200).json({
      status: 'success',
      results: overdueStores.length,
      data: {
        stores: overdueStores,
      },
    });
  }),

  getStoreOrders: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const orders = await storeService.getStoreOrders(id);

    res.status(200).json({
      status: 'success',
      results: orders.length,
      data: {
        orders,
      },
    });
  }),

  deleteStore: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    await storeService.deleteStore(id);

    res.status(200).json({
      status: 'success',
      message: 'Store deleted successfully',
    });
  }),

  updateStore: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name, ownerName, phone, telegramChatId, creditLimit, paymentDays, discountPercent, currentDebt } = req.body;

    const prisma = require('../utils/prisma');

    // 1. Check store exists
    const existingStore = await prisma.store.findUnique({ where: { id } });
    if (!existingStore) {
      return res.status(404).json({ status: 'fail', message: 'Store not found' });
    }

    // 2. Check phone uniqueness (only if changed)
    if (phone !== existingStore.phone) {
      const phoneExists = await prisma.store.findFirst({ where: { phone } });
      if (phoneExists) {
        return res.status(400).json({ status: 'fail', message: `Store with phone number '${phone}' already exists` });
      }
    }

    // 3. Save changes
    const updateData = {
      name,
      ownerName,
      phone,
      telegramChatId: telegramChatId ? String(telegramChatId).trim() : null,
      creditLimit: Number(creditLimit),
      paymentDays: Number(paymentDays),
    };

    if (discountPercent !== undefined) {
      updateData.discountPercent = Number(discountPercent);
    }
    
    if (currentDebt !== undefined) {
      updateData.currentDebt = Number(currentDebt);
    }

    const updatedStore = await prisma.store.update({
      where: { id },
      data: updateData,
    });

    // 4. Fetch latest unpaid order dates so frontend can compute remaining days correctly
    const latestOrder = await prisma.supplyOrder.findFirst({
      where: { storeId: id, debtAmount: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      select: { dueDate: true, createdAt: true },
    });

    res.status(200).json({
      status: 'success',
      data: {
        store: {
          ...updatedStore,
          lastOrderDueDate: latestOrder?.dueDate || null,
          lastOrderCreatedAt: latestOrder?.createdAt || null,
        },
      },
    });
  }),

  createStorePayment: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const validatedData = createPaymentSchema.parse(req.body);
    const payment = await storeService.createStorePayment(id, validatedData);

    res.status(201).json({
      status: 'success',
      data: {
        payment,
      },
    });
  }),

  getStorePayments: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const payments = await storeService.getStorePayments(id);

    res.status(200).json({
      status: 'success',
      results: payments.length,
      data: {
        payments,
      },
    });
  }),

  sendReminder: async (req, res) => {
    try {
      const { id } = req.params;
      console.log("🚀 Send Reminder so'rovi keldi. Store ID:", id);

      const prisma = require('../utils/prisma');

      // 1. Do'konni va oxirgi to'lanmagan buyurtmasini topish
      const store = await prisma.store.findUnique({
        where: { id },
        include: {
          supplyOrders: {
            where: { debtAmount: { gt: 0 } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { dueDate: true, createdAt: true },
          },
        },
      });

      if (!store) {
        console.log("❌ Do'kon bazadan topilmadi!");
        return res.status(404).json({ success: false, message: "Do'kon topilmadi!" });
      }

      console.log("📦 Topilgan do'kon:", { name: store.name, telegramChatId: store.telegramChatId });



      // 2. Qolgan kunlarni hisoblash
      const telegramService = require('../services/telegramService');
      const latestOrder = store.supplyOrders[0] || null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let remainingDays;
      if (latestOrder?.dueDate) {
        const due = new Date(latestOrder.dueDate);
        due.setHours(0, 0, 0, 0);
        remainingDays = Math.round((due - today) / (1000 * 60 * 60 * 24));
      } else {
        const ref = latestOrder?.createdAt
          ? new Date(latestOrder.createdAt)
          : new Date(store.updatedAt || store.createdAt);
        ref.setHours(0, 0, 0, 0);
        const passed = Math.round((today - ref) / (1000 * 60 * 60 * 24));
        remainingDays = (store.paymentDays || 30) - passed;
      }

      const debtAmount = Number(store.currentDebt || 0);

      // 3. Telegram ulanishini tekshirish
      if (!store.telegramChatId) {
        return res.status(400).json({
          success: false,
          message: "Ushbu do'kon Telegram botga ulanmagan. Eslatma yuborish uchun do'kon egasi botga telefon raqamini yuborishi kerak."
        });
      }

      // 4. Telegram orqali xabar yuborish
      await telegramService.sendDebtReminder(
        store.telegramChatId,
        store.name,
        debtAmount,
        remainingDays
      );

      console.log("✅ Reminder muvaffaqiyatli yakunlandi!");
      return res.status(200).json({
        success: true,
        message: `${store.name} do'koniga Telegram xabarnoma yuborildi!`,
      });

    } catch (error) {
      console.error("💥 SEND REMINDER ICHKI BACKEND XATOSI:", error);
      return res.status(500).json({
        success: false,
        message: `Backend Xatosi: ${error.message || "Noma'lum xatolik"}`,
      });
    }
  },
};

module.exports = storeController;
