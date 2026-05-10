import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { sendSuccess } from '../lib/response';
import { NotFoundError, ConflictError } from '../lib/errors';
import { generateSlug } from '../utils/slug';

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  parentId: z.string().cuid().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

const updateCategorySchema = createCategorySchema.partial();

export class CategoryController {
  async list(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { products: true } },
      },
    });
    sendSuccess(reply, categories, 'Categories fetched');
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const category = await prisma.category.findUnique({
      where: { id: request.params.id },
      include: { children: true, parent: true },
    });
    if (!category) throw new NotFoundError('Category');
    sendSuccess(reply, category, 'Category fetched');
  }

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = createCategorySchema.parse(request.body);

    const existing = await prisma.category.findUnique({ where: { name: input.name } });
    if (existing) throw new ConflictError(`Category "${input.name}" already exists`);

    const slug = generateSlug(input.name);
    const category = await prisma.category.create({
      data: { ...input, slug },
    });

    sendSuccess(reply, category, 'Category created', 201);
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const existing = await prisma.category.findUnique({ where: { id: request.params.id } });
    if (!existing) throw new NotFoundError('Category');

    const input = updateCategorySchema.parse(request.body);
    const category = await prisma.category.update({
      where: { id: request.params.id },
      data: input,
    });

    sendSuccess(reply, category, 'Category updated');
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const existing = await prisma.category.findUnique({ where: { id: request.params.id } });
    if (!existing) throw new NotFoundError('Category');

    await prisma.category.update({
      where: { id: request.params.id },
      data: { isActive: false },
    });

    sendSuccess(reply, null, 'Category deactivated');
  }
}

export const categoryController = new CategoryController();
