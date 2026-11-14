import { FastifyReply, FastifyRequest } from 'fastify';
import { testimonialsService } from '../services/testimonials.service';
import { paginationMeta, sendCreated, sendSuccess } from '../lib/response';
import { idParamSchema } from '../validators/catalogue.validator';
import {
  adminTestimonialQuerySchema,
  createTestimonialSchema,
  publicTestimonialQuerySchema,
  updateTestimonialSchema,
} from '../validators/testimonials.validator';

export class TestimonialsController {
  async listPublic(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = publicTestimonialQuerySchema.parse(request.query);
    const { testimonials, total } = await testimonialsService.listPublic(query);
    sendSuccess(reply, testimonials, 'Reviews fetched', 200, paginationMeta(query.page, query.limit, total));
  }

  async listAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = adminTestimonialQuerySchema.parse(request.query);
    const { testimonials, total } = await testimonialsService.listAdmin(query);
    sendSuccess(reply, testimonials, 'Reviews fetched', 200, paginationMeta(query.page, query.limit, total));
  }

  async getAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = idParamSchema.parse(request.params);
    sendSuccess(reply, await testimonialsService.getAdmin(id), 'Review fetched');
  }

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = createTestimonialSchema.parse(request.body);
    sendCreated(reply, await testimonialsService.create(input, request.user!.userId, request.ip), 'Review created');
  }

  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = idParamSchema.parse(request.params);
    const input = updateTestimonialSchema.parse(request.body);
    sendSuccess(reply, await testimonialsService.update(id, input, request.user!.userId, request.ip), 'Review updated');
  }

  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = idParamSchema.parse(request.params);
    sendSuccess(reply, await testimonialsService.delete(id, request.user!.userId, request.ip), 'Review deleted');
  }
}

export const testimonialsController = new TestimonialsController();
