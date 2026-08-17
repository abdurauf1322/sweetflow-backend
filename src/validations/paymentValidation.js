const { z } = require('zod');

const createPaymentSchema = z.object({
  amount: z.number().nonnegative("To'lov summasi musbat yoki 0 bo'lishi kerak"),
  discount: z.number().nonnegative("Chegirma summasi manfiy bo'lishi mumkin emas").optional().default(0),
  paymentMethod: z.enum(['CASH', 'CARD', 'DISCOUNT'], {
    errorMap: () => ({ message: "To'lov usuli noto'g'ri" }),
  }),
  note: z.string().optional().nullable(),
});

module.exports = { createPaymentSchema };
