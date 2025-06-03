import { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: FastifyRequest) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  message?: string; // Custom error message
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  private getKey(request: FastifyRequest): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(request);
    }
    
    // Default: use user ID if authenticated, otherwise IP
    const user = (request as any).user;
    if (user && user.id) {
      return `user:${user.id}`;
    }
    
    return `ip:${request.ip}`;
  }

  async checkLimit(request: FastifyRequest): Promise<{ allowed: boolean; resetTime: number; remaining: number }> {
    const key = this.getKey(request);
    const now = Date.now();
    
    if (!this.store[key] || this.store[key].resetTime < now) {
      // Initialize or reset the counter
      this.store[key] = {
        count: 1,
        resetTime: now + this.config.windowMs
      };
      
      return {
        allowed: true,
        resetTime: this.store[key].resetTime,
        remaining: this.config.maxRequests - 1
      };
    }
    
    this.store[key].count++;
    
    const remaining = Math.max(0, this.config.maxRequests - this.store[key].count);
    const allowed = this.store[key].count <= this.config.maxRequests;
    
    return {
      allowed,
      resetTime: this.store[key].resetTime,
      remaining
    };
  }

  createMiddleware() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await this.checkLimit(request);
        
        // Add rate limit headers
        reply.header('X-RateLimit-Limit', this.config.maxRequests);
        reply.header('X-RateLimit-Remaining', result.remaining);
        reply.header('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
        
        if (!result.allowed) {
          const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
          reply.header('Retry-After', retryAfter);
          
          return reply.status(429).send({
            error: this.config.message || 'Too many requests',
            retryAfter: retryAfter
          });
        }
      } catch (error) {
        console.error('Rate limiting error:', error);
        // Don't block requests if rate limiter fails
      }
    };
  }
}

// Predefined rate limiters for different endpoints
export const chatRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 messages per minute
  message: 'Too many messages sent. Please wait before sending another message.',
  keyGenerator: (request: FastifyRequest) => {
    const user = (request as any).user;
    return user ? `chat:user:${user.id}` : `chat:ip:${request.ip}`;
  }
});

export const blockRateLimiter = new RateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 50, // 50 block actions per 5 minutes
  message: 'Too many block/unblock actions. Please wait before trying again.',
  keyGenerator: (request: FastifyRequest) => {
    const user = (request as any).user;
    return user ? `block:user:${user.id}` : `block:ip:${request.ip}`;
  }
});

export const friendRequestRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 50, // 50 friend requests per hour
  message: 'Too many friend requests sent. Please wait before sending more.',
  keyGenerator: (request: FastifyRequest) => {
    const user = (request as any).user;
    return user ? `friend:user:${user.id}` : `friend:ip:${request.ip}`;
  }
});

export const generalApiRateLimiter = new RateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 200, // 200 requests per 5 minutes
  message: 'Too many API requests. Please wait before trying again.',
});

export const authRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 auth attempts per 15 minutes
  message: 'Too many authentication attempts. Please wait before trying again.',
  keyGenerator: (request: FastifyRequest) => `auth:ip:${request.ip}`
});

// Socket rate limiter class for real-time events
export class SocketRateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  private maxEvents: number;

  constructor(windowMs: number = 60000, maxEvents: number = 20) {
    this.windowMs = windowMs;
    this.maxEvents = maxEvents;
    
    // Clean up expired entries
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  checkLimit(userId: string): boolean {
    const key = `socket:${userId}`;
    const now = Date.now();
    
    if (!this.store[key] || this.store[key].resetTime < now) {
      this.store[key] = {
        count: 1,
        resetTime: now + this.windowMs
      };
      return true;
    }
    
    this.store[key].count++;
    return this.store[key].count <= this.maxEvents;
  }
}

// Export socket rate limiter instances
export const socketMessageRateLimiter = new SocketRateLimiter(60000, 15); // 15 messages per minute
export const socketEventRateLimiter = new SocketRateLimiter(60000, 50); // 50 events per minute

// Helper function to create custom rate limiter
export const createRateLimiter = (config: RateLimitConfig): RateLimiter => {
  return new RateLimiter(config);
};