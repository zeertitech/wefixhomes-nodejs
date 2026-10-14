import { FastifyRequest, FastifyReply } from 'fastify';
import { orderService } from '../services/order.service';
import { createOrderSchema, updateOrderStatusSchema } from '../validators/order.validator';
import { paginationSchema } from '../utils/pagination';
import { sendSuccess, paginationMeta } from '../lib/response';
import { cartService } from '../services/cart.service';
import { ForbiddenError } from '../lib/errors';
import { optionalAuthenticate } from '../middlewares/authenticate';

export class OrderController {
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await optionalAuthenticate(request, reply);

    const raw = (request.body ?? {}) as Record<string, unknown>;
    const input = createOrderSchema.parse({
      ...raw,
      userId: raw.userId ?? raw.customerId,
    });

    if (request.user && input.userId !== request.user.userId) {
      throw new ForbiddenError('Cannot place an order for another account');
    }

    const cart = await cartService.resolveForRequest(request, reply);
    const order = await orderService.create(
      { ...input, cartId: cart.id },
      request.user?.userId ?? input.userId
    );
    sendSuccess(reply, order, 'Order created', 201);
  }

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const pagination = paginationSchema.parse(request.query);
    const { orders, total } = await orderService.list(pagination);
    sendSuccess(
      reply,
      orders,
      'Orders fetched',
      200,
      paginationMeta(pagination.page, pagination.limit, total)
    );
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const order = await orderService.getById(request.params.id);
    sendSuccess(reply, order, 'Order fetched');
  }

  async updateStatus(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const input = updateOrderStatusSchema.parse(request.body);
    await orderService.updateStatus(request.params.id, input, request.user!.userId);
    sendSuccess(reply, null, 'Order status updated');
  }
}

export const orderController = new OrderController();
