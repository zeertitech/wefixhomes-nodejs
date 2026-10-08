import { FastifyInstance } from 'fastify';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/authenticate';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Staff/Admin registration',
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
    },
    handler: authController.register.bind(authController),
  });

  app.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Admin login',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
      },
    },
    handler: authController.login.bind(authController),
  });

  app.post('/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token (via cookie or request body)',
      body: {
        type: 'object',
        properties: { refreshToken: { type: 'string' } },
      },
    },
    handler: authController.refresh.bind(authController),
  });

  app.get('/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Logout current session',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate],
    handler: authController.logout.bind(authController),
  });

  app.post('/logout-all', {
    schema: {
      tags: ['Auth'],
      summary: 'Logout all sessions',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate],
    handler: authController.logoutAll.bind(authController),
  });

  app.get('/me', {
    schema: {
      tags: ['Auth'],
      summary: 'Get current user info',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate],
    handler: authController.me.bind(authController),
  });
}
