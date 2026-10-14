import { randomBytes } from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { cartRepository } from '../repositories/cart.repository';
import { prisma } from '../config/prisma';
import { NotFoundError, BusinessError } from '../lib/errors';
import { smsService } from './sms.service';
import { COOKIE_NAMES, setCartSessionCookie } from '../utils/cookie';
import {
  FREE_SHIPPING_THRESHOLD,
  MAX_CART_QUANTITY,
  roundMoney,
  shippingAmountFor,
} from '../lib/commerce';
import type { AddToCartInput, UpdateCartItemInput } from '../validators/cart.validator';
import { formatProductImageUrl } from '../controllers/public-product.controller';

const CART_SESSION_PATTERN = /^[a-f0-9]{64}$/;

type CartRecord = NonNullable<Awaited<ReturnType<typeof cartRepository.findById>>>;

function availableStock(inventory: { quantity: number; reservedQuantity: number } | null | undefined) {
  return (inventory?.quantity ?? 0) - (inventory?.reservedQuantity ?? 0);
}

export function presentCart(cart: CartRecord) {
  const items = cart.items.map((item) => {
    const unitPrice = roundMoney(Number(item.variant.price));
    const lineTotal = roundMoney(unitPrice * item.quantity);
    return {
      id: item.id,
      cartId: item.cartId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
      available: Math.max(0, availableStock(item.variant.inventory)),
      variant: {
        id: item.variant.id,
        sku: item.variant.sku,
        price: unitPrice,
        comparePrice:
          item.variant.comparePrice != null ? roundMoney(Number(item.variant.comparePrice)) : null,
        size: item.variant.size ? { id: item.variant.size.id, value: item.variant.size.value } : null,
        inventory: item.variant.inventory,
        attributes: item.variant.attributes,
        product: {
          id: item.variant.product.id,
          name: item.variant.product.name,
          slug: item.variant.product.slug,
          images: item.variant.product.images.map((image) => ({
            ...image,
            url: formatProductImageUrl(image.url),
          })),
          color: item.variant.product.color
            ? { id: item.variant.product.color.id, value: item.variant.product.color.value }
            : null,
        },
      },
    };
  });

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const shippingAmount = shippingAmountFor(subtotal);

  return {
    id: cart.id,
    userId: cart.userId,
    items,
    summary: {
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      shippingAmount,
      total: roundMoney(subtotal + shippingAmount),
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      currency: 'INR' as const,
    },
    updatedAt: cart.updatedAt,
  };
}

export class CartService {
  /**
   * Logged-in shoppers are bound to the JWT user.
   * Guests receive an httpOnly session cookie. Query/body ids are ignored.
   */
  async resolveForRequest(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.userId) {
      return this.loadPricedCart(await this.getOrCreateUserCart(request.user.userId));
    }

    const existing = request.cookies?.[COOKIE_NAMES.CART_SESSION];
    const sessionId =
      existing && CART_SESSION_PATTERN.test(existing)
        ? existing
        : randomBytes(32).toString('hex');

    if (sessionId !== existing) {
      setCartSessionCookie(reply, sessionId);
    }

