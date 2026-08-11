const prisma = require('../utils/prisma');

const getClient = (tx) => tx || prisma;

const orderRepository = {
  async create(orderData, tx) {
    const client = getClient(tx);
    
    const { storeId, totalAmount, debtAmount, dueDate, status, items } = orderData;
    
    return client.supplyOrder.create({
      data: {
        storeId,
        totalAmount,
        debtAmount,
        dueDate,
        status,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitType: item.unitType,
            price: item.price,
            totalPrice: item.totalPrice,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        store: true,
      },
    });
  },

  async findById(id) {
    return prisma.supplyOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        store: true,
      },
    });
  },
};

module.exports = orderRepository;
