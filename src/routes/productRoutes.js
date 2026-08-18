const express = require('express');
const productController = require('../controllers/productController');

const router = express.Router();

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

router.post('/sync-stock', productController.syncStock);
router.post('/', upload.single('image'), productController.createProduct);
router.get('/', productController.getAllProducts);
router.get('/low-stock', productController.getLowStockProducts);
router.post('/purchases/:id/pay', productController.payPurchaseDebt);
router.delete('/:id', productController.deleteProduct);
router.put('/:id', upload.single('image'), productController.updateProduct);

module.exports = router;
