const productService = require('../services/productService');
const { createProductSchema } = require('../validations/productValidation');
const catchAsync = require('../utils/catchAsync');

const productController = {
  createProduct: catchAsync(async (req, res, next) => {
    let data = req.body;
    if (data.stock !== undefined || data.boxes !== undefined) {
      const stock = data.stock || 0;
      const boxes = data.boxes || 0;
      const boxQuantity = data.quantityInBox || 1;
      
      data.stockCount = stock + (boxes * boxQuantity);
    }
    
    // 1. Validate request body
    const validatedData = createProductSchema.parse(data);
    delete validatedData.stock;
    delete validatedData.boxes;

    // 2. Call service
    const product = await productService.createProduct(validatedData);

    // 3. Send response
    res.status(201).json({
      status: 'success',
      data: {
        product,
      },
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
    const validatedData = createProductSchema.parse(req.body);

    if (validatedData.stock !== undefined || validatedData.boxes !== undefined) {
      const stock = validatedData.stock || 0;
      const boxes = validatedData.boxes || 0;
      const boxQuantity = validatedData.quantityInBox || 1;
      
      const totalStock = stock + (boxes * boxQuantity);
      validatedData.stockCount = totalStock;
    }
    
    delete validatedData.stock;
    delete validatedData.boxes;
    
    const product = await productService.updateProduct(id, validatedData);

    res.status(200).json({
      status: 'success',
      data: {
        product,
      },
    });
  }),
};

module.exports = productController;
