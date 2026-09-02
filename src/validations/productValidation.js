const { z } = require('zod');

const baseProductSchema = z.object({
  name: z.string({
    required_error: 'Product name is required',
  }).trim().min(2, 'Product name must be at least 2 characters'),
  categoryId: z.string({
    required_error: 'Category ID is required',
  }).uuid('Invalid category ID format (must be UUID)'),
  unitPrice: z.coerce.number({
    required_error: 'Unit price is required',
  }).positive('Unit price must be positive'),
  boxPrice: z.coerce.number({
    required_error: 'Box price is required',
  }).positive('Box price must be positive'),
  quantityInBox: z.coerce.number({
    required_error: 'Quantity in box is required',
  }).int('Quantity in box must be an integer').positive('Quantity in box must be positive'),
  costPrice: z.coerce.number().nonnegative('Cost price cannot be negative').optional(),
  boxCostPrice: z.coerce.number().nonnegative('Box cost price cannot be negative').optional(),
  stockCount: z.coerce.number().int('Stock count must be an integer').nonnegative('Stock count cannot be negative').optional(),
  minStockLimit: z.coerce.number().int('Min stock limit must be an integer').nonnegative('Min stock limit cannot be negative').optional(),
  stock: z.coerce.number().int().nonnegative().optional(),
  boxes: z.coerce.number().int().nonnegative().optional(),
  imageUrl: z.string().optional().or(z.literal('')),
  paymentType: z.enum(['CASH', 'DEBT']).optional(),
  supplierName: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  paidAmount: z.coerce.number().nonnegative().optional(),
});

const createProductSchema = baseProductSchema.extend({
  costPrice: z.coerce.number().nonnegative('Cost price cannot be negative').optional().default(0),
  boxCostPrice: z.coerce.number().nonnegative('Box cost price cannot be negative').optional().default(0),
  stockCount: z.coerce.number().int('Stock count must be an integer').nonnegative('Stock count cannot be negative').default(0),
  minStockLimit: z.coerce.number().int('Min stock limit must be an integer').nonnegative('Min stock limit cannot be negative').default(10),
});

const updateProductSchema = baseProductSchema.partial();

module.exports = {
  createProductSchema,
  updateProductSchema,
};
