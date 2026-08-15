const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { loginSchema } = require('../validations/authValidation');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super-secret-key-123456', {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });
};

const authController = {
  login: catchAsync(async (req, res, next) => {
    // 1. Validate request body
    const validatedData = loginSchema.parse(req.body);
    const { username, password } = validatedData;

    // 2. Check if user exists
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new AppError('Foydalanuvchi nomi yoki parol noto\'g\'ri', 401);
    }

    // 3. Check password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      throw new AppError('Foydalanuvchi nomi yoki parol noto\'g\'ri', 401);
    }

    // 4. Generate token
    const token = signToken(user.id);

    // 5. Send response
    res.status(200).json({
      status: 'success',
      token,
      data: {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  }),
};

module.exports = authController;
