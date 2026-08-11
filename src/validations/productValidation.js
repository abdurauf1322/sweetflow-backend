const { z } = require('zod');

const createProductSchema = z.object({
  name: z.string({
    required_error: 'Product name is required',
  }).trim().min(2, 'Product name must be at least 2 characters'),
  categoryId: z.string({
    required_error: 'Category ID is required',
  }).uuid('Invalid category ID format (must be UUID)'),
  unitPrice: z.number({
    required_error: 'Unit price is required',
  }).positive('Unit price must be positive'),
  boxPrice: z.number({
    required_error: 'Box price is required',
  }).positive('Box price must be positive'),
  quantityInBox: z.number({
    required_error: 'Quantity in box is required',
  }).int('Quantity in box must be an integer').positive('Quantity in box must be positive'),
  stockCount: z.number().int('Stock count must be an integer').nonnegative('Stock count cannot be negative').default(0),
  minStockLimit: z.number().int('Min stock limit must be an integer').nonnegative('Min stock limit cannot be negative').default(10),
  stock: z.number().int().nonnegative().optional(),
  boxes: z.number().int().nonnegative().optional(),
});

module.exports = {
  createProductSchema,
};
