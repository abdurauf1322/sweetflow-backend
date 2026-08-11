const { z } = require('zod');

const createCategorySchema = z.object({
  name: z.string({
    required_error: 'Kategoriya nomi kiritilishi shart',
  }).trim().min(2, 'Kategoriya nomi kamida 2 ta belgidan iborat bo\'lishi kerak'),
  description: z.string().trim().optional(),
});

module.exports = {
  createCategorySchema,
};
