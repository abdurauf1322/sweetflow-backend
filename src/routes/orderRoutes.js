const express = require('express');
const orderController = require('../controllers/orderController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', orderController.createOrder);

module.exports = router;
