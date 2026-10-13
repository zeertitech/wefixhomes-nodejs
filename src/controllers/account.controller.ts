import { FastifyReply, FastifyRequest } from 'fastify';
import { accountService } from '../services/account.service';
import { createAddressSchema } from '../validators/customer.validator';
import { sendSuccess } from '../lib/response';
import { AuthError } from '../lib/errors';

function requireUserId(request: FastifyRequest): string {
  const userId = request.user?.userId;
  if (!userId) throw new AuthError();
  return userId;
}

export class AccountController {
  async orders(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const orders = await accountService.listOrders(requireUserId(request));
    sendSuccess(reply, orders, 'Orders');
  }

  async addresses(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const addresses = await accountService.listAddresses(requireUserId(request));
    sendSuccess(reply, addresses, 'Addresses');
  }

  async addAddress(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = createAddressSchema.parse(request.body);
    const address = await accountService.addAddress(requireUserId(request), input);
    sendSuccess(reply, address, 'Address added', 201);
  }

  async updateAddress(
    request: FastifyRequest<{ Params: { addressId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const input = createAddressSchema.partial().parse(request.body);
    const address = await accountService.updateAddress(
      requireUserId(request),
      request.params.addressId,
      input
    );
    sendSuccess(reply, address, 'Address updated');
  }

  async deleteAddress(
    request: FastifyRequest<{ Params: { addressId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    await accountService.deleteAddress(requireUserId(request), request.params.addressId);
    sendSuccess(reply, null, 'Address deleted');
  }
}

export const accountController = new AccountController();
