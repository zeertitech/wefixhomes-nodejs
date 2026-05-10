import { prisma } from '../config/prisma';

const cartWithItems = {
  items: {
    include: {
      variant: {
        include: {
          product: {
            include: {
              images: { where: { isPrimary: true }, take: 1 },
            },
          },
          inventory: { select: { quantity: true, reservedQuantity: true } },
          attributes: {
            include: {
              attributeValue: {
                include: { attribute: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  },
} as const;

export class CartRepository {
  async findByUserId(userId: string) {
    return prisma.cart.findFirst({
      where: { userId },
      include: cartWithItems,
    });
  }

  async findBySessionId(sessionId: string) {
    return prisma.cart.findFirst({
      where: { sessionId },
      include: cartWithItems,
    });
  }

  async findById(id: string) {
    return prisma.cart.findUnique({
      where: { id },
      include: cartWithItems,
    });
  }

  async create(data: { userId?: string; sessionId?: string }) {
    return prisma.cart.create({
      data: {
        ...(data.userId !== undefined && { userId: data.userId }),
        ...(data.sessionId !== undefined && { sessionId: data.sessionId }),
      },
      include: cartWithItems,
    });
  }

  async touchActivity(cartId: string): Promise<void> {
    await prisma.cart.update({
      where: { id: cartId },
      data: { lastActivityAt: new Date() },
    });
  }

  async upsertItem(
    cartId: string,
    variantId: string,
    quantity: number,
    price: number
  ): Promise<void> {
    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId } },
      create: { cartId, variantId, quantity, price },
      update: { quantity, updatedAt: new Date() },
    });
    await this.touchActivity(cartId);
  }

  async deleteItem(cartId: string, variantId: string): Promise<void> {
    await prisma.cartItem.deleteMany({ where: { cartId, variantId } });
    await this.touchActivity(cartId);
  }

  async clearItems(cartId: string): Promise<void> {
    await prisma.cartItem.deleteMany({ where: { cartId } });
  }

  async findAbandonedCarts(cutoffDate: Date) {
    return prisma.cart.findMany({
      where: {
        lastActivityAt: { lt: cutoffDate },
        userId: { not: null },
        items: { some: {} },
      },
      include: {
        user: { select: { id: true, phone: true, firstName: true } },
        items: { take: 1 },
      },
    });
  }
}

export const cartRepository = new CartRepository();
