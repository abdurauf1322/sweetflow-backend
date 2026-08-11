const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');

const reportService = {
  async getSalesReport(period) {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'weekly') {
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'monthly') {
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default: monthly
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    const orders = await prisma.supplyOrder.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
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

    let totalSales = 0;
    let totalPaid = 0;
    let totalDebt = 0;
    let totalBoxesSold = 0;
    let totalPiecesSold = 0;

    const productStats = {};
    const storeStats = {};

    for (const order of orders) {
      totalSales += Number(order.totalAmount);
      totalDebt += Number(order.debtAmount);
      totalPaid += (Number(order.totalAmount) - Number(order.debtAmount));

      // Calculate store stats
      const storeId = order.storeId;
      const storeName = order.store?.name || 'Noma\'lum';
      const storeOwner = order.store?.ownerName || 'Noma\'lum';
      const storeDebt = Number(order.store?.currentDebt || 0);

      if (!storeStats[storeId]) {
        storeStats[storeId] = {
          id: storeId,
          name: storeName,
          ownerName: storeOwner,
          totalSpend: 0,
          ordersCount: 0,
          currentDebt: storeDebt,
        };
      }
      storeStats[storeId].totalSpend += Number(order.totalAmount);
      storeStats[storeId].ordersCount += 1;

      // Calculate items & product stats
      for (const item of order.items) {
        const productId = item.productId;
        const productName = item.product?.name || 'Noma\'lum';
        const quantity = item.quantity;
        const totalPrice = Number(item.totalPrice);

        if (item.unitType === 'BOX') {
          totalBoxesSold += quantity;
        } else {
          totalPiecesSold += quantity;
        }

        if (!productStats[productId]) {
          productStats[productId] = {
            id: productId,
            name: productName,
            boxesSold: 0,
            piecesSold: 0,
            totalSalesValue: 0,
          };
        }

        if (item.unitType === 'BOX') {
          productStats[productId].boxesSold += quantity;
        } else {
          productStats[productId].piecesSold += quantity;
        }
        productStats[productId].totalSalesValue += totalPrice;
      }
    }

    const topProducts = Object.values(productStats)
      .sort((a, b) => b.totalSalesValue - a.totalSalesValue)
      .slice(0, 5);

    const topStores = Object.values(storeStats)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 5);

    return {
      period,
      startDate,
      endDate,
      totalSales,
      totalPaid,
      totalDebt,
      totalBoxesSold,
      totalPiecesSold,
      topProducts,
      topStores,
    };
  },
};

module.exports = reportService;
