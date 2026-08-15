const prisma = require('../utils/prisma');

const expenseService = {
  async createExpense(data) {
    const expense = await prisma.$transaction(async (tx) => {
      // 1. Create expense record
      const createdExpense = await tx.expense.create({
        data: {
          amount: data.amount,
          description: data.description,
        },
      });

      // 2. Deduct from system balance
      const balanceService = require('./balanceService');
      await balanceService.updateBalance(-data.amount, tx);

      return createdExpense;
    }, { maxWait: 10000, timeout: 15000 });

    // 3. Send Telegram bot alert
    try {
      const telegramService = require('./telegramService');
      const formattedAmount = Number(expense.amount).toLocaleString('uz-UZ');
      const message = `💸 <b>YANGI XARAJAT</b>\n\n` +
        `💰 <b>Miqdori:</b> ${formattedAmount} so'm\n` +
        `📝 <b>Tavsif:</b> ${expense.description}\n` +
        `📅 <b>Sana:</b> ${new Date(expense.createdAt).toLocaleString('uz-UZ')}\n\n` +
        `⚠️ <i>Kassa balansidan ayirildi.</i>`;
      await telegramService.sendAlert(message);
    } catch (err) {
      console.error('Failed to send Telegram alert for expense:', err.message);
    }

    return expense;
  },

  async getAllExpenses() {
    return prisma.expense.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  },
};

module.exports = expenseService;
