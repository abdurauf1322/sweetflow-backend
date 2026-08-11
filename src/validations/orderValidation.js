const { z } = require('zod');

const orderItemSchema = z.object({
  productId: z.string({
    required_error: 'Product ID is required',
  }).uuid('Invalid product ID format (must be UUID)'),
  quantity: z.number({
    required_error: 'Quantity is required',
  }).int('Quantity must be an integer').positive('Quantity must be positive'),
  unitType: z.enum(['PIECE', 'BOX'], {
    errorMap: () => ({ message: "Unit type must be either 'PIECE' or 'BOX'" }),
  }),
});

const createOrderSchema = z.object({
  storeId: z.string({
    required_error: 'Store ID is required',
  }).uuid('Invalid store ID format (must be UUID)'),
  paidAmount: z.number().nonnegative('Paid amount cannot be negative').default(0),
  items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
});

module.exports = {
  createOrderSchema,
};
