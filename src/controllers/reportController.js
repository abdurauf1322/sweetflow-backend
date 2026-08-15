const reportService = require('../services/reportService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const reportController = {
  getSalesReport: catchAsync(async (req, res, next) => {
    const { period } = req.query;
    const report = await reportService.getSalesReport(period);

    res.status(200).json({
      status: 'success',
      data: {
        report,
      },
    });
  }),

  updateBalance: catchAsync(async (req, res, next) => {
    const { balance } = req.body;
    if (balance === undefined) {
      throw new AppError('Balance is required', 400);
    }

    const balanceService = require('../services/balanceService');
    const systemBalance = await balanceService.setBalance(Number(balance));

    res.status(200).json({
      status: 'success',
      data: {
        balance: Number(systemBalance.balance),
      },
    });
  }),
};

module.exports = reportController;
