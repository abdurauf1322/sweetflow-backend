const expenseService = require('../services/expenseService');
const { createExpenseSchema } = require('../validations/expenseValidation');
const catchAsync = require('../utils/catchAsync');

const expenseController = {
  createExpense: catchAsync(async (req, res, next) => {
    const validatedData = createExpenseSchema.parse(req.body);

    const expense = await expenseService.createExpense(validatedData);

    res.status(201).json({
      status: 'success',
      data: {
        expense,
      },
    });
  }),

  getAllExpenses: catchAsync(async (req, res, next) => {
    const expenses = await expenseService.getAllExpenses();

    res.status(200).json({
      status: 'success',
      results: expenses.length,
      data: {
        expenses,
      },
    });
  }),
};

module.exports = expenseController;
