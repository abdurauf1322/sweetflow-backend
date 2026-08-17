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
  getAllUsers: catchAsync(async (req, res, next) => {
    try {
      const period = req.query.period || 'all';
      const { startDate, endDate } = getDateRange(period);

      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          createdAt: true,
          orders: {
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            },
            select: {
              id: true,
              totalAmount: true,
              debtAmount: true
            }
          }
        }
      });

      const usersWithStats = users.map(user => {
        const salesCount = user.orders?.length || 0;
        const salesAmount = user.orders?.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0) || 0;
        const debtAmount = user.orders?.reduce((sum, order) => sum + Number(order.debtAmount || 0), 0) || 0;
        const paidAmount = salesAmount - debtAmount;
        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          createdAt: user.createdAt,
          salesCount,
          salesAmount,
          paidAmount,
          debtAmount
        };
      });

      res.status(200).json({
        success: true,
        data: usersWithStats
      });
    } catch (error) {
      console.error("Xodimlarni yuklashda xatolik (Backend):", error);
      res.status(200).json({
        success: true,
        data: []
      });
    }
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
