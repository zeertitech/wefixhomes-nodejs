import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ConflictError, NotFoundError } from '../lib/errors';
import { auditService } from './audit.service';
import { releaseImage } from './catalogue.service';
import { storageService } from './storage.service';
import type {
  AdminTestimonialQuery,
  CreateTestimonialInput,
  PublicTestimonialQuery,
  UpdateTestimonialInput,
} from '../validators/testimonials.validator';

const imageUrl = (key: string | null) => storageService.deliveryUrl(key, 'service');

function publicDto(row: Prisma.TestimonialGetPayload<object>) {
  return {
    id: row.id,
    customerName: row.customerName,
    location: row.location,
    quote: row.quote,
    rating: row.rating,
    avatarUrl: imageUrl(row.avatarKey),
    sortOrder: row.sortOrder,
  };
}

function adminDto(row: Prisma.TestimonialGetPayload<object>) {
  return {
    ...publicDto(row),
    avatarKey: row.avatarKey,
    status: row.status,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rethrowWrite(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictError('That review could not be saved');
  }
  throw error;
}

export class TestimonialsService {
  async listPublic(query: PublicTestimonialQuery) {
    const where: Prisma.TestimonialWhereInput = { status: 'PUBLISHED' };
    const [rows, total] = await prisma.$transaction([
      prisma.testimonial.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ sortOrder: query.order }, { createdAt: 'desc' }],
      }),
      prisma.testimonial.count({ where }),
    ]);
    return { total, testimonials: rows.map(publicDto) };
  }

  async listAdmin(query: AdminTestimonialQuery) {
    const where: Prisma.TestimonialWhereInput = {};
    if (query.status !== 'all') where.status = query.status;
    if (query.search) {
      where.OR = [
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
        { quote: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await prisma.$transaction([
      prisma.testimonial.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ [query.sortBy]: query.order }, { customerName: 'asc' }],
      }),
      prisma.testimonial.count({ where }),
    ]);
    return { total, testimonials: rows.map(adminDto) };
  }

  async getAdmin(id: string) {
    const row = await prisma.testimonial.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Review');
    return adminDto(row);
  }

  async create(input: CreateTestimonialInput, userId: string, ipAddress?: string) {
    if (input.avatarKey) await storageService.verifyUploadedImage(input.avatarKey, 'service');
    try {
      const row = await prisma.testimonial.create({
        data: {
          customerName: input.customerName,
          location: input.location,
          quote: input.quote,
          rating: input.rating,
          avatarKey: input.avatarKey ?? null,
          sortOrder: input.sortOrder,
          status: input.status,
          publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
        },
      });
      await auditService.log(
        'Testimonial',
        row.id,
        'CREATE',
        null,
        { customerName: row.customerName, status: row.status },
        userId,
        userId,
        ipAddress,
      );
      return adminDto(row);
    } catch (error) {
      if (input.avatarKey) await releaseImage(input.avatarKey, 'service');
      rethrowWrite(error);
    }
  }

  async update(id: string, input: UpdateTestimonialInput, userId: string, ipAddress?: string) {
    const existing = await prisma.testimonial.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Review');
    const nextAvatar = input.avatarKey !== undefined ? input.avatarKey : existing.avatarKey;
    if (nextAvatar && nextAvatar !== existing.avatarKey) {
      await storageService.verifyUploadedImage(nextAvatar, 'service');
    }
    let row: Prisma.TestimonialGetPayload<object>;
    try {
      row = await prisma.testimonial.update({
        where: { id },
        data: {
          ...(input.customerName !== undefined ? { customerName: input.customerName } : {}),
          ...(input.location !== undefined ? { location: input.location } : {}),
          ...(input.quote !== undefined ? { quote: input.quote } : {}),
          ...(input.rating !== undefined ? { rating: input.rating } : {}),
          ...(input.avatarKey !== undefined ? { avatarKey: input.avatarKey } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.status === 'PUBLISHED' && !existing.publishedAt ? { publishedAt: new Date() } : {}),
        },
      });
    } catch (error) {
      if (input.avatarKey && input.avatarKey !== existing.avatarKey) await releaseImage(input.avatarKey, 'service');
      rethrowWrite(error);
    }
    if (existing.avatarKey && existing.avatarKey !== row.avatarKey) {
      await releaseImage(existing.avatarKey, 'service');
    }
    await auditService.log(
      'Testimonial',
      id,
      'UPDATE',
      { customerName: existing.customerName, status: existing.status },
      { customerName: row.customerName, status: row.status },
      userId,
      userId,
      ipAddress,
    );
    return adminDto(row);
  }

  async delete(id: string, userId: string, ipAddress?: string) {
    const existing = await prisma.testimonial.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Review');
    await prisma.testimonial.delete({ where: { id } });
    if (existing.avatarKey) await releaseImage(existing.avatarKey, 'service');
    await auditService.log(
      'Testimonial',
      id,
      'DELETE',
      { customerName: existing.customerName },
      null,
      userId,
      userId,
      ipAddress,
    );
    return { id, deleted: true };
  }
}

export const testimonialsService = new TestimonialsService();
