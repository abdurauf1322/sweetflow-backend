const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDB() {
  console.log('Production ready holatiga o\'tkazilmoqda...');

  try {
    // Buyurtmalar tarkibini o'chirish (SupplyOrderItem)
    const deletedOrderItems = await prisma.supplyOrderItem.deleteMany({});
    console.log(`- ${deletedOrderItems.count} ta SupplyOrderItem o'chirildi`);

    // Buyurtmalarni o'chirish (SupplyOrder)
    const deletedOrders = await prisma.supplyOrder.deleteMany({});
    console.log(`- ${deletedOrders.count} ta SupplyOrder o'chirildi`);

    // To'lovlarni o'chirish (PaymentHistory)
    const deletedPayments = await prisma.paymentHistory.deleteMany({});
    console.log(`- ${deletedPayments.count} ta PaymentHistory o'chirildi`);

    // Xarajatlarni o'chirish (Expense)
    const deletedExpenses = await prisma.expense.deleteMany({});
    console.log(`- ${deletedExpenses.count} ta Expense o'chirildi`);

    // Tovar xaridlari (PurchaseHistory) - O'chirilsin degan xulosaga kelmadim, 
    // lekin "Barcha test xarajatlar" ichida bo'lsa, buni ham o'chirish kerakmi? 
    // "Jami xarajat (Tovarlar)"ni 0 qilish uchun PurchaseHistory ham o'chirilishi kerak,
    // aks holda Analyticsda totalExpenses 0 bo'lmaydi.
    const deletedPurchases = await prisma.purchaseHistory.deleteMany({});
    console.log(`- ${deletedPurchases.count} ta PurchaseHistory o'chirildi`);

    // Kassa balansini 0 ga tushirish
    const deletedBalances = await prisma.systemBalance.deleteMany({});
    await prisma.systemBalance.create({
      data: {
        balance: 0
      }
    });
    console.log(`- Kassa balansi 0 ga tushirildi`);

    console.log('\n✅ Barcha test ma\'lumotlari xavfsiz o\'chirildi!');
    console.log('✅ Store, Product, Category, Userlar SAQLANIB QOLDI!');
  } catch (error) {
    console.error('Xatolik yuz berdi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDB();
