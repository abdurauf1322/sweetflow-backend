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
const authRoutes = require('./routes/auth.routes');
const expenseRoutes = require('./routes/expenseRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const path = require('path');


const app = express();

// 1. GLOBAL MIDDLEWARES
// Set security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

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

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 2. ROUTES
// Default health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'B2B Distribution System API is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
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
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/purchases', purchaseRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/v1/expenses/inventory', purchaseRoutes);
app.use('/api/expenses/inventory', purchaseRoutes);

// Handle undefined routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// 3. CENTRAL ERROR HANDLER
app.use(errorHandler);

module.exports = app;
