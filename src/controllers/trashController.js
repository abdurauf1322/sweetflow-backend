const prisma = require('../utils/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const trashController = {
  getTrashItems: catchAsync(async (req, res, next) => {
    // 1. O'chirilgan (isDeleted: true) barcha ma'lumotlarni yig'ish
    const [products, stores, categories] = await Promise.all([
      prisma.product.findMany({
        where: { isDeleted: true },
        select: { id: true, name: true, deletedAt: true, imageUrl: true }
      }),
      prisma.store.findMany({
        where: { isDeleted: true },
        select: { id: true, name: true, phone: true, deletedAt: true }
      }),
      prisma.category.findMany({
        where: { isDeleted: true },
        select: { id: true, name: true, deletedAt: true }
      })
    ]);

    // O'chirilganda qo'shilgan `_deleted_16...` qo'shimchasini olib tashlab ko'rsatish mumkin,
    // yoki to'g'ridan to'g'ri ko'rsatish mumkin. UI uchun tozalab beramiz:
    const cleanName = (name) => {
      if (name.includes('_deleted_')) {
        return name.split('_deleted_')[0];
      }
      return name;
    };

    const trashItems = [
      ...products.map(p => ({ type: 'product', ...p, name: cleanName(p.name) })),
      ...stores.map(s => ({ type: 'store', ...s, name: cleanName(s.name), phone: cleanName(s.phone) })),
      ...categories.map(c => ({ type: 'category', ...c, name: cleanName(c.name) }))
    ];

    // Eng oxirgi o'chirilganlar birinchi chiqishi uchun tartiblash
    trashItems.sort((a, b) => {
      const dateA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
      const dateB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
      return dateB - dateA;
    });

    res.status(200).json({
      status: 'success',
      results: trashItems.length,
      data: {
        items: trashItems
      }
    });
  }),

  restoreItem: catchAsync(async (req, res, next) => {
    const { type, id } = req.params;

    let model;
    switch (type) {
      case 'product': model = prisma.product; break;
      case 'store': model = prisma.store; break;
      case 'category': model = prisma.category; break;
      default:
        throw new AppError("Noto'g'ri tur (type) ko'rsatildi", 400);
    }

    const item = await model.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("Element topilmadi", 404);
    }

    // Nomni tiklash jarayoni
    const cleanName = item.name.includes('_deleted_') ? item.name.split('_deleted_')[0] : item.name;
    const updateData = {
      isDeleted: false,
      deletedAt: null,
      name: cleanName
    };

    if (type === 'store' && item.phone && item.phone.includes('_deleted_')) {
      updateData.phone = item.phone.split('_deleted_')[0];
    }

    // Tiklash vaqtida bir xil nomli yoki raqamli faol element bor-yo'qligini tekshirish
    try {
      await model.update({
        where: { id },
        data: updateData
      });
    } catch (err) {
      if (err.code === 'P2002') {
        throw new AppError("Ushbu nom yoki telefon raqami band bo'lgani uchun qayta tiklab bo'lmadi. Avval mavjudini o'zgartiring.", 400);
      }
      throw err;
    }

    res.status(200).json({
      status: 'success',
      message: "Muvaffaqiyatli tiklandi"
    });
  }),

  hardDeleteItem: catchAsync(async (req, res, next) => {
    const { type, id } = req.params;

    let model;
    switch (type) {
      case 'product': model = prisma.product; break;
      case 'store': model = prisma.store; break;
      case 'category': model = prisma.category; break;
      default:
        throw new AppError("Noto'g'ri tur (type) ko'rsatildi", 400);
    }

    try {
      await model.delete({ where: { id } });
    } catch (err) {
      if (err.code === 'P2025') {
         throw new AppError("Element topilmadi", 404);
      }
      if (err.code === 'P2003' || (err.message && err.message.includes('foreign key constraint'))) {
         throw new AppError("Ushbu ma'lumot boshqa yozuvlarga bog'langanligi sababli butunlay o'chirib bo'lmaydi.", 400);
      }
      throw err;
    }

    res.status(200).json({
      status: 'success',
      message: "Butunlay o'chirildi"
    });
  })
};

module.exports = trashController;
