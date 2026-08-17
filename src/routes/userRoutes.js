const express = require('express');
const userController = require('../controllers/userController');
const { protect, checkRole } = require('../middlewares/authMiddleware');

const router = express.Router();

// Parol o'zgartirish — barcha autentifikatsiya qilingan foydalanuvchilar uchun
router.put('/change-password', protect, userController.changePassword);

// Quyidagi route'lar faqat BOSS uchun
router.use(protect);
router.use(checkRole(['BOSS']));

// Xodimlar ro'yxatini olish va yangi yaratish
router.route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);

// Xodimning kunlik savdo tarixi
router.get('/:id/sales-history', userController.getSalesHistory);

// Xodimni tahrirlash va o'chirish
router.route('/:id')
  .put(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
