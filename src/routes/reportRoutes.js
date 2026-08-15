const express = require('express');
const reportController = require('../controllers/reportController');
const { protect, checkRole } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/sales', reportController.getSalesReport);
router.put('/balance', protect, checkRole(['boss']), reportController.updateBalance);

module.exports = router;
