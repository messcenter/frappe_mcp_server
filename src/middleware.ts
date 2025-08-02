/**
 * Middleware utilities for Frappe MCP Server
 * Includes rate limiting, metrics, authentication, and request logging
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

// Rate limiting store
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute

// Metrics store
interface Metrics {
  requests: {
    total: number;
    success: number;
    error: number;
    byTool: Record<string, number>;
    byStatus: Record<number, number>;
  };
  sessions: {
    total: number;
    active: number;
  };
  performance: {
    avgResponseTime: number;
    responseTimeHistory: number[];
  };
  uptime: number;
}

const metrics: Metrics = {
  requests: {
    total: 0,
    success: 0,
    error: 0,
    byTool: {},
    byStatus: {}
  },
  sessions: {
    total: 0,
    active: 0
  },
  performance: {
    avgResponseTime: 0,
    responseTimeHistory: []
  },
  uptime: Date.now()
};

// Clean up rate limit store
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

// Clean up response time history
setInterval(() => {
  if (metrics.performance.responseTimeHistory.length > 1000) {
    metrics.performance.responseTimeHistory = metrics.performance.responseTimeHistory.slice(-500);
    // Recalculate average
    const sum = metrics.performance.responseTimeHistory.reduce((a, b) => a + b, 0);
    metrics.performance.avgResponseTime = sum / metrics.performance.responseTimeHistory.length;
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip rate limiting in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const rawClientId = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const clientId = Array.isArray(rawClientId) ? rawClientId[0] : rawClientId;
  const now = Date.now();
  
  let entry = rateLimitStore.get(clientId);
  
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW
    };
  }
  
  entry.count++;
  rateLimitStore.set(clientId, entry);
  
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    logger.warn(`Rate limit exceeded for client ${clientId}: ${entry.count} requests`);
    return res.status(429).json({
      jsonrpc: "2.0",
      id: req.body?.id || null,
      error: {
        code: -32000, // Server error
        message: "Rate limit exceeded",
        data: {
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        }
      }
    });
  }
  
  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));
  
  next();
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Track request
  metrics.requests.total++;
  
  // Override res.json to capture response
  const originalJson = res.json;
  res.json = function(body: any) {
    const responseTime = Date.now() - startTime;
    
    // Update metrics
    metrics.performance.responseTimeHistory.push(responseTime);
    if (metrics.performance.responseTimeHistory.length === 1) {
      metrics.performance.avgResponseTime = responseTime;
    } else {
      const sum = metrics.performance.responseTimeHistory.reduce((a, b) => a + b, 0);
      metrics.performance.avgResponseTime = sum / metrics.performance.responseTimeHistory.length;
    }
    
    // Track status
    if (res.statusCode >= 200 && res.statusCode < 300) {
      metrics.requests.success++;
    } else {
      metrics.requests.error++;
    }
    
    metrics.requests.byStatus[res.statusCode] = (metrics.requests.byStatus[res.statusCode] || 0) + 1;
    
    // Track tool usage
    if (req.body && req.body.method === 'tools/call' && req.body.params?.name) {
      const toolName = req.body.params.name;
      metrics.requests.byTool[toolName] = (metrics.requests.byTool[toolName] || 0) + 1;
    }
    
    logger.debug(`${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms`);
    
    return originalJson.call(this, body);
  };
  
  next();
}

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  logger.debug(`Incoming ${req.method} ${req.path}`, {
    headers: req.headers,
    body: req.body ? JSON.stringify(req.body).substring(0, 200) : undefined
  });
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
}

export function securityMiddleware(req: Request, res: Response, next: NextFunction) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // API key validation for production
  if (process.env.NODE_ENV === 'production' && process.env.MCP_API_KEY) {
    const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (providedKey !== process.env.MCP_API_KEY) {
      return res.status(401).json({
        jsonrpc: "2.0",
        id: req.body?.id || null,
        error: {
          code: -32000,
          message: "Unauthorized - Invalid API key"
        }
      });
    }
  }
  
  next();
}

export function errorHandlingMiddleware(error: Error, req: Request, res: Response, next: NextFunction) {
  logger.error('Unhandled error in middleware:', error);
  
  metrics.requests.error++;
  
  const errorResponse = {
    jsonrpc: "2.0",
    id: req.body?.id || null,
    error: {
      code: -32603,
      message: "Internal server error",
      data: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
  };
  
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json(errorResponse);
}

export function getMetrics(): Metrics & { uptimeSeconds: number } {
  return {
    ...metrics,
    uptimeSeconds: Math.floor((Date.now() - metrics.uptime) / 1000)
  };
}

export function updateSessionMetrics(activeCount: number, totalCount: number) {
  metrics.sessions.active = activeCount;
  metrics.sessions.total = totalCount;
}