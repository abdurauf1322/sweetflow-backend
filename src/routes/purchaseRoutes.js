const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const catchAsync = require('../utils/catchAsync');

router.get('/', catchAsync(async (req, res, next) => {
  const { period } = req.query;
  
  let where = {};
  
  if (period) {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    } else if (period === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    } else if (period === 'weekly') {
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    } else if (period === 'monthly') {
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    }
  }

  const purchases = await prisma.purchaseHistory.findMany({
    where,
    include: {
      product: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.status(200).json({
    status: 'success',
    data: {
      purchases,
    },
  });
}));

module.exports = router;
