const productService = require('../services/productService');
const { createProductSchema, updateProductSchema } = require('../validations/productValidation');
const catchAsync = require('../utils/catchAsync');
const prisma = require('../utils/prisma');
const fs = require('fs');
const path = require('path');

const removeOldImage = (imageUrl) => {
  if (!imageUrl) return;
  try {
    const filename = imageUrl.split('/').pop();
    const filePath = path.join(process.cwd(), 'uploads', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('Eski rasmni diskdan ochirishda xatolik:', err.message);
  }
};

const productController = {
  createProduct: catchAsync(async (req, res, next) => {
    let data = { ...req.body };
    if (req.file) {
      data.imageUrl = req.file.filename;
    }
    const rawBoxes = Number(data.boxes || 0);
    const rawStock = Number(data.stock  || 0);
    if (rawBoxes > 0 || rawStock > 0) {
      const boxQuantity = Number(data.quantityInBox || 1);
      data.stockCount = rawStock + (rawBoxes * boxQuantity);
    }
    // Keep raw values for cost calculations in service
    data._addedBoxes  = rawBoxes;
    data._addedPieces = rawStock;

    // 1. Validate request body
    const validatedData = createProductSchema.parse(data);
    // Restore meta fields (not in zod schema so they pass through if we set them manually)
    validatedData._addedBoxes  = rawBoxes;
    validatedData._addedPieces = rawStock;
    validatedData._paymentType = data.paymentType;
    validatedData._supplierName = data.supplierName;
    validatedData._paidAmount = data.paidAmount;
    delete validatedData.stock;
    delete validatedData.boxes;

    // 2. Call service
    const product = await productService.createProduct(validatedData);

    // 3. Send response
    res.status(201).json({
      status: 'success',
      data: { product },
    });
  }),


  getAllProducts: catchAsync(async (req, res, next) => {
    const products = await productService.getAllProducts();

    res.status(200).json({
      status: 'success',
      results: products.length,
      data: {
        products,
      },
    });
  }),


  getLowStockProducts: catchAsync(async (req, res, next) => {
    const products = await productService.getLowStockProducts();

    res.status(200).json({
      status: 'success',
      results: products.length,
      data: {
        products,
      },
    });
  }),

  deleteProduct: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const oldProduct = await prisma.product.findUnique({ where: { id } });
    await productService.deleteProduct(id);
    if (oldProduct && oldProduct.imageUrl) {
      removeOldImage(oldProduct.imageUrl);
    }

    res.status(200).json({
      status: 'success',
      message: 'Product deleted successfully',
    });
  }),

  updateProduct: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const rawBoxes = Number(req.body.boxes || 0);
    const rawStock = Number(req.body.stock  || 0);

    const validatedData = updateProductSchema.parse(req.body);

    const oldProduct = await prisma.product.findUnique({ where: { id } });

    if (req.file) {
      validatedData.imageUrl = req.file.filename;
      if (oldProduct && oldProduct.imageUrl) {
        removeOldImage(oldProduct.imageUrl);
      }
    } else if (req.body.removeImage === 'true' || req.body.removeImage === true) {
      validatedData.imageUrl = null;
      if (oldProduct && oldProduct.imageUrl) {
        removeOldImage(oldProduct.imageUrl);
      }
    }

    // Pass granular counts to service for correct balance deduction
    validatedData._addedBoxes  = rawBoxes;
    validatedData._addedPieces = rawStock;
    validatedData._paymentType = req.body.paymentType;
    validatedData._supplierName = req.body.supplierName;
    validatedData._paidAmount = req.body.paidAmount;
    delete validatedData.stock;
    delete validatedData.boxes;

    const product = await productService.updateProduct(id, validatedData);

    res.status(200).json({
      status: 'success',
      data: { product },
    });
  }),

  payPurchaseDebt: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) {
      return next(new AppError('Payment amount must be greater than 0', 400));
    }
    const purchase = await productService.payPurchaseDebt(id, Number(amount));
    res.status(200).json({
      status: 'success',
      data: { purchase },
    });
  }),

};

module.exports = productController;
