import { prisma } from '../config/prisma';
import { BusinessError, NotFoundError } from '../lib/errors';
import { auditService } from './audit.service';
import { getPaginationParams } from '../utils/pagination';
import type { Prisma } from '@prisma/client';
import {
  SERVICE_SLUGS,
  type CreateEnquiryInput,
  type ListEnquiryQuery,
  type UpdateEnquiryStatusInput,
} from '../validators/enquiry.validator';

export class EnquiryService {
  async create(input: CreateEnquiryInput) {
    for (const slug of input.service.split(',')) {
      if ((SERVICE_SLUGS as readonly string[]).includes(slug)) continue;
      const category = await prisma.serviceCategory.findFirst({
        where: { slug, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (category) continue;
      const service = await prisma.service.findFirst({
        where: {
          slug,
          isActive: true,
          deletedAt: null,
          category: { isActive: true, deletedAt: null },
        },
        select: { id: true },
      });
      if (!service) throw new BusinessError('Please select a service.');
    }
    return prisma.enquiry.create({
      data: {
        name: input.name,
        phone: input.phone,
        service: input.service,
        address: input.address,
        requirement: input.requirement,
      },
    });
  }

  async list(input: ListEnquiryQuery) {
    const { skip, take } = getPaginationParams(input);
    const sortField = input.sortBy === 'status' ? 'status' : 'createdAt';
    const where: Prisma.EnquiryWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.service) where.service = input.service;
    if (input.search) {
      where.OR = [
        { name: { contains: input.search, mode: 'insensitive' } },
        { phone: { contains: input.search } },
        { address: { contains: input.search, mode: 'insensitive' } },
      ];
    }
    const [enquiries, total] = await prisma.$transaction([
      prisma.enquiry.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: input.order },
      }),
      prisma.enquiry.count({ where }),
    ]);
    return { enquiries, total };
  }

  async getById(id: string) {
    const enquiry = await prisma.enquiry.findUnique({ where: { id } });
    if (!enquiry) throw new NotFoundError('Enquiry');
    return enquiry;
  }

  async updateStatus(
    id: string,
    input: UpdateEnquiryStatusInput,
    userId: string,
    ipAddress?: string
  ) {
    const existing = await prisma.enquiry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Enquiry');

    if (existing.status === input.status) return existing;

    const updated = await prisma.enquiry.update({
      where: { id },
      data: { status: input.status },
    });

    await auditService.log(
      'Enquiry',
      id,
      'STATUS_CHANGE',
      { status: existing.status },
      { status: updated.status },
      userId,
      userId,
      ipAddress
    );

    return updated;
  }
}

export const enquiryService = new EnquiryService();
