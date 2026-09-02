const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const balanceService = require('./balanceService');

const supplierService = {
  async getAllSuppliers() {
    return prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    });
  },

  async createSupplier(data) {
    const { name, phone } = data;
    if (!name) throw new AppError("Ta'minotchi nomi kiritilishi shart", 400);

    const existing = await prisma.supplier.findUnique({ where: { name } });
    if (existing) throw new AppError("Bunday ta'minotchi allaqachon mavjud", 400);

    return prisma.supplier.create({
      data: { name, phone }
    });
  },

  async getSupplierDebts() {
    const suppliers = await prisma.supplier.findMany({
      where: { totalDebt: { gt: 0 } },
      orderBy: { name: 'asc' }
    });

    const result = [];
    for (const supplier of suppliers) {
      const products = await prisma.product.findMany({
        where: { supplierId: supplier.id },
        select: { id: true }
      });
      const productIds = products.map(p => p.id);

      const purchases = await prisma.purchaseHistory.findMany({
        where: {
          productId: { in: productIds },
          paymentType: 'DEBT',
          isPaid: false
        },
        include: { product: true },
        orderBy: { createdAt: 'asc' }
      });

      result.push({
        ...supplier,
        purchases
      });
    }

    return result;
  },

  async paySupplierDebt(supplierId, amount, productId = null) {
    return prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) throw new AppError("Ta'minotchi topilmadi", 404);

      if (amount > supplier.totalDebt) {
        throw new AppError("Kiritilgan summa umumiy qarzdan katta", 400);
      }

      // To'lovni kassadan (SystemBalance) ayirish
      await balanceService.updateBalance(-amount, tx);

      let remainingAmount = amount;

      // Agar alohida mahsulot uchun to'lanayotgan bo'lsa
      if (productId) {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) throw new AppError("Mahsulot topilmadi", 404);
        if (product.supplierId !== supplierId) throw new AppError("Mahsulot ushbu ta'minotchiga tegishli emas", 400);
        if (amount > product.debtAmount) throw new AppError("Kiritilgan summa mahsulot qarzidan katta", 400);

        await tx.product.update({
          where: { id: productId },
          data: { debtAmount: { decrement: amount } }
        });
        
        // PurchaseHistory uchun ham yopish
        const purchaseHistories = await tx.purchaseHistory.findMany({
          where: { productId: product.id, paymentType: 'DEBT', isPaid: false },
          orderBy: { createdAt: 'asc' }
        });
        
        let pRemaining = amount;
        for (const ph of purchaseHistories) {
          if (pRemaining <= 0) break;
          const phDebt = Number(ph.totalCost) - Number(ph.paidAmount || 0);
          const payPh = Math.min(phDebt, pRemaining);
          await tx.purchaseHistory.update({
            where: { id: ph.id },
            data: {
              paidAmount: Number(ph.paidAmount || 0) + payPh,
              isPaid: (Number(ph.paidAmount || 0) + payPh) >= Number(ph.totalCost)
            }
          });
          pRemaining -= payPh;
        }

        remainingAmount = 0;
      } else {
        // Umumiy qarzni to'lash - mahsulotlar qarzini kamaytirib chiqish
        const productsWithDebt = await tx.product.findMany({
          where: { supplierId, debtAmount: { gt: 0 } },
          orderBy: { createdAt: 'asc' } // Eski qarzlardan boshlab yopish
        });

        for (const product of productsWithDebt) {
          if (remainingAmount <= 0) break;
          const payForProduct = Math.min(product.debtAmount, remainingAmount);
          await tx.product.update({
            where: { id: product.id },
            data: { debtAmount: { decrement: payForProduct } }
          });
          
          // Shuningdek, PurchaseHistory ni ham yangilash
          const purchaseHistories = await tx.purchaseHistory.findMany({
            where: { productId: product.id, paymentType: 'DEBT', isPaid: false },
            orderBy: { createdAt: 'asc' }
          });
          
          let pRemaining = payForProduct;
          for (const ph of purchaseHistories) {
            if (pRemaining <= 0) break;
            const phDebt = Number(ph.totalCost) - Number(ph.paidAmount || 0);
            const payPh = Math.min(phDebt, pRemaining);
            await tx.purchaseHistory.update({
              where: { id: ph.id },
              data: {
                paidAmount: Number(ph.paidAmount || 0) + payPh,
                isPaid: (Number(ph.paidAmount || 0) + payPh) >= Number(ph.totalCost)
              }
            });
            pRemaining -= payPh;
          }

          remainingAmount -= payForProduct;
        }
      }

      // Ta'minotchi umumiy qarzini yangilash
      const updatedSupplier = await tx.supplier.update({
        where: { id: supplierId },
        data: { totalDebt: { decrement: amount } }
      });

      // To'lov tarixini yozish
      await tx.supplierPayment.create({
        data: {
          supplierId,
          productId,
          amount,
          paymentMethod: 'CASH'
        }
      });

      // Xarajat (Expense) sifatida yozish (Ixtiyoriy, agar kassadan chiqimni Expense sifatida saqlash kerak bo'lsa)
      await tx.expense.create({
        data: {
          amount,
          description: `Ta'minotchiga qarz to'landi: ${supplier.name}`
        }
      });

      return updatedSupplier;
    });
  }
};

module.exports = supplierService;
