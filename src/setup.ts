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
import { productRoutes } from './routes/product.routes';
import { categoryRoutes } from './routes/category.routes';
import { publicCategoryRoutes } from './routes/public-category.routes';
import { publicProductRoutes } from './routes/public-product.routes';
import { cartRoutes } from './routes/cart.routes';
import { orderRoutes } from './routes/order.routes';
import { paymentRoutes } from './routes/payment.routes';
import { shipmentRoutes } from './routes/shipment.routes';
import { inventoryRoutes } from './routes/inventory.routes';

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
        title: 'Fashion E-Commerce API',
        description:
          'Production-grade single-vendor fashion e-commerce backend.\n\n' +
          '**Default admin credentials (after seeding):**\n' +
          '- Email: `admin@fashionstore.com`\n' +
          '- Password: `Admin@123`',
        version: '1.0.0',
        contact: { name: 'API Support', email: 'dev@fashionstore.com' },
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
        { name: 'Auth', description: 'Authentication & session management' },
        { name: 'Products', description: 'Product & variant management' },
        { name: 'Categories', description: 'Category hierarchy management' },
        { name: 'Public Categories', description: 'Public storefront category endpoints' },
        { name: 'Public Products', description: 'Public storefront product listing and filters' },
        { name: 'Users', description: 'User & address management' },
        { name: 'Cart', description: 'Shopping cart (guest + authenticated)' },
        { name: 'Orders', description: 'Order lifecycle management' },
        { name: 'Payments', description: 'Razorpay payment processing' },
        { name: 'Shipments', description: 'Shiprocket shipping integration' },
        { name: 'Inventory', description: 'Stock & inventory management' },
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

  await app.register(authRoutes,            { prefix: `${prefix}/auth` });
  await app.register(productRoutes,         { prefix: `${prefix}/products` });
  await app.register(categoryRoutes,        { prefix: `${prefix}/categories` });
  await app.register(publicCategoryRoutes,  { prefix: `${prefix}/public/categories` });
  await app.register(publicCategoryRoutes,  { prefix: `/v1/public/categories` });
  await app.register(publicProductRoutes,   { prefix: `${prefix}/public/products` });
  await app.register(publicProductRoutes,   { prefix: `/v1/public/products` });
  await app.register(cartRoutes,            { prefix: `${prefix}/cart` });
  await app.register(orderRoutes,           { prefix: `${prefix}/orders` });
  await app.register(paymentRoutes,         { prefix: `${prefix}/payments` });
  await app.register(shipmentRoutes,        { prefix: `${prefix}/shipments` });
  await app.register(inventoryRoutes,       { prefix: `${prefix}/inventory` });
}
