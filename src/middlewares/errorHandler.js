const { ZodError } = require('zod');
const { Prisma } = require('@prisma/client');

const handleZodError = (err) => {
  const errors = err.errors.reduce((acc, current) => {
    const field = current.path.join('.');
    acc[field] = current.message;
    return acc;
  }, {});

  return {
    statusCode: 400,
    status: 'fail',
    message: 'Validation Error',
    errors,
  };
};

const handlePrismaError = (err) => {
  let message = 'Database Error';
  let statusCode = 500;

  // Handle unique constraint violations
  if (err.code === 'P2002') {
    const fields = err.meta?.target ? err.meta.target.join(', ') : 'field';
    message = `Unique constraint failed on the fields: (${fields})`;
    statusCode = 400;
  }
  // Handle record not found
  else if (err.code === 'P2025') {
    message = err.meta?.cause || 'Record not found';
    statusCode = 404;
  }
  // Handle foreign key constraint violations
  else if (err.code === 'P2003') {
    message = 'Foreign key constraint failed';
    statusCode = 400;
  }

  return {
    statusCode,
    status: 'fail',
    message,
  };
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    message: err.message,
    stack: err.stack,
    errors: err.errors,
    error: err,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      errors: err.errors,
    });
  } else {
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong on the server',
    });
  }
};

module.exports = (err, req, res, next) => {
  let error = err;
  
  // Set default properties if missing
  error.statusCode = err.statusCode || 500;
  error.status = err.status || 'error';
  error.isOperational = err.isOperational || false;

  if (err.name === 'MulterError' || (err.message && err.message.includes('rasmlar qabul qilinadi'))) {
    error.statusCode = 400;
    error.isOperational = true;
    error.message = err.message || 'File upload error';
  } else if (err instanceof ZodError) {
    const formatted = handleZodError(err);
    error = Object.assign(error, formatted);
    error.isOperational = true;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const formatted = handlePrismaError(err);
    error = Object.assign(error, formatted);
    error.isOperational = true;
  } else if (err.name === 'PrismaClientValidationError') {
    error.statusCode = 400;
    error.isOperational = true;
    error.message = 'Database Validation Error: Invalid data provided';
  }

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};
