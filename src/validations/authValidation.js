const { z } = require('zod');

const loginSchema = z.object({
  username: z.string({
    required_error: 'Username kiritilishi shart',
  }).trim().min(3, 'Username kamida 3 ta belgidan iborat bo\'lishi kerak'),
  password: z.string({
    required_error: 'Parol kiritilishi shart',
  }).min(4, 'Parol kamida 4 ta belgidan iborat bo\'lishi kerak'),
});

module.exports = {
  loginSchema,
};
