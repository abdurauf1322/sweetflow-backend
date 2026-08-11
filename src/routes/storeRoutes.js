const express = require('express');
const storeController = require('../controllers/storeController');

const router = express.Router();

router.post('/', storeController.createStore);
router.get('/', storeController.getAllStores);
router.get('/overdue', storeController.getOverdueStores);
router.get('/:id/credit-status', storeController.getStoreCreditStatus);
router.get('/:id/orders', storeController.getStoreOrders);
router.delete('/:id', storeController.deleteStore);
router.put('/:id', storeController.updateStore);
router.post('/:id/payments', storeController.createStorePayment);
router.get('/:id/payments', storeController.getStorePayments);
router.post('/:id/send-reminder', storeController.sendReminder);

module.exports = router;
