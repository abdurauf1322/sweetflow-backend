const { z } = require('zod');

const createPaymentSchema = z.object({
  amount: z.number().positive("To'lov summasi musbat bo'lishi kerak"),
  paymentMethod: z.enum(['CASH', 'CARD'], {
    errorMap: () => ({ message: "To'lov usuli CASH yoki CARD bo'lishi kerak" }),
  }),
  note: z.string().optional().nullable(),
});

module.exports = { createPaymentSchema };
