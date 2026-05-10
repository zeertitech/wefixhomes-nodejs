import { FastifyInstance } from 'fastify';
import { inventoryController } from '../controllers/inventory.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  // Low stock alert list
  app.get('/low-stock', {
    schema: {
      tags: ['Inventory'],
      summary: 'List variants at or below their low-stock threshold',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: inventoryController.listLowStock.bind(inventoryController),
  });

  // Get inventory for a specific variant
  app.get<{ Params: { variantId: string } }>('/variants/:variantId', {
    schema: {
      tags: ['Inventory'],
      summary: 'Get inventory record for a variant',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: inventoryController.getByVariant.bind(inventoryController),
  });

  // Update stock quantity
  app.patch<{ Params: { variantId: string } }>('/variants/:variantId', {
    schema: {
      tags: ['Inventory'],
      summary: 'Update stock quantity for a variant',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: { type: 'number', minimum: 0 },
          lowStockAt: { type: 'number', minimum: 0 },
        },
      },
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: inventoryController.update.bind(inventoryController),
  });
}
