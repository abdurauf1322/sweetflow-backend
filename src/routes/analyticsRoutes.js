const express = require('express');
const reportController = require('../controllers/reportController');
const { protect, checkRole } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', protect, checkRole(['boss', 'manager']), reportController.getSalesReport);

module.exports = router;
