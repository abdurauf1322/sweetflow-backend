const express = require('express');
const supplierController = require('../controllers/supplierController');

const router = express.Router();

router.get('/', supplierController.getAllSuppliers);
router.post('/', supplierController.createSupplier);
router.get('/debts', supplierController.getSupplierDebts);
router.post('/:id/pay', supplierController.paySupplierDebt);

module.exports = router;
