const { z } = require('zod');

const createExpenseSchema = z.object({
  amount: z.number({
    required_error: 'Amount is required',
  }).positive('Amount must be positive'),
  description: z.string({
    required_error: 'Description is required',
  }).trim().min(2, 'Description must be at least 2 characters'),
});

module.exports = {
  createExpenseSchema,
};
