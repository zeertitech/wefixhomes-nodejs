import { FastifyInstance } from 'fastify';
import { cartController } from '../controllers/cart.controller';
import { authenticate, optionalAuthenticate } from '../middlewares/authenticate';

export async function cartRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    schema: {
      tags: ['Cart'],
      summary: 'Get or create the current cart',
      description:
        'Logged-in shoppers are resolved from the session cookie. Guests receive an httpOnly cart session. Client-supplied user or cart ids are ignored.',
    },
    preHandler: [optionalAuthenticate],
    handler: cartController.getCart.bind(cartController),
  });

  app.post('/items', {
    schema: {
      tags: ['Cart'],
      summary: 'Add item to the current cart',
      body: {
        type: 'object',
        required: ['variantId', 'quantity'],
        properties: {
          variantId: { type: 'string' },
          quantity: { type: 'number', minimum: 1, maximum: 10 },
        },
      },
    },
    preHandler: [optionalAuthenticate],
    handler: cartController.addItem.bind(cartController),
  });

  app.patch<{ Params: { variantId: string } }>('/items/:variantId', {
    schema: {
      tags: ['Cart'],
      summary: 'Set item quantity on the current cart (0 removes it)',
      body: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: { type: 'number', minimum: 0, maximum: 10 },
        },
      },
    },
    preHandler: [optionalAuthenticate],
    handler: cartController.updateItem.bind(cartController),
  });

  app.delete<{ Params: { variantId: string } }>('/items/:variantId', {
    schema: { tags: ['Cart'], summary: 'Remove item from the current cart' },
    preHandler: [optionalAuthenticate],
    handler: cartController.removeItem.bind(cartController),
  });

  app.post('/merge', {
    schema: {
      tags: ['Cart'],
      summary: 'Merge the guest cart cookie into the logged-in shopper cart',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate],
    handler: cartController.merge.bind(cartController),
  });
}
