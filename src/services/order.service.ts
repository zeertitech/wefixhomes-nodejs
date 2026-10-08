import { prisma } from '../config/prisma';
import { orderRepository } from '../repositories/order.repository';
import { cartRepository } from '../repositories/cart.repository';
import { NotFoundError, BusinessError } from '../lib/errors';
import { generateOrderNumber } from '../utils/orderNumber';
import { getPaginationParams } from '../utils/pagination';
import { smsService } from './sms.service';
import { auditService } from './audit.service';
import type { CreateOrderInput, UpdateOrderStatusInput } from '../validators/order.validator';
import type { PaginationInput } from '../utils/pagination';

export class OrderService {
  async create(input: CreateOrderInput, adminId: string) {
    // Idempotency check
    if (input.idempotencyKey !== undefined) {
      const existing = await orderRepository.findByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
    }

    const cart = await cartRepository.findById(input.cartId);
    if (!cart || cart.items.length === 0) {
      throw new BusinessError('Cart is empty or not found');
    }

    const order = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      let taxAmount = 0;
      const orderItems = [];

      for (const item of cart.items) {
        // Lock inventory row and check stock
        const inventory = await tx.inventory.findUnique({
          where: { variantId: item.variantId },
        });

        const available = (inventory?.quantity ?? 0) - (inventory?.reservedQuantity ?? 0);

        if (available < item.quantity) {
          throw new BusinessError(
            `Insufficient stock for SKU: ${item.variant.sku}. Available: ${available}`
          );
        }

        const itemSubtotal = Number(item.price) * item.quantity;
        const taxRate = Number(item.variant.product.taxRate);
        const itemTax = (itemSubtotal * taxRate) / 100;

        subtotal += itemSubtotal;
        taxAmount += itemTax;

        orderItems.push({
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.price,
          taxRate: item.variant.product.taxRate,
          totalPrice: itemSubtotal + itemTax,
          snapshotName: item.variant.product.name,
          snapshotSku: item.variant.sku,
        });

        // Reserve stock immediately
        await tx.inventory.update({
          where: { variantId: item.variantId },
          data: { reservedQuantity: { increment: item.quantity } },
        });
      }

      // Apply coupon if provided
      let discountAmount = 0;
      let couponId: string | null = null;

      if (input.couponCode !== undefined) {
        const coupon = await tx.coupon.findUnique({
          where: { code: input.couponCode, isActive: true },
        });

        if (
          coupon &&
          (coupon.expiresAt === null || coupon.expiresAt > new Date()) &&
          (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit) &&
          (coupon.minOrderAmount === null || subtotal >= Number(coupon.minOrderAmount))
        ) {
          discountAmount =
            coupon.discountType === 'PERCENTAGE'
              ? (subtotal * Number(coupon.discountValue)) / 100
              : Number(coupon.discountValue);

          if (coupon.maxDiscount !== null) {
            discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
          }

          couponId = coupon.id;
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }

      const total = Math.max(0, subtotal + taxAmount - discountAmount);

      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: input.userId,
          addressId: input.addressId,
          ...(couponId !== null && { couponId }),
          subtotal,
          taxAmount,
          discountAmount,
          total,
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
          items: { create: orderItems },
        },
        include: {
          items: true,
          user: { select: { phone: true, firstName: true, email: true } },
          address: true,
        },
      });

      // Clear cart items after order is placed
      await tx.cartItem.deleteMany({ where: { cartId: input.cartId } });

      return created;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    await auditService.log('order', order.id, 'CREATE', null, { orderNumber: order.orderNumber, total: order.total }, adminId);

    // Send confirmation SMS (fire-and-forget)
    if (order.user.phone) {
      smsService.sendOrderConfirmation(order.user.phone, order.orderNumber).catch(() => {});
    }

    return order;
  }

  async getById(id: string) {
    const order = await orderRepository.findById(id);
    if (!order) throw new NotFoundError('Order');
    return order;
  }

  async list(pagination: PaginationInput) {
    const { skip, take } = getPaginationParams(pagination);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        skip,
        take,
        orderBy: { createdAt: pagination.order },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          items: { select: { quantity: true, snapshotName: true, totalPrice: true } },
          payment: { select: { status: true, method: true } },
          shipment: { select: { status: true, awbCode: true } },
        },
      }),
      prisma.order.count(),
    ]);

    return { orders, total };
  }

  async updateStatus(id: string, input: UpdateOrderStatusInput, adminId: string): Promise<void> {
    const order = await orderRepository.findById(id);
    if (!order) throw new NotFoundError('Order');

    const oldStatus = order.status;
    await orderRepository.updateStatus(id, input.status);

    // Release reserved stock on cancellation or failure
    if (input.status === 'CANCELLED' || input.status === 'FAILED') {
      for (const item of order.items) {
        await prisma.inventory.update({
          where: { variantId: item.variantId },
          data: { reservedQuantity: { decrement: item.quantity } },
        });
      }
    }

    await auditService.log(
      'order',
      id,
      'STATUS_UPDATE',
      { status: oldStatus },
      { status: input.status, reason: input.reason },
      adminId
    );
  }
}

export const orderService = new OrderService();
