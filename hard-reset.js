require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Bazaga ulanish URL ini .env fayldan olish
const prisma = new PrismaClient();

async function hardReset() {
  console.log("Barcha test ma'lumotlarini tozalash boshlandi (Railway PostgreSQL)...");

  try {
    // 1. Buyurtma ichidagi tovarlar
    if (prisma.supplyOrderItem) {
      const deletedItems = await prisma.supplyOrderItem.deleteMany({});
      console.log(`✓ SupplyOrderItem tozalandi: ${deletedItems.count} ta`);
    }

    // 2. Buyurtmalar
    if (prisma.supplyOrder) {
      const deletedOrders = await prisma.supplyOrder.deleteMany({});
      console.log(`✓ SupplyOrder tozalandi: ${deletedOrders.count} ta`);
    }

    // 3. To'lovlar tarixi
    if (prisma.paymentHistory) {
      const deletedPayments = await prisma.paymentHistory.deleteMany({});
      console.log(`✓ PaymentHistory tozalandi: ${deletedPayments.count} ta`);
    }

    // 4. Xarajatlar
    if (prisma.expense) {
      const deletedExpenses = await prisma.expense.deleteMany({});
      console.log(`✓ Expense tozalandi: ${deletedExpenses.count} ta`);
    }

    // 5. Xaridlar tarixi
    if (prisma.purchaseHistory) {
      const deletedPurchases = await prisma.purchaseHistory.deleteMany({});
      console.log(`✓ PurchaseHistory tozalandi: ${deletedPurchases.count} ta`);
    }

    // 6. Do'konlar (CRM)
    if (prisma.store) {
      const deletedStores = await prisma.store.deleteMany({});
      console.log(`✓ Store (Do'konlar) tozalandi: ${deletedStores.count} ta`);
    }

    // 7. Mahsulotlar (Ombor)
    if (prisma.product) {
      const deletedProducts = await prisma.product.deleteMany({});
      console.log(`✓ Product (Mahsulotlar) tozalandi: ${deletedProducts.count} ta`);
    }

    // 8. Kategoriyalar
    if (prisma.category) {
      const deletedCategories = await prisma.category.deleteMany({});
      console.log(`✓ Category (Kategoriyalar) tozalandi: ${deletedCategories.count} ta`);
    }

    // 9. Asosiy Balansni 0 qilish
    if (prisma.systemBalance) {
      await prisma.systemBalance.updateMany({
        data: { balance: 0 }
      });
      console.log("✓ Asosiy kassa balansi 0 so'm qilindi.");
    }

    console.log("\n=========================================");
    console.log(" Barcha test ma'lumotlari muvaffaqiyatli tozalandi!");
    console.log(" Xodimlar (User akkauntlari) saqlab qolindi.");
    console.log("=========================================\n");
  } catch (error) {
    console.error("Xatolik yuz berdi:", error);
  } finally {
    await prisma.$disconnect();
  }
}

hardReset();