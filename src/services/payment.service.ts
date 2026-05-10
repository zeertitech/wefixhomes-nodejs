import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { NotFoundError, BusinessError } from '../lib/errors';
import { logger } from '../config/logger';

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

interface RazorpayWebhookEvent {
  event: string;
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
        status: string;
        error_description?: string;
      };
    };
  };
}

export class PaymentService {
  async createRazorpayOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) throw new NotFoundError('Order');

    if (order.payment?.status === 'COMPLETED') {
      throw new BusinessError('This order has already been paid');
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(Number(order.total) * 100), // paise
      currency: 'INR',
      receipt: order.orderNumber,
    });

    await prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        razorpayOrderId: razorpayOrder.id,
        amount: order.total,
        status: 'PENDING',
        method: 'RAZORPAY',
      },
      update: {
        razorpayOrderId: razorpayOrder.id,
        status: 'PENDING',
      },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PAYMENT_PENDING' },
    });

    return {
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: env.RAZORPAY_KEY_ID,
      orderNumber: order.orderNumber,
    };
  }

  async verifyWebhook(rawBody: string, signature: string): Promise<void> {
    // Verify HMAC signature
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      logger.warn('Razorpay webhook: invalid signature');
      throw new BusinessError('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody) as RazorpayWebhookEvent;
    const entity = event.payload.payment.entity;

    logger.info('Razorpay webhook received', { event: event.event, paymentId: entity.id });

    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId: entity.order_id },
    });

    if (!payment) {
      logger.warn('Razorpay webhook: payment not found', { razorpayOrderId: entity.order_id });
      return;
    }

    if (event.event === 'payment.captured') {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            razorpayPaymentId: entity.id,
            status: 'COMPLETED',
          },
        });

        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID' },
        });

        // Deduct reserved stock → actual deduction
        const order = await tx.order.findUnique({
          where: { id: payment.orderId },
          include: { items: true },
        });

        if (order) {
          for (const item of order.items) {
            await tx.inventory.update({
              where: { variantId: item.variantId },
              data: {
                quantity: { decrement: item.quantity },
                reservedQuantity: { decrement: item.quantity },
              },
            });
          }
        }
      });

      logger.info('Payment captured', { orderId: payment.orderId, paymentId: entity.id });
    } else if (event.event === 'payment.failed') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          failureReason: entity.error_description,
        },
      });

      await prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'FAILED' },
      });

      // Release reserved stock
      const order = await prisma.order.findUnique({
        where: { id: payment.orderId },
        include: { items: true },
      });

      if (order) {
        for (const item of order.items) {
          await prisma.inventory.update({
            where: { variantId: item.variantId },
            data: { reservedQuantity: { decrement: item.quantity } },
          });
        }
      }

      logger.warn('Payment failed', { orderId: payment.orderId, reason: entity.error_description });
    }
  }
}

export const paymentService = new PaymentService();
