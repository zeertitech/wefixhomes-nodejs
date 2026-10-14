import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { BusinessError, NotFoundError } from '../lib/errors';
import type { CreateAddressInput } from '../validators/customer.validator';

const MAX_ADDRESSES = 10;

function money(value: Prisma.Decimal | number | string) {
  return Number(value);
}

/**
 * Customer self-service. Every query is scoped to the JWT user id.
 * Callers must never pass a user id from the request body or URL.
 */
export class AccountService {
  async listOrders(userId: string) {
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        items: {
          select: { quantity: true, snapshotName: true, totalPrice: true },
        },
        payment: { select: { status: true, method: true } },
        shipment: { select: { status: true } },
        address: { select: { name: true, phone: true, city: true, state: true, pincode: true } },
      },
    });

    return orders.map((order) => ({
      ...order,
      total: money(order.total),
      items: order.items.map((item) => ({
        ...item,
        totalPrice: money(item.totalPrice),
      })),
    }));
  }

  async listAddresses(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async addAddress(userId: string, input: CreateAddressInput) {
    const count = await prisma.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) {
      throw new BusinessError(`You can save up to ${MAX_ADDRESSES} addresses`);
    }

    return prisma.$transaction(async (tx) => {
      if (input.isDefault || count === 0) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: { ...input, isDefault: input.isDefault || count === 0, userId },
      });
    });
  }

  async updateAddress(userId: string, addressId: string, input: Partial<CreateAddressInput>) {
    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!existing) throw new NotFoundError('Address');

    return prisma.$transaction(async (tx) => {
      if (input.isDefault === true) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: addressId },
        data: input,
      });
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!existing) throw new NotFoundError('Address');

    try {
      await prisma.address.delete({ where: { id: addressId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new BusinessError('This address is linked to an order and cannot be deleted');
      }
      throw err;
    }
  }
}

export const accountService = new AccountService();
