import { FastifyReply, FastifyRequest } from 'fastify';
import { cartService } from '../services/cart.service';
import { addToCartSchema, updateCartItemSchema } from '../validators/cart.validator';
import { sendSuccess } from '../lib/response';
import { COOKIE_NAMES } from '../utils/cookie';

export class CartController {
  async getCart(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const cart = await cartService.resolveForRequest(request, reply);
    sendSuccess(reply, cart, 'Cart fetched');
  }

  async addItem(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = addToCartSchema.parse(request.body);
    const cart = await cartService.resolveForRequest(request, reply);
    const updated = await cartService.addItem(cart.id, input);
    sendSuccess(reply, updated, 'Item added to cart');
  }

  async updateItem(
    request: FastifyRequest<{ Params: { variantId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const input = updateCartItemSchema.parse(request.body);
    const cart = await cartService.resolveForRequest(request, reply);
    const updated = await cartService.updateItem(cart.id, request.params.variantId, input);
    sendSuccess(reply, updated, 'Cart updated');
  }

  async removeItem(
    request: FastifyRequest<{ Params: { variantId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const cart = await cartService.resolveForRequest(request, reply);
    const updated = await cartService.removeItem(cart.id, request.params.variantId);
    sendSuccess(reply, updated, 'Item removed from cart');
  }

  async merge(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const sessionId = request.cookies?.[COOKIE_NAMES.CART_SESSION];
    if (sessionId && request.user?.userId) {
      await cartService.mergeGuestCart(sessionId, request.user.userId);
    }
    const cart = await cartService.resolveForRequest(request, reply);
    sendSuccess(reply, cart, 'Cart merged successfully');
  }
}

export const cartController = new CartController();
