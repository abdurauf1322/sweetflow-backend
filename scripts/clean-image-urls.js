// One-time script to clean /uploads/ prefix from imageUrl in products table
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find all products with imageUrl starting with /uploads/
  const products = await prisma.product.findMany({
    where: {
      imageUrl: {
        startsWith: '/uploads/'
      }
    },
    select: { id: true, name: true, imageUrl: true }
  });

  console.log(`Found ${products.length} product(s) with /uploads/ prefix:`);

  for (const product of products) {
    const cleanUrl = product.imageUrl.replace(/^\/uploads\//, '');
    console.log(`  ${product.name}: "${product.imageUrl}" → "${cleanUrl}"`);
    await prisma.product.update({
      where: { id: product.id },
      data: { imageUrl: cleanUrl }
    });
  }

  console.log('Done! All imageUrl values cleaned.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
