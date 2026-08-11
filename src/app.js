const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const AppError = require('./utils/AppError');
const errorHandler = require('./middlewares/errorHandler');

const productRoutes = require('./routes/productRoutes');
const storeRoutes = require('./routes/storeRoutes');
const orderRoutes = require('./routes/orderRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

// 1. GLOBAL MIDDLEWARES
// Set security HTTP headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Enable CORS
app.use(cors());

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 2. ROUTES
// Default health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'B2B Distribution System API is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1/products', productRoutes);
app.use('/api/v1/stores', storeRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/v1/reports', reportRoutes);

// Handle undefined routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// 3. CENTRAL ERROR HANDLER
app.use(errorHandler);

module.exports = app;
