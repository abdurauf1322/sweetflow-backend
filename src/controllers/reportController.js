const reportService = require('../services/reportService');
const catchAsync = require('../utils/catchAsync');

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
};

module.exports = reportController;
