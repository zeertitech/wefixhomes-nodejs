import { cartRepository } from '../repositories/cart.repository';
import { prisma } from '../config/prisma';
import { NotFoundError, BusinessError } from '../lib/errors';
import { smsService } from './sms.service';
import type { AddToCartInput, UpdateCartItemInput } from '../validators/cart.validator';

export class CartService {
  async getOrCreateCart(userId?: string, sessionId?: string) {
    if (userId !== undefined) {
      const existing = await cartRepository.findByUserId(userId);
      if (existing) return existing;
      return cartRepository.create({ userId });
    }

    if (sessionId !== undefined) {
      const existing = await cartRepository.findBySessionId(sessionId);
      if (existing) return existing;
      return cartRepository.create({ sessionId });
    }

    // Anonymous cart (no session either — creates a new one)
    return cartRepository.create({});
  }

  async addItem(cartId: string, input: AddToCartInput) {
    // Validate cart exists
    const cart = await cartRepository.findById(cartId);
    if (!cart) throw new NotFoundError('Cart');

    // Validate variant exists and is active
    const variant = await prisma.productVariant.findFirst({
      where: { id: input.variantId, isActive: true, deletedAt: null },
      include: {
        inventory: true,
        product: { select: { isActive: true, deletedAt: true } },
      },
    });

    if (!variant || !variant.product.isActive || variant.product.deletedAt !== null) {
      throw new NotFoundError('Product variant');
    }

    // Stock check
    const available =
      (variant.inventory?.quantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0);

    if (available < input.quantity) {
      throw new BusinessError(
        `Only ${available} unit(s) available for this variant`
      );
    }

    await cartRepository.upsertItem(cartId, input.variantId, input.quantity, Number(variant.price));
    return cartRepository.findById(cartId);
  }

  async updateItem(cartId: string, variantId: string, input: UpdateCartItemInput) {
    const cart = await cartRepository.findById(cartId);
    if (!cart) throw new NotFoundError('Cart');

    if (input.quantity === 0) {
      await cartRepository.deleteItem(cartId, variantId);
      return cartRepository.findById(cartId);
    }

    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, isActive: true, deletedAt: null },
      include: { inventory: true },
    });

    if (!variant) throw new NotFoundError('Product variant');

    const available =
      (variant.inventory?.quantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0);

    if (available < input.quantity) {
      throw new BusinessError(`Only ${available} unit(s) available`);
    }

    await cartRepository.upsertItem(cartId, variantId, input.quantity, Number(variant.price));
    return cartRepository.findById(cartId);
  }

  async removeItem(cartId: string, variantId: string) {
    const cart = await cartRepository.findById(cartId);
    if (!cart) throw new NotFoundError('Cart');

    await cartRepository.deleteItem(cartId, variantId);
    return cartRepository.findById(cartId);
  }

  async mergeGuestCart(sessionId: string, userId: string): Promise<void> {
    const guestCart = await cartRepository.findBySessionId(sessionId);
    if (!guestCart || guestCart.items.length === 0) return;

    let userCart = await cartRepository.findByUserId(userId);
    if (!userCart) {
      userCart = await cartRepository.create({ userId });
    }

    for (const item of guestCart.items) {
      const variant = await prisma.productVariant.findFirst({
        where: { id: item.variantId, isActive: true, deletedAt: null },
        include: { inventory: true },
      });

      if (!variant) continue;

      const available =
        (variant.inventory?.quantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0);
      const qty = Math.min(item.quantity, available);
      if (qty <= 0) continue;

      await cartRepository.upsertItem(
        userCart.id,
        item.variantId,
        qty,
        Number(item.price)
      );
    }

    // Clear guest cart after merge
    await cartRepository.clearItems(guestCart.id);
  }

  async processAbandonedCarts(): Promise<void> {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    const carts = await cartRepository.findAbandonedCarts(cutoff);

    for (const cart of carts) {
      if (cart.user?.phone) {
        await smsService.sendAbandonedCartReminder(cart.user.phone).catch(() => {});
      }
    }
  }
}

export const cartService = new CartService();
