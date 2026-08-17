// Load environment variables as early as possible
require('dotenv').config();

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

const app = require('./app');
const prisma = require('./utils/prisma');
const { initCronJobs } = require('./jobs/cronJobs');
const { initBotHandler, stopBotHandler } = require('./services/botHandler');

const port = process.env.PORT || 5000;

// Start Express Server
const server = app.listen(port, () => {
  console.log(`Application running in ${process.env.NODE_ENV || 'development'} mode on port ${port}...`);
  // Initialize cron jobs
  initCronJobs();
  // Initialize Telegram bot (contact auto-linking)
  initBotHandler();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down gracefully...');
  console.error(err.name, err.message, err.stack);
  server.close(async () => {
    await stopBotHandler();
    process.exit(1);
  });
});

// Graceful Shutdown on termination signals
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down server and database connections...`);
  
  await stopBotHandler();
  
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('Database disconnected. Express server closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error during database disconnection:', err);
      process.exit(1);
    }
  });
  
  // Force exit after 10 seconds if shutdown hangs
  setTimeout(() => {
    console.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));
