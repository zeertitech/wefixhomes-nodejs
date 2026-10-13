import { FastifyInstance } from 'fastify';
import { authController } from '../controllers/auth.controller';
import { accountController } from '../controllers/account.controller';
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

  app.post('/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Logout current session',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate],
    handler: authController.logout.bind(authController),
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

  // Self-service account. Identity comes from the session, never from the URL.
  // Password login and a future OAuth callback both land on these same cookies.
  app.get('/me/orders', {
    schema: { tags: ['Account'], summary: 'List my orders', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: accountController.orders.bind(accountController),
  });

  app.get('/me/addresses', {
    schema: { tags: ['Account'], summary: 'List my addresses', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: accountController.addresses.bind(accountController),
  });

  app.post('/me/addresses', {
    schema: { tags: ['Account'], summary: 'Add an address', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: accountController.addAddress.bind(accountController),
  });

  app.patch<{ Params: { addressId: string } }>('/me/addresses/:addressId', {
    schema: { tags: ['Account'], summary: 'Update my address', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: accountController.updateAddress.bind(accountController),
  });

  app.delete<{ Params: { addressId: string } }>('/me/addresses/:addressId', {
    schema: { tags: ['Account'], summary: 'Delete my address', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate],
    handler: accountController.deleteAddress.bind(accountController),
  });
}
