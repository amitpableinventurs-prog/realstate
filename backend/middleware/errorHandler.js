import logger from '../utils/logger.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    code: 'ROUTE_NOT_FOUND',
    message: `Route ${req.originalUrl} not found`,
    statusCode: 404,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
};

export const errorHandler = (err, req, res, _next) => {
  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : (err.status || 500);
  const isOperational = err instanceof AppError || statusCode < 500;
  const message = isOperational ? err.message : 'Internal server error';
  const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR');

  (req.logger || logger).error('Request error', {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    path: req.path,
    method: req.method,
    statusCode,
    code,
  });

  res.status(statusCode).json({
    success: false,
    code,
    message,
    statusCode,
    requestId: req.requestId,
    ...(err.details ? { details: err.details } : {}),
    ...(process.env.NODE_ENV === 'development' && !isOperational ? { stack: err.stack } : {}),
    timestamp: new Date().toISOString(),
  });
};
