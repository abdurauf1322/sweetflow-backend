const express = require('express');
const { upload } = require('../config/multer');

const router = express.Router();

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'fail', message: 'Rasm yuklanmadi' });
  }

  // Local saqlanganda to'liq path qaytaramiz (yoki faqat filename ni)
  const imageUrl = `/uploads/${req.file.filename}`;

  res.status(200).json({
    status: 'success',
    data: {
      imageUrl
    }
  });
});

module.exports = router;
