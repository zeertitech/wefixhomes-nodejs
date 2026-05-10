import { FastifyRequest, FastifyReply } from 'fastify';
import { cartService } from '../services/cart.service';
import {
  addToCartSchema,
  updateCartItemSchema,
  mergeCartSchema,
} from '../validators/cart.validator';
import { sendSuccess } from '../lib/response';

export class CartController {
  async getCart(
    request: FastifyRequest<{
      Querystring: { userId?: string; sessionId?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const cart = await cartService.getOrCreateCart(
      request.query.userId,
      request.query.sessionId
    );
    sendSuccess(reply, cart, 'Cart fetched');
  }

  async addItem(
    request: FastifyRequest<{ Params: { cartId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const input = addToCartSchema.parse(request.body);
    const cart = await cartService.addItem(request.params.cartId, input);
    sendSuccess(reply, cart, 'Item added to cart');
  }

  async updateItem(
    request: FastifyRequest<{ Params: { cartId: string; variantId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const input = updateCartItemSchema.parse(request.body);
    const cart = await cartService.updateItem(
      request.params.cartId,
      request.params.variantId,
      input
    );
    sendSuccess(reply, cart, 'Cart updated');
  }

  async removeItem(
    request: FastifyRequest<{ Params: { cartId: string; variantId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const cart = await cartService.removeItem(
      request.params.cartId,
      request.params.variantId
    );
    sendSuccess(reply, cart, 'Item removed from cart');
  }

  async merge(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { sessionId, userId } = mergeCartSchema.parse(request.body);
    await cartService.mergeGuestCart(sessionId, userId);
    sendSuccess(reply, null, 'Cart merged successfully');
  }
}

export const cartController = new CartController();
