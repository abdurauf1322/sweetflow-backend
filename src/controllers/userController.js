const prisma = require('../utils/prisma');
const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Helper: period -> { startDate, endDate }
function getDateRange(period) {
  let startDate = new Date();
  let endDate = new Date();

  if (period === 'today') {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (period === 'monthly') {
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (period === 'yearly') {
    startDate.setMonth(0, 1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  } else {
    // all
    startDate = new Date('2020-01-01T00:00:00.000Z');
    endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
}

const userController = {
  // Barcha xodimlarni olish (Faqat BOSS) — period filtri bilan
  getAllUsers: async (req, res, next) => {
    try {
      // 1. Foydalanuvchilarni olish
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // 2. Buyurtmalarni alohida xavfsiz tortish (Relation xatosi bo'lmasligi uchun)
      let orders = [];
      try {
        const period = req.query.period || 'all';
        let startDate = null;
        const now = new Date();

        if (period === 'today') {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        } else if (period === 'monthly') {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        } else if (period === 'yearly') {
          startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        } else if (period === 'yesterday') {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
        }

        orders = await prisma.supplyOrder.findMany({
          where: startDate ? { createdAt: { gte: startDate } } : {},
          select: {
            createdById: true,
            totalAmount: true,
            debtAmount: true,
            createdAt: true
          }
        });
      } catch (e) {
        console.warn('Orders table not loaded or empty:', e.message);
      }

      // 3. Xodimlar statistikasini birlashtirish
      const formatted = users.map(u => {
        const userOrders = orders.filter(o => o.createdById === u.id);
        const totalSales = userOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
        const totalDebt = userOrders.reduce((sum, o) => sum + Number(o.debtAmount || 0), 0);
        const totalPaid = totalSales - totalDebt; // Since paidAmount doesn't exist, calculate it

        return {
          id: u.id,
          name: u.name || u.username,
          username: u.username,
          role: u.role,
          createdAt: u.createdAt,
          salesCount: userOrders.length,
          totalSales,
          totalPaid,
          totalDebt,
          // Compatibility for existing frontend code
          salesAmount: totalSales,
          paidAmount: totalPaid,
          debtAmount: totalDebt
        };
      });

      return res.status(200).json({
        success: true,
        data: formatted
      });
    } catch (error) {
      console.error('CRITICAL GET USERS ERROR:', error);
      return res.status(200).json({
        success: true,
        data: [],
        error: error.message
      });
    }
  },

  // Barcha berilgan chegirmalar ro'yxati (POS va CRM orqali)
  getAllDiscounts: catchAsync(async (req, res, next) => {
    // POS (SupplyOrder) orqali berilgan chegirmalar
    const posDiscounts = await prisma.supplyOrder.findMany({
      where: {
        discountAmount: { gt: 0 }
      },
      select: {
        id: true,
        discountAmount: true,
        totalAmount: true, // "Jami" uchun. Biz subtotal ni ham ko'rsatishimiz mumkin.
        subtotal: true,
        createdAt: true,
        store: { select: { name: true } },
        createdBy: { select: { name: true, username: true, role: true } }
      }
    });

    // CRM (PaymentHistory) orqali qarzdan kechilganlar
    const crmDiscounts = await prisma.paymentHistory.findMany({
      where: {
        note: { contains: 'Chegirma' }
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        store: { select: { name: true, currentDebt: true } }
      }
    });

    // Birlashtirish va xaritalash
    const formattedDiscounts = [
      ...posDiscounts.map(d => ({
        id: `pos-${d.id}`,
        storeName: d.store?.name || "Noma'lum do'kon",
        amount: Number(d.discountAmount),
        giverName: d.createdBy?.name || "Noma'lum xodim",
        giverUsername: d.createdBy?.username || "",
        giverRole: d.createdBy?.role || "SELLER",
        date: d.createdAt,
        type: '🛒 Savdo (POS)',
        totalInfo: `Jami (chegirmasiz): ${Number(d.subtotal).toLocaleString()} so'm`
      })),
      ...crmDiscounts.map(d => ({
        id: `crm-${d.id}`,
        storeName: d.store?.name || "Noma'lum do'kon",
        amount: Number(d.amount),
        giverName: "Tizim",
        giverUsername: "admin",
        giverRole: "BOSS",
        date: d.createdAt,
        type: '💳 Qarz yopish (CRM)',
        totalInfo: `Joriy qarz: ${Number(d.store?.currentDebt || 0).toLocaleString()} so'm`
      }))
    ];

    // Sana bo'yicha eng yangilarini tepaga chiqarish
    formattedDiscounts.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      data: formattedDiscounts
    });
  }),

  // Xodimning kunlik savdo tarixi
  getSalesHistory: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const period = req.query.period || 'monthly';
    const { startDate, endDate } = getDateRange(period);

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, username: true } });
    if (!user) {
      return next(new AppError('Xodim topilmadi', 404));
    }

    const orders = await prisma.supplyOrder.findMany({
      where: {
        createdById: id,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        totalAmount: true,
        debtAmount: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Kunlar bo'yicha guruhlash
    const dailyMap = {};
    for (const order of orders) {
      const dateKey = new Date(order.createdAt).toISOString().split('T')[0];
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = {
          date: dateKey,
          ordersCount: 0,
          totalSales: 0,
          paidAmount: 0,
          debtAmount: 0
        };
      }
      dailyMap[dateKey].ordersCount += 1;
      dailyMap[dateKey].totalSales += Number(order.totalAmount || 0);
      dailyMap[dateKey].debtAmount += Number(order.debtAmount || 0);
      dailyMap[dateKey].paidAmount += (Number(order.totalAmount || 0) - Number(order.debtAmount || 0));
    }

    const dailyStats = Object.values(dailyMap).sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      data: {
        user,
        period,
        totalOrders: orders.length,
        totalSales: orders.reduce((s, o) => s + Number(o.totalAmount || 0), 0),
        dailyStats
      }
    });
  }),

  // Yangi xodim qo'shish (Faqat BOSS)
  createUser: catchAsync(async (req, res, next) => {
    const { name, username, password, role } = req.body;

    if (!name || !username || !password) {
      return next(new AppError('Ism, login va parol majburiy!', 400));
    }

    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return next(new AppError('Bu login (username) band, boshqasini tanlang', 400));
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        name,
        username,
        password: hashedPassword,
        role: role || 'SELLER'
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        createdAt: true
      }
    });

    res.status(201).json({
      success: true,
      data: newUser
    });
  }),

  // Xodim ma'lumotlarini yangilash
  updateUser: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name, username, password, role } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return next(new AppError('Xodim topilmadi', 404));
    }

    if (username && username !== user.username) {
      const existingUser = await prisma.user.findUnique({ where: { username } });
      if (existingUser) {
        return next(new AppError('Bu login band', 400));
      }
    }

    const updateData = { name, username, role };

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        username: true,
        role: true
      }
    });

    res.status(200).json({
      success: true,
      data: updatedUser
    });
  }),

  // Xodimni o'chirish
  deleteUser: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    if (id === req.user.id) {
      return next(new AppError('Siz o\'z hisobingizni o\'chira olmaysiz!', 400));
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return next(new AppError('Xodim topilmadi', 404));
    }

    await prisma.user.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: 'Xodim muvaffaqiyatli o\'chirildi'
    });
  }),

  // O'z parolini o'zgartirish (har qanday autentifikatsiya qilingan foydalanuvchi)
  changePassword: catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 4) {
      return next(new AppError('Yangi parol kamida 4 ta belgidan iborat bo\'lishi kerak', 400));
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return next(new AppError('Foydalanuvchi topilmadi', 404));
    }

    // Joriy parolni tekshirish (agar kiritilgan bo'lsa)
    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return next(new AppError('Joriy parol noto\'g\'ri', 400));
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.status(200).json({
      success: true,
      message: 'Parol muvaffaqiyatli yangilandi'
    });
  })
};

module.exports = userController;