    return this.loadPricedCart(await this.getOrCreateSessionCart(sessionId));
  }

  async getOrCreateUserCart(userId: string) {
    const existing = await cartRepository.findByUserId(userId);
    if (existing) return existing;
    return cartRepository.create({ userId });
  }

  async getOrCreateSessionCart(sessionId: string) {
    const existing = await cartRepository.findBySessionId(sessionId);
    if (existing) return existing;
    return cartRepository.create({ sessionId });
  }

  private async loadPricedCart(cart: CartRecord) {
    await this.refreshStoredPrices(cart);
    const fresh = await cartRepository.findById(cart.id);
    if (!fresh) throw new NotFoundError('Cart');
    return presentCart(fresh);
  }

  private async refreshStoredPrices(cart: CartRecord) {
    const stale = cart.items.filter(
      (item) => Number(item.price) !== Number(item.variant.price)
    );
    if (stale.length === 0) return;

    await prisma.$transaction(
      stale.map((item) =>
        prisma.cartItem.update({
          where: { id: item.id },
          data: { price: item.variant.price },
        })
      )
    );
  }

  private async loadVariant(variantId: string) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, isActive: true, deletedAt: null },
      include: {
        inventory: true,
        product: { select: { isActive: true, deletedAt: true, name: true } },
      },
    });

    if (!variant || !variant.product.isActive || variant.product.deletedAt !== null) {
      throw new NotFoundError('Product variant');
    }

    return variant;
  }

  async addItem(cartId: string, input: AddToCartInput) {
    const cart = await cartRepository.findById(cartId);
    if (!cart) throw new NotFoundError('Cart');

    const variant = await this.loadVariant(input.variantId);
    const available = availableStock(variant.inventory);
    const existingQty = cart.items.find((item) => item.variantId === input.variantId)?.quantity ?? 0;
    const nextQty = existingQty + input.quantity;

    if (nextQty > MAX_CART_QUANTITY) {
      throw new BusinessError(`You can add at most ${MAX_CART_QUANTITY} of this piece`);
    }

    if (available < nextQty) {
      throw new BusinessError(
        available <= 0
          ? 'This piece is out of stock'
          : `Only ${available} unit(s) available`
      );
    }

    await cartRepository.upsertItem(cartId, input.variantId, nextQty, Number(variant.price));
    return this.loadPricedCart(await cartRepository.findById(cartId) as CartRecord);
  }

  async updateItem(cartId: string, variantId: string, input: UpdateCartItemInput) {
    const cart = await cartRepository.findById(cartId);
    if (!cart) throw new NotFoundError('Cart');

    if (input.quantity === 0) {
      await cartRepository.deleteItem(cartId, variantId);
      const fresh = await cartRepository.findById(cartId);
      if (!fresh) throw new NotFoundError('Cart');
      return presentCart(fresh);
    }

    const variant = await this.loadVariant(variantId);
    const available = availableStock(variant.inventory);

    if (available < input.quantity) {
      throw new BusinessError(
        available <= 0
          ? 'This piece is out of stock'
          : `Only ${available} unit(s) available`
      );
    }

    await cartRepository.upsertItem(cartId, variantId, input.quantity, Number(variant.price));
    return this.loadPricedCart(await cartRepository.findById(cartId) as CartRecord);
  }

  async removeItem(cartId: string, variantId: string) {
    const cart = await cartRepository.findById(cartId);
    if (!cart) throw new NotFoundError('Cart');

    await cartRepository.deleteItem(cartId, variantId);
    const fresh = await cartRepository.findById(cartId);
    if (!fresh) throw new NotFoundError('Cart');
    return presentCart(fresh);
  }

  async mergeGuestCart(sessionId: string, userId: string) {
    if (!CART_SESSION_PATTERN.test(sessionId)) return;

    const guestCart = await cartRepository.findBySessionId(sessionId);
    if (!guestCart || guestCart.items.length === 0) return;
    if (guestCart.userId === userId) return;

    const userCart = await this.getOrCreateUserCart(userId);

    for (const item of guestCart.items) {
      const variant = await prisma.productVariant.findFirst({
        where: { id: item.variantId, isActive: true, deletedAt: null },
        include: {
          inventory: true,
          product: { select: { isActive: true, deletedAt: true } },
        },
      });

      if (!variant || !variant.product.isActive || variant.product.deletedAt !== null) continue;

      const current = await cartRepository.findById(userCart.id);
      const already = current?.items.find((line) => line.variantId === item.variantId)?.quantity ?? 0;
      const available = availableStock(variant.inventory);
      const qty = Math.min(MAX_CART_QUANTITY, already + item.quantity, available);
      if (qty <= 0) continue;

      await cartRepository.upsertItem(userCart.id, item.variantId, qty, Number(variant.price));
    }

    await cartRepository.clearItems(guestCart.id);
  }

  async processAbandonedCarts(): Promise<void> {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const carts = await cartRepository.findAbandonedCarts(cutoff);

    for (const cart of carts) {
      if (cart.user?.phone) {
        await smsService.sendAbandonedCartReminder(cart.user.phone).catch(() => {});
      }
    }
  }
}

export const cartService = new CartService();
