import { FastifyRequest, FastifyReply } from 'fastify';
import { paymentService } from '../services/payment.service';
import { sendSuccess } from '../lib/response';

export class PaymentController {
  async createOrder(
    request: FastifyRequest<{ Params: { orderId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await paymentService.createRazorpayOrder(request.params.orderId);
    sendSuccess(reply, result, 'Razorpay order created');
  }

  async webhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const signature = request.headers['x-razorpay-signature'];
    if (typeof signature !== 'string') {
      void reply.status(400).send({ error: 'Missing signature header' });
      return;
    }

    // Use raw body string for HMAC verification
    const rawBody = JSON.stringify(request.body);
    await paymentService.verifyWebhook(rawBody, signature);
    void reply.status(200).send({ status: 'ok' });
  }
}

export const paymentController = new PaymentController();
