import { FastifyRequest, FastifyReply } from 'fastify';
import { hashPassword, generateSalt } from '../utils/hash';
import { prisma } from '../config/prisma';
import {
  createCustomerSchema,
  updateCustomerSchema,
  createAddressSchema,
} from '../validators/customer.validator';
import { paginationSchema, getPaginationParams } from '../utils/pagination';
import { sendSuccess, paginationMeta } from '../lib/response';
import { NotFoundError, ConflictError, ForbiddenError, AuthError } from '../lib/errors';
import { optionalAuthenticate } from '../middlewares/authenticate';

export class UserController {
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = createCustomerSchema.parse(request.body);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: input.email }, { phone: input.phone }],
        deletedAt: null,
      },
    });
    if (existing) throw new ConflictError('A user with this email or phone already exists');

    const customerRole = await prisma.role.findUnique({ where: { name: 'CUSTOMER' } });
    if (!customerRole) throw new Error('Default role not found');

    const salt = generateSalt();
    const { password, ...userData } = input;
    const passwordHash = await hashPassword(password, salt);
    const user = await prisma.user.create({ 
      data: { ...userData, roleId: customerRole.id, passwordHash, salt } 
    });
    sendSuccess(reply, user, 'Customer created', 201);
  }

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const pagination = paginationSchema.parse(request.query);
    const { skip, take, orderBy } = getPaginationParams(pagination);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: { name: 'CUSTOMER' }, deletedAt: null },
        skip,
        take,
        orderBy,
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where: { role: { name: 'CUSTOMER' }, deletedAt: null } }),
    ]);

    sendSuccess(
      reply,
      users,
      'Customers fetched',
      200,
      paginationMeta(pagination.page, pagination.limit, total)
    );
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { id: request.params.id, deletedAt: null },
      include: {
        addresses: { orderBy: { isDefault: 'desc' } },
        _count: { select: { orders: true } },
      },
    });
    if (!user) throw new NotFoundError('Customer');
    sendSuccess(reply, user, 'Customer fetched');
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const existing = await prisma.user.findFirst({
      where: { id: request.params.id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError('Customer');

    const input = updateCustomerSchema.parse(request.body);
    const updated = await prisma.user.update({
      where: { id: request.params.id },
      data: input,
    });
    sendSuccess(reply, updated, 'Customer updated');
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const existing = await prisma.user.findFirst({
      where: { id: request.params.id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError('Customer');

    await prisma.user.update({
      where: { id: request.params.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    sendSuccess(reply, null, 'Customer deleted');
  }

  async addAddress(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    await optionalAuthenticate(request, reply);
    if (!request.user) {
      throw new AuthError('Sign in to save a shipping address');
    }
    const isStaff = request.user.role === 'ADMIN' || request.user.role === 'STAFF';
    if (!isStaff && request.user.userId !== request.params.id) {
      throw new ForbiddenError('You can only save an address on your own account');
    }

    const user = await prisma.user.findFirst({
      where: { id: request.params.id, deletedAt: null },
    });
    if (!user) throw new NotFoundError('Customer');

    const input = createAddressSchema.parse(request.body);

    // If new address is default, unset all others
    if (input.isDefault) {
      await prisma.address.updateMany({
        where: { userId: request.params.id },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: { ...input, userId: request.params.id },
    });
    sendSuccess(reply, address, 'Address added', 201);
  }

  async updateAddress(
    request: FastifyRequest<{ Params: { id: string; addressId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const address = await prisma.address.findFirst({
      where: { id: request.params.addressId, userId: request.params.id },
    });
    if (!address) throw new NotFoundError('Address');

    const input = createAddressSchema.partial().parse(request.body);

    if (input.isDefault === true) {
      await prisma.address.updateMany({
        where: { userId: request.params.id },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.address.update({
      where: { id: request.params.addressId },
      data: input,
    });
    sendSuccess(reply, updated, 'Address updated');
  }

  async deleteAddress(
    request: FastifyRequest<{ Params: { id: string; addressId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const address = await prisma.address.findFirst({
      where: { id: request.params.addressId, userId: request.params.id },
    });
    if (!address) throw new NotFoundError('Address');

    await prisma.address.delete({ where: { id: request.params.addressId } });
    sendSuccess(reply, null, 'Address deleted');
  }
}

export const userController = new UserController();
