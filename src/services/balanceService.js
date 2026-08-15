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
    let systemBalance = await client.systemBalance.findFirst();
    if (!systemBalance) {
      systemBalance = await client.systemBalance.create({ data: { balance: 0 } });
    }
    return client.systemBalance.update({
      where: { id: systemBalance.id },
      data: {
        balance: {
          increment: amount
        }
      }
    });
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
