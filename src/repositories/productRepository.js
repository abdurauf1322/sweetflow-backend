const prisma = require('../utils/prisma');

const getClient = (tx) => tx || prisma;

const productRepository = {
  async create(data, tx) {
    const client = getClient(tx);
    // Explicitly pick only fields that exist in the Prisma schema.
    // This prevents unknown fields like _addedBoxes, _addedPieces, stock, boxes
    // (used for balance calculations) from causing Prisma errors.
    const {
      name,
      categoryId,
      unitPrice,
      boxPrice,
      costPrice,
      boxCostPrice,
      quantityInBox,
      stockCount,
      minStockLimit,
      imageUrl,
    } = data;

    return client.product.create({
      data: {
        name,
        categoryId,
        unitPrice,
        boxPrice,
        costPrice:    costPrice    ?? 0,
        boxCostPrice: boxCostPrice ?? 0,
        quantityInBox,
        stockCount:   stockCount   ?? 0,
        minStockLimit: minStockLimit ?? 10,
        imageUrl:     imageUrl,
      },
      include: { category: true },
    });
  },

  async findById(id, tx) {
    const client = getClient(tx);
    return client.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
  },

  async findByName(name, tx) {
    const client = getClient(tx);
    return client.product.findUnique({
      where: { name },
      include: {
        category: true,
      },
    });
  },

  async findLowStock(tx) {
    const client = getClient(tx);
    return client.product.findMany({
      where: {
        isDeleted: false,
        stockCount: {
          lte: client.product.fields.minStockLimit,
        },
      },
      include: {
        category: true,
      },
    });
  },

  async updateStock(id, newStock, tx) {
    const client = getClient(tx);
    
    // Check if stock goes above minStockLimit to reset the alert flag
    const product = await client.product.findUnique({
      where: { id },
      select: { minStockLimit: true },
    });

    const isRestocked = product && newStock > product.minStockLimit;

    return client.product.update({
      where: { id },
      data: { 
        stockCount: newStock,
        ...(isRestocked ? { isLowStockAlertSent: false } : {})
      },
    });
  },
};

module.exports = productRepository;
