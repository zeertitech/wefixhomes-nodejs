import { FastifyInstance } from 'fastify';
import { paymentController } from '../controllers/payment.controller';
import { authenticate } from '../middlewares/authenticate';

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  // Create Razorpay order for an existing app order
  app.post<{ Params: { orderId: string } }>('/orders/:orderId', {
    schema: {
      tags: ['Payments'],
      summary: 'Create Razorpay payment order',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate],
    handler: paymentController.createOrder.bind(paymentController),
  });

  // Razorpay webhook — must NOT require auth (Razorpay sends it)
  app.post('/webhook/razorpay', {
    schema: {
      tags: ['Payments'],
      summary: 'Razorpay webhook receiver (do not call directly)',
    },
    config: { rawBody: true }, // handled by src/types/fastify.d.ts
    handler: paymentController.webhook.bind(paymentController),
  });
}
