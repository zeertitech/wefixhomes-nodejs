import { FastifyInstance } from 'fastify';
import { orderController } from '../controllers/order.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  // Create order — called from frontend checkout (no auth needed if guest checkout)
  app.post('/', {
    schema: {
      tags: ['Orders'],
      summary: 'Create order from cart',
      body: {
        type: 'object',
        required: ['customerId', 'addressId', 'cartId'],
        properties: {
          customerId: { type: 'string' },
          addressId: { type: 'string' },
          cartId: { type: 'string' },
          couponCode: { type: 'string' },
          notes: { type: 'string' },
          idempotencyKey: { type: 'string', format: 'uuid' },
        },
      },
    },
    handler: orderController.create.bind(orderController),
  });

  // Admin — list all orders
  app.get('/', {
    schema: {
      tags: ['Orders'],
      summary: 'List all orders (admin/staff)',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: orderController.list.bind(orderController),
  });

  // Get single order — publicly accessible (for order tracking by customers)
  app.get<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Orders'],
      summary: 'Get order by ID',
    },
    handler: orderController.getById.bind(orderController),
  });

  // Admin — update order status
  app.patch<{ Params: { id: string } }>('/:id/status', {
    schema: {
      tags: ['Orders'],
      summary: 'Update order status',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'FAILED', 'REFUNDED'],
          },
          reason: { type: 'string' },
        },
      },
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: orderController.updateStatus.bind(orderController),
  });
}
