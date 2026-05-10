import { OrderStatus } from '@prisma/client';
import { prisma } from '../config/prisma';

const orderWithFull = {
  user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
  address: true,
  coupon: { select: { code: true, discountType: true, discountValue: true } },
  items: {
    include: {
      variant: {
        include: {
          attributes: {
            include: { attributeValue: { include: { attribute: true } } },
          },
        },
      },
    },
  },
  payment: true,
  shipment: true,
} as const;

export class OrderRepository {
  async findById(id: string) {
    return prisma.order.findUnique({ where: { id }, include: orderWithFull });
  }

  async findByOrderNumber(orderNumber: string) {
    return prisma.order.findUnique({ where: { orderNumber }, include: orderWithFull });
  }

  async findByIdempotencyKey(key: string) {
    return prisma.order.findUnique({ where: { idempotencyKey: key } });
  }

  async updateStatus(id: string, status: OrderStatus): Promise<void> {
    await prisma.order.update({ where: { id }, data: { status } });
  }
}

export const orderRepository = new OrderRepository();
