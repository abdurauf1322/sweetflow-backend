const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const protect = catchAsync(async (req, res, next) => {
  // 1. Get token and check if it exists
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new AppError('Siz tizimga kirmagansiz. Iltimos, kirib qaytadan urining.', 401);
  }

  // 2. Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-123456');
  } catch (err) {
    throw new AppError('Yaroqsiz token. Iltimos, qaytadan tizimga kiring.', 401);
  }

  // 3. Check if user still exists
  const currentUser = await prisma.user.findUnique({
    where: { id: decoded.id },
  });

  if (!currentUser) {
    throw new AppError('Ushbu tokenga tegishli foydalanuvchi endi mavjud emas.', 401);
  }

  // Grant access to protected route
  req.user = currentUser;
  next();
});

const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Foydalanuvchi aniqlanmadi. Avtorizatsiyadan o\'ting.', 401));
    }
    const allowedRoles = roles.map(r => r.toUpperCase());
    const userRole = req.user.role ? req.user.role.toUpperCase() : '';
    
    if (!allowedRoles.includes(userRole)) {
      return next(
        new AppError('Sizda ushbu amalni bajarish uchun ruxsat yo\'q.', 403)
      );
    }
    next();
  };
};

module.exports = {
  protect,
  checkRole,
};
