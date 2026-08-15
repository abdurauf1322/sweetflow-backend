const prisma = require('../utils/prisma');

const balanceService = {
  async getBalance() {
    let systemBalance = await prisma.systemBalance.findFirst();
    if (!systemBalance) {
      systemBalance = await prisma.systemBalance.create({ data: { balance: 0 } });
    }
    return systemBalance;
  },

  async updateBalance(amount, tx) {
    const client = tx || prisma;
    // Try to find existing balance first
    const existing = await client.systemBalance.findFirst();
    if (existing) {
      return client.systemBalance.update({
        where: { id: existing.id },
        data: {
          balance: {
            increment: amount
          }
        }
      });
    }
    // No balance record exists yet — create one with the amount
    return client.systemBalance.create({ data: { balance: amount } });
  },

  async setBalance(newBalance) {
    let systemBalance = await prisma.systemBalance.findFirst();
    if (!systemBalance) {
      systemBalance = await prisma.systemBalance.create({ data: { balance: newBalance } });
    } else {
      systemBalance = await prisma.systemBalance.update({
        where: { id: systemBalance.id },
        data: { balance: newBalance }
      });
    }
    return systemBalance;
  }
};

module.exports = balanceService;
