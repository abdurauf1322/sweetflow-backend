const prisma = require('./src/utils/prisma');

async function fix() {
  try {
    const deleted = await prisma.expense.deleteMany({
      where: {
        description: {
          startsWith: "Ta'minotchiga qarz to'landi"
        }
      }
    });
    console.log(`Deleted ${deleted.count} wrong expenses.`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fix();
