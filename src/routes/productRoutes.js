const express = require('express');
const productController = require('../controllers/productController');
const { upload } = require('../config/multer');

const router = express.Router();

router.post('/sync-stock', productController.syncStock);
router.post('/', upload.single('image'), productController.createProduct);
router.get('/', productController.getAllProducts);
router.get('/history', productController.getPurchaseHistory);
router.get('/low-stock', productController.getLowStockProducts);
router.post('/purchases/:id/pay', productController.payPurchaseDebt);
router.delete('/:id', productController.deleteProduct);
router.put('/:id', upload.single('image'), productController.updateProduct);

module.exports = router;
