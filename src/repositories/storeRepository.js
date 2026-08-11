const prisma = require('../utils/prisma');

const getClient = (tx) => tx || prisma;

const storeRepository = {
  async create(data, tx) {
    const client = getClient(tx);
    return client.store.create({
      data,
    });
  },

  async findById(id, tx) {
    const client = getClient(tx);
    return client.store.findUnique({
      where: { id },
    });
  },

  async findByPhone(phone, tx) {
    const client = getClient(tx);
    return client.store.findUnique({
      where: { phone },
    });
  },

  async updateDebt(id, debtAmountChange, tx) {
    const client = getClient(tx);
    // increment currentDebt by debtAmountChange (can be positive or negative)
    return client.store.update({
      where: { id },
      data: {
        currentDebt: {
          increment: debtAmountChange,
        },
      },
    });
  },

  async findWithDebt() {
    return prisma.store.findMany({
      where: {
        isDeleted: false,
        currentDebt: {
          gt: 0,
        },
      },
      orderBy: {
        currentDebt: 'desc',
      },
    });
  },

  async findOverdueStores() {
    const now = new Date();
    return prisma.store.findMany({
      where: {
        isDeleted: false,
        supplyOrders: {
          some: {
            debtAmount: {
              gt: 0,
            },
            dueDate: {
              lt: now,
            },
          },
        },
      },
      include: {
        supplyOrders: {
          where: {
            debtAmount: {
              gt: 0,
            },
            dueDate: {
              lt: now,
            },
          },
          orderBy: {
            dueDate: 'asc',
          },
        },
      },
    });
  },
};

module.exports = storeRepository;
