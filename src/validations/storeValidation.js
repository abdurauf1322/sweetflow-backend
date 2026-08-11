const { z } = require('zod');

const createStoreSchema = z.object({
  name: z.string({
    required_error: 'Store name is required',
  }).trim().min(2, 'Store name must be at least 2 characters'),
  ownerName: z.string({
    required_error: 'Owner name is required',
  }).trim().min(2, 'Owner name must be at least 2 characters'),
  phone: z.string({
    required_error: 'Phone number is required',
  }).trim().regex(/^\+998\d{9}$/, 'Phone number must match Uzbek format: +998XXXXXXXXX'),
  creditLimit: z.number({
    required_error: 'Credit limit is required',
  }).nonnegative('Credit limit cannot be negative'),
  paymentDays: z.number({
    required_error: 'Payment days is required',
  }).int('Payment days must be an integer').positive('Payment days must be positive'),
  telegramChatId: z.string().optional(),
});

module.exports = {
  createStoreSchema,
};
