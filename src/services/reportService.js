const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');

const reportService = {
  async getSalesReport(period) {
    const getTashkentDate = () => {
      return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tashkent"}));
    };

    let startDate = getTashkentDate();
    let endDate = getTashkentDate();

    // Create a precise UTC bound based on Tashkent calendar dates
    const setTashkentRange = (startDt, endDt) => {
      const y1 = startDt.getFullYear();
      const m1 = startDt.getMonth();
      const d1 = startDt.getDate();
      
      const y2 = endDt.getFullYear();
      const m2 = endDt.getMonth();
      const d2 = endDt.getDate();

      return {
        start: new Date(Date.UTC(y1, m1, d1, -5, 0, 0, 0)),
        end: new Date(Date.UTC(y2, m2, d2, 18, 59, 59, 999))
      };
    };

    let finalStart, finalEnd;

    if (period === 'today') {
      const res = setTashkentRange(startDate, endDate);
      finalStart = res.start;
      finalEnd = res.end;
    } else if (period === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
      endDate.setDate(endDate.getDate() - 1);
      const res = setTashkentRange(startDate, endDate);
      finalStart = res.start;
      finalEnd = res.end;
    } else if (period === 'weekly') {
      startDate.setDate(startDate.getDate() - 7);
      const res = setTashkentRange(startDate, endDate);
      finalStart = res.start;
      finalEnd = res.end;
    } else if (period === 'monthly') {
      startDate.setDate(1);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      const res = setTashkentRange(startDate, endDate);
      finalStart = res.start;
      finalEnd = res.end;
    } else if (period === 'yearly') {
      startDate.setMonth(0, 1);
      endDate.setMonth(11, 31);
      const res = setTashkentRange(startDate, endDate);
      finalStart = res.start;
      finalEnd = res.end;
    } else if (period === 'all') {
      finalStart = new Date('2020-01-01T00:00:00.000Z');
      const res = setTashkentRange(endDate, endDate);
      finalEnd = res.end;
    } else if (period && period.match(/^\d{4}-\d{2}-\d{2}$/)) {
      startDate = new Date(period);
      const res = setTashkentRange(startDate, startDate);
      finalStart = res.start;
      finalEnd = res.end;
    } else if (period && period.match(/^\d{4}-\d{2}$/)) {
      const [year, month] = period.split('-');
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0);
      const res = setTashkentRange(startDate, endDate);
      finalStart = res.start;
      finalEnd = res.end;
    } else {
      startDate.setDate(1);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      const res = setTashkentRange(startDate, endDate);
      finalStart = res.start;
      finalEnd = res.end;
    }

    startDate = finalStart;
    endDate = finalEnd;

    const orders = await prisma.supplyOrder.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          not: 'CANCELLED'
        }
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        store: true,
        createdBy: {
          select: { id: true, name: true, username: true, role: true }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const purchaseHistoryList = await prisma.purchaseHistory.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        product: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const debtStores = await prisma.store.findMany({
      where: { currentDebt: { gt: 0 }, isDeleted: false },
      orderBy: { currentDebt: 'desc' },
    });

    const expensesList = await prisma.expense.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const paymentHistories = await prisma.paymentHistory.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        amount: { gt: 0 },
        type: { in: ['ORDER_PAYMENT', 'DEBT_PAYMENT'] }
      },
      include: {
        store: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const debtPayments = paymentHistories.filter(p => {
      if (p.type !== 'DEBT_PAYMENT') return false;
      if (p.paymentMethod === 'DISCOUNT') return false;
      
      const note = p.note ? p.note.toLowerCase() : '';
      if (note.includes('chegirma') || note.includes('qarzdan kechish') || note.includes('qarzdankechish')) {
        return false;
      }
      return true;
    });

    let totalSales = 0;
    let totalPaid = paymentHistories.reduce((acc, curr) => acc + Number(curr.amount), 0);

    const totalDebtAggregate = await prisma.store.aggregate({
      _sum: {
        currentDebt: true
      },
      where: {
        isDeleted: false
      }
    });
    const totalDebt = Number(totalDebtAggregate._sum.currentDebt || 0);

    let totalBoxesSold = 0;
    let totalPiecesSold = 0;
    let totalCOGS = 0;

    const productStats = {};
    const storeStats = {};
    const sellerStats = {};

    for (const order of orders) {
      totalSales += Number(order.totalAmount);

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

      // Calculate seller stats
      const sellerId = order.createdById || 'unknown';
      const sellerName = order.createdBy?.name || order.createdBy?.username || 'Admin';
      
      if (!sellerStats[sellerId]) {
        sellerStats[sellerId] = {
          id: sellerId,
          name: sellerName,
          totalSales: 0,
          ordersCount: 0
        };
      }
      sellerStats[sellerId].totalSales += Number(order.totalAmount);
      sellerStats[sellerId].ordersCount += 1;

      for (const item of order.items) {
        const productId = item.productId;
        const productName = item.product?.name || 'Noma\'lum';
        const quantity = item.quantity;
        const totalPrice = Number(item.totalPrice);

        let pieces = quantity;
        let itemCost = 0;

        if (item.unitType === 'BOX') {
          totalBoxesSold += quantity;
          pieces = quantity * (item.product?.quantityInBox || 1);
          // Quti bo'yicha sotuv: quti tannarxi bilan hisobla
          itemCost = quantity * Number(item.product?.boxCostPrice || item.product?.costPrice || 0);
        } else {
          totalPiecesSold += quantity;
          // Dona bo'yicha sotuv: dona tannarxi bilan hisobla
          itemCost = quantity * Number(item.product?.costPrice || 0);
        }

        totalCOGS += itemCost;

        if (!productStats[productId]) {
          productStats[productId] = {
            id: productId,
            name: productName,
            boxesSold: 0,
            piecesSold: 0,
            totalSalesValue: 0,
            totalCost: 0,
            netProfit: 0,
          };
        }

        if (item.unitType === 'BOX') {
          productStats[productId].boxesSold += quantity;
        } else {
          productStats[productId].piecesSold += quantity;
        }
        productStats[productId].totalSalesValue += totalPrice;
        productStats[productId].totalCost      += itemCost;
        productStats[productId].netProfit      += (totalPrice - itemCost);
      }

    }

    const topProducts = Object.values(productStats)
      .sort((a, b) => b.totalSalesValue - a.totalSalesValue)
      .slice(0, 5);

    const topStores = Object.values(storeStats)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 5);

    const topSellers = Object.values(sellerStats)
      .sort((a, b) => b.totalSales - a.totalSales);

    const balanceService = require('./balanceService');
    const balanceRecord = await balanceService.getBalance();
    const systemBalance = Number(balanceRecord.balance);

    const totalExpenses = purchaseHistoryList.reduce((acc, curr) => acc + Number(curr.paidAmount || 0), 0);
    const totalOtherExpenses = expensesList.reduce((acc, curr) => acc + Number(curr.amount), 0);
    
    const totalSupplierDebt = purchaseHistoryList.reduce((acc, curr) => {
      if (curr.paymentType === 'DEBT' && !curr.isPaid) {
        return acc + Number(curr.debtAmount || 0);
      }
      return acc;
    }, 0);
    
    const netProfit = totalSales - totalCOGS - totalOtherExpenses;
    const profitPercentage = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;


    const productProfitList = Object.values(productStats).sort((a, b) => b.netProfit - a.netProfit);
    const soldProductsList = Object.values(productStats).sort((a, b) => (b.piecesSold + b.boxesSold) - (a.piecesSold + a.boxesSold));

    return {
      period,
      startDate,
      endDate,
      totalSales,
      totalPaid,
      totalDebt,
      totalBoxesSold,
      totalPiecesSold,
      totalExpenses,
      totalOtherExpenses,
      totalSupplierDebt,
      netProfit,
      profitPercentage,
      systemBalance,
      topProducts,
      topStores,
      expensesList,
      salesHistory: orders,
      purchaseHistoryList,
      debtStores,
      productProfitList,
      soldProductsList,
      topSellers,
      debtPayments,
    };

  },
};

module.exports = reportService;
