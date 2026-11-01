import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';

import { systemRoutes } from './routes/system.routes';
import { authRoutes } from './routes/auth.routes';
import { enquiryRoutes } from './routes/enquiry.routes';
import {
  adminCategoryRoutes,
  adminServiceRoutes,
  adminUploadRoutes,
  publicCategoryRoutes,
  publicServiceRoutes,
} from './routes/catalogue.routes';

export async function setupPlugins(app: FastifyInstance) {
  // ── Security headers ──────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // ── CORS ─────────────────────────────────────────────────
  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
    credentials: true,
  });

  // ── Cookies ───────────────────────────────────────────────
  await app.register(cookie, {
    secret: env.COOKIE_SECRET ?? env.JWT_SECRET,
  });

  // ── Rate limiting ────────────────────────────────────────
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    errorResponseBuilder: (_request, context) => ({
      success: false,
      message: `Too many requests — please wait ${Math.ceil(context.ttl / 1000)}s`,
      error: { code: 'RATE_LIMIT_EXCEEDED' },
    }),
  });

  // ── Multipart (file uploads) ─────────────────────────────
  await app.register(multipart, {
    limits: {
      fileSize: parseInt(env.MAX_FILE_SIZE, 10),
      files: 10,
      fieldSize: 1024 * 1024,
    },
  });

  // ── Swagger / OpenAPI ────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'WeFixHomes API',
        description: 'Painting and home repair services API.',
        version: '1.0.0',
        contact: { name: 'WeFixHomes', email: 'noreply@wefixhomes.in' },
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Obtain token via POST /api/v1/auth/login',
          },
        },
      },
      tags: [
        { name: 'Auth', description: 'Authentication and session management' },
        { name: 'Enquiries', description: 'Public estimate requests and admin follow-up' },
        { name: 'Service catalogue', description: 'Public and admin home-service catalogue' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: true,
    },
    staticCSP: true,
  });

  // ── Hooks ─────────────────────────────────────────────────
  app.addHook('onRequest', requestLogger);
  app.setErrorHandler(errorHandler);
}

export async function setupRoutes(app: FastifyInstance) {
  // ── Health & readiness ────────────────────────────────────
  await app.register(systemRoutes);

  // ── API routes ────────────────────────────────────────────
  const prefix = env.API_PREFIX;

  await app.register(authRoutes, { prefix: `${prefix}/auth` });
  await app.register(enquiryRoutes, { prefix: `${prefix}/enquiries` });
  await app.register(publicCategoryRoutes, { prefix: `${prefix}/service-categories` });
  await app.register(publicServiceRoutes, { prefix: `${prefix}/services` });
  await app.register(adminCategoryRoutes, { prefix: `${prefix}/admin/service-categories` });
  await app.register(adminServiceRoutes, { prefix: `${prefix}/admin/services` });
  await app.register(adminUploadRoutes, { prefix: `${prefix}/admin/uploads` });
}
