import { FastifyInstance } from 'fastify';
import { shipmentController } from '../controllers/shipment.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

export async function shipmentRoutes(app: FastifyInstance): Promise<void> {
  // Create shipment via Shiprocket
  app.post<{ Params: { orderId: string } }>('/orders/:orderId', {
    schema: {
      tags: ['Shipments'],
      summary: 'Create Shiprocket shipment for an order',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: shipmentController.create.bind(shipmentController),
  });

  // Get shipment details for an order
  app.get<{ Params: { orderId: string } }>('/orders/:orderId', {
    schema: {
      tags: ['Shipments'],
      summary: 'Get shipment details for an order',
    },
    handler: shipmentController.getByOrder.bind(shipmentController),
  });

  // Track shipment by AWB
  app.get<{ Params: { orderId: string } }>('/orders/:orderId/track', {
    schema: {
      tags: ['Shipments'],
      summary: 'Track shipment via Shiprocket',
    },
    handler: shipmentController.track.bind(shipmentController),
  });
}
