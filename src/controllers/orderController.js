const orderService = require('../services/orderService');
const { createOrderSchema } = require('../validations/orderValidation');
const catchAsync = require('../utils/catchAsync');

const orderController = {
  createOrder: catchAsync(async (req, res, next) => {
    // 1. Validate request body
    const validatedData = createOrderSchema.parse(req.body);

    // 2. Call service (Handles transactional stock deductions & debt logic)
    const order = await orderService.createOrder(validatedData);

    // 3. Send response
    res.status(201).json({
      status: 'success',
      data: {
        order,
      },
    });
  }),
};

module.exports = orderController;
