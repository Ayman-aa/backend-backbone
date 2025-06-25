import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

export interface ValidationOptions {
  body?: z.ZodSchema;
  params?: z.ZodSchema;
  query?: z.ZodSchema;
}

export const createValidationMiddleware = (options: ValidationOptions) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate request body
      if (options.body) {
        try {
          request.body = options.body.parse(request.body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return reply.status(400).send({
              error: formatZodError(error),
              field: 'body'
            });
          }
          return reply.status(400).send({ error: 'Invalid request body' });
        }
      }

      // Validate URL parameters
      if (options.params) {
        try {
          request.params = options.params.parse(request.params);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return reply.status(400).send({
              error: formatZodError(error),
              field: 'params'
            });
          }
          return reply.status(400).send({ error: 'Invalid URL parameters' });
        }
      }

      // Validate query parameters
      if (options.query) {
        try {
          request.query = options.query.parse(request.query);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return reply.status(400).send({
              error: formatZodError(error),
              field: 'query'
            });
          }
          return reply.status(400).send({ error: 'Invalid query parameters' });
        }
      }
    } catch (error) {
      console.error('Validation middleware error:', error);
      return reply.status(500).send({ error: 'Internal validation error' });
    }
  };
};

export const formatZodError = (error: z.ZodError): string => {
  const firstError = error.errors[0];
  if (firstError) {
    return firstError.message;
  }
  return 'Invalid input data';
};

export const formatZodErrorDetailed = (error: z.ZodError): { message: string; field: string; code: string } => {
  const firstError = error.errors[0];
  if (firstError) {
    return {
      message: firstError.message,
      field: firstError.path.join('.') || 'unknown',
      code: firstError.code
    };
  }
  return {
    message: 'Invalid input data',
    field: 'unknown',
    code: 'invalid_input'
  };
};

// Common validation schemas
export const CommonSchemas = {
  positiveInteger: z.number().int().positive(),
  nonEmptyString: z.string().min(1).trim(),
  email: z.string().email(),
  uuid: z.string().uuid(),
  pagination: z.object({
    page: z.number().int().positive().min(1).default(1),
    limit: z.number().int().positive().min(1).max(100).default(50),
  }).partial()
};

// Security validation helpers
export const SecurityValidation = {
  sanitizeString: (input: string): string => {
    if (!input || typeof input !== 'string') {
      return '';
    }
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .trim();
  },

  validateMessageContent: z.string()
    .min(1, "Message content is required")
    .max(1000, "Message too long (max 1000 characters)")
    .trim()
    .refine(
      (content) => content.length > 0,
      { message: "Message cannot be empty after trimming whitespace" }
    ),

  validateUserId: z.number().int().positive().min(1, "User ID must be a positive integer")
};