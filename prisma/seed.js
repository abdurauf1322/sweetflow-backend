const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with test data...');

  // 1. Clean existing records in order of dependencies
  await prisma.supplyOrderItem.deleteMany();
  await prisma.supplyOrder.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  await prisma.category.deleteMany();

  console.log('Cleaned database tables.');

  // 2. Create Categories
  const categoryBatonchik = await prisma.category.create({
    data: {
      name: 'Batonchiklar',
      description: 'Mayda shokoladli batonchiklar (Snickers, Mars va h.k.)',
    },
  });

  const categoryPlitka = await prisma.category.create({
    data: {
      name: 'Plitka shokoladlar',
      description: 'Katta plitkali shokoladlar (Alpen Gold, Milka va h.k.)',
    },
  });

  console.log('Created categories.');

  // 3. Create Products
  const snickers = await prisma.product.create({
    data: {
      name: 'Snickers Miniatures',
      categoryId: categoryBatonchik.id,
      unitPrice: 5000,
      boxPrice: 120000,
      quantityInBox: 24,
      stockCount: 120, // 5 boxes
      minStockLimit: 30,
      isLowStockAlertSent: false,
    },
  });

  const mars = await prisma.product.create({
    data: {
      name: 'Mars Classic',
      categoryId: categoryBatonchik.id,
      unitPrice: 5500,
      boxPrice: 132000,
      quantityInBox: 24,
      stockCount: 24, // 1 box (Low Stock warning trigger!)
      minStockLimit: 30,
      isLowStockAlertSent: false,
    },
  });

  const alpenGold = await prisma.product.create({
    data: {
      name: 'Alpen Gold Milk',
      categoryId: categoryPlitka.id,
      unitPrice: 12000,
      boxPrice: 240000,
      quantityInBox: 20,
      stockCount: 200, // 10 boxes
      minStockLimit: 40,
      isLowStockAlertSent: false,
    },
  });

  console.log('Created products.');

  // 4. Create B2B Stores
  await prisma.store.create({
    data: {
      name: 'Sweet House',
      ownerName: 'Elyor Alimov',
      phone: '+998901234567',
      creditLimit: 15000000, // 15M
      paymentDays: 15,
      currentDebt: 0,
    },
  });

  await prisma.store.create({
    data: {
      name: 'Shokolad Dunyosi',
      ownerName: 'Sardor Azimov',
      phone: '+998931234567',
      creditLimit: 20000000, // 20M
      paymentDays: 30,
      currentDebt: 0,
    },
  });

  await prisma.store.create({
    data: {
      name: 'Lazzat Shirinliklari',
      ownerName: 'Nodir Karimov',
      phone: '+998971234567',
      creditLimit: 10000000, // 10M
      paymentDays: 10,
      currentDebt: 0,
    },
  });

  console.log('Created B2B store partners.');
  console.log('Database seeding finished successfully! 🎉');
}

main()
  .catch((e) => {
    console.error('Error during seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
