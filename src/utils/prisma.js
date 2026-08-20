require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// DB ulanish manzilini alohida qismlardan yig'ib olamiz
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT || 5432;
const dbName = process.env.DB_NAME;

const databaseUrl = dbUser && dbPassword && dbHost && dbName 
  ? `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('FATAL ERROR: Database connection variables (or DATABASE_URL) are missing in .env');
}

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } }
  });
} else {
  // Prevent multiple instances of Prisma Client in development
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
      datasources: { db: { url: databaseUrl } }
    });
  }
  prisma = global.prisma;
}

module.exports = prisma;
