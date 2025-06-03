import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
  requestId?: string;
  details?: any;
}

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, true, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401, true, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, true, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, true, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  public retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message, 429, true, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, 500, true, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
    this.stack = originalError?.stack || this.stack;
  }
}

const formatZodError = (error: ZodError): string => {
  const issues = error.issues.map(issue => {
    const path = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
    return `${issue.message}${path}`;
  });
  return issues.join(', ');
};

const createErrorResponse = (
  error: Error,
  statusCode: number,
  request: FastifyRequest,
  message?: string
): ErrorResponse => {
  const response: ErrorResponse = {
    error: error.name || 'Error',
    message: message || error.message || 'Internal Server Error',
    statusCode,
    timestamp: new Date().toISOString(),
    path: request.url,
    requestId: (request as any).id
  };

  // Add details for specific error types
  if (error instanceof ZodError) {
    response.details = {
      validationErrors: error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))
    };
  }

  if (error instanceof RateLimitError) {
    response.details = {
      retryAfter: error.retryAfter
    };
  }

  return response;
};

const logError = (error: Error, request: FastifyRequest, statusCode: number): void => {
  const user = (request as any).user;
  const userId = user?.id;
  const ip = request.ip;
  const userAgent = request.headers['user-agent'];
  const method = request.method;
  const url = request.url;

  // Different logging based on error severity
  if (statusCode >= 500) {
    logger.error(
      `Server Error: ${error.message}`,
      error,
      {
        statusCode,
        method,
        url,
        userId,
        ip,
        userAgent,
        requestBody: method !== 'GET' ? request.body : undefined
      }
    );

    // Log security event for server errors
    logger.security(
      'SERVER_ERROR',
      'HIGH',
      userId,
      ip,
      {
        error: error.message,
        stack: error.stack,
        method,
        url
      }
    );
  } else if (statusCode >= 400) {
    if (statusCode === 401 || statusCode === 403) {
      logger.authEvent(
        'UNAUTHORIZED_ACCESS',
        userId,
        user?.email,
        ip,
        userAgent,
        error.message
      );
    } else if (statusCode === 429) {
      logger.rateLimitHit(
        url,
        userId,
        ip,
        0, // Will be filled by rate limiter
        'unknown'
      );
    } else {
      logger.warn(
        `Client Error: ${error.message}`,
        {
          statusCode,
          method,
          url,
          userId,
          ip,
          userAgent
        }
      );
    }
  }
};

const isDevelopment = process.env.NODE_ENV === 'development';

export const errorHandler = async (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  let statusCode = 500;
  let message = 'Internal Server Error';

  // Handle different error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = formatZodError(error);
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = error.message;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    statusCode = 500;
    message = 'Database operation failed';
  } else if (error.statusCode) {
    statusCode = error.statusCode;
    message = error.message;
  }

  // Log the error
  logError(error, request, statusCode);

  // Create error response
  const errorResponse = createErrorResponse(error, statusCode, request, message);

  // Don't expose internal error details in production
  if (!isDevelopment && statusCode >= 500) {
    errorResponse.message = 'Internal Server Error';
    delete errorResponse.details;
  }

  // Add stack trace in development
  if (isDevelopment && statusCode >= 500) {
    errorResponse.details = {
      ...(errorResponse.details || {}),
      stack: error.stack
    };
  }

  // Send response
  reply.status(statusCode).send(errorResponse);
};

export const notFoundHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const error = new NotFoundError('Route');
  
  logger.warn(
    `Route not found: ${request.method} ${request.url}`,
    {
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    }
  );

  const errorResponse = createErrorResponse(error, 404, request);
  reply.status(404).send(errorResponse);
};

// Request logging middleware
export const requestLogger = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const user = (request as any).user;

  // Log request start
  logger.debug(
    `Request started: ${request.method} ${request.url}`,
    {
      method: request.method,
      url: request.url,
      userId: user?.id,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    }
  );
};

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => {
  return (request: FastifyRequest, reply: FastifyReply) => {
    Promise.resolve(fn(request, reply)).catch((error) => {
      reply.send(error);
    });
  };
};

// Health check for error handling system
export const healthCheck = {
  errorHandling: (): { status: string; timestamp: string } => {
    return {
      status: 'operational',
      timestamp: new Date().toISOString()
    };
  },

  logging: (): { status: string; logLevel: string; timestamp: string } => {
    return {
      status: 'operational',
      logLevel: process.env.NODE_ENV === 'development' ? 'DEBUG' : 'INFO',
      timestamp: new Date().toISOString()
    };
  }
};