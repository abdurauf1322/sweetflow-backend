const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration to fix missing supplierIds...');

  // Find all products with missing supplierId
  const products = await prisma.product.findMany({
    where: { supplierId: null },
    include: { category: true, purchaseHistory: true }
  });

  console.log(`Found ${products.length} products with missing supplierId.`);

  let fixCount = 0;

  for (const product of products) {
    if (!product.category) continue;

    const categoryName = product.category.name;
    
    // Find or create supplier
    let supplier = await prisma.supplier.findUnique({ where: { name: categoryName } });
    if (!supplier) {
      supplier = await prisma.supplier.create({ data: { name: categoryName } });
      console.log(`Created new supplier: ${categoryName}`);
    }

    // Assign supplier to product
    await prisma.product.update({
      where: { id: product.id },
      data: { supplierId: supplier.id }
    });

    // Update purchase histories
    const { count } = await prisma.purchaseHistory.updateMany({
      where: { productId: product.id },
      data: { supplierName: supplier.name }
    });
    console.log(`Updated ${count} purchase histories for product: ${product.name}`);

    // If the product has debt, we add it to the supplier's totalDebt
    const productDebt = Number(product.debtAmount) || 0;
    if (productDebt > 0) {
      await prisma.supplier.update({
        where: { id: supplier.id },
        data: { totalDebt: { increment: productDebt } }
      });
      console.log(`Added ${productDebt} debt to supplier ${supplier.name} from product ${product.name}`);
    }

    fixCount++;
  }

  console.log(`Fixed ${fixCount} products. Migration completed successfully.`);
}

main()
  .catch(e => {
    console.error('Error during migration:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
