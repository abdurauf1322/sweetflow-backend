const productService = require('../services/productService');
const { createProductSchema, updateProductSchema } = require('../validations/productValidation');
const catchAsync = require('../utils/catchAsync');

const productController = {
  createProduct: catchAsync(async (req, res, next) => {
    let data = { ...req.body };
    if (req.file) {
      data.imageUrl = `/uploads/${req.file.filename}`;
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
    await productService.deleteProduct(id);

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

    if (req.file) {
      validatedData.imageUrl = `/uploads/${req.file.filename}`;
    }

    // Pass granular counts to service for correct balance deduction
    validatedData._addedBoxes  = rawBoxes;
    validatedData._addedPieces = rawStock;
    delete validatedData.stock;
    delete validatedData.boxes;

    const product = await productService.updateProduct(id, validatedData);

    res.status(200).json({
      status: 'success',
      data: { product },
    });
  }),

};

module.exports = productController;
