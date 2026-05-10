import { FastifyInstance } from 'fastify';
import { cartController } from '../controllers/cart.controller';

export async function cartRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    schema: {
      tags: ['Cart'],
      summary: 'Get or create cart',
      description: 'Pass ?userId=xxx for logged-in users or ?sessionId=xxx for guests',
    },
    handler: cartController.getCart.bind(cartController),
  });

  app.post('/:cartId/items', {
    schema: {
      tags: ['Cart'],
      summary: 'Add item to cart',
      body: {
        type: 'object',
        required: ['variantId', 'quantity'],
        properties: {
          variantId: { type: 'string' },
          quantity: { type: 'number', minimum: 1, maximum: 10 },
        },
      },
    },
    handler: cartController.addItem.bind(cartController),
  });

  app.patch('/:cartId/items/:variantId', {
    schema: {
      tags: ['Cart'],
      summary: 'Update item quantity (set to 0 to remove)',
      body: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: { type: 'number', minimum: 0, maximum: 10 },
        },
      },
    },
    handler: cartController.updateItem.bind(cartController),
  });

  app.delete('/:cartId/items/:variantId', {
    schema: { tags: ['Cart'], summary: 'Remove item from cart' },
    handler: cartController.removeItem.bind(cartController),
  });

  app.post('/merge', {
    schema: {
      tags: ['Cart'],
      summary: 'Merge guest cart into user cart after login',
      body: {
        type: 'object',
        required: ['sessionId', 'userId'],
        properties: {
          sessionId: { type: 'string' },
          userId: { type: 'string' },
        },
      },
    },
    handler: cartController.merge.bind(cartController),
  });
}
