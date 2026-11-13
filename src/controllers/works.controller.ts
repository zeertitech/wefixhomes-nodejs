import { FastifyReply, FastifyRequest } from 'fastify';
import { worksService } from '../services/works.service';
import { paginationMeta, sendCreated, sendSuccess } from '../lib/response';
import { idParamSchema, slugParamSchema } from '../validators/catalogue.validator';
import {
  adminWorkQuerySchema,
  createWorkSchema,
  publicWorkQuerySchema,
  updateWorkSchema,
} from '../validators/works.validator';

export class WorksController {
  async listPublic(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = publicWorkQuerySchema.parse(request.query);
    const { works, total } = await worksService.listPublic(query);
    sendSuccess(reply, works, 'Projects fetched', 200, paginationMeta(query.page, query.limit, total));
  }

  async getPublic(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { slug } = slugParamSchema.parse(request.params);
    sendSuccess(reply, await worksService.getPublic(slug), 'Project fetched');
  }

  async listAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = adminWorkQuerySchema.parse(request.query);
    const { works, total } = await worksService.listAdmin(query);
    sendSuccess(reply, works, 'Projects fetched', 200, paginationMeta(query.page, query.limit, total));
  }

  async getAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = idParamSchema.parse(request.params);
    sendSuccess(reply, await worksService.getAdmin(id), 'Project fetched');
  }

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = createWorkSchema.parse(request.body);
    sendCreated(reply, await worksService.create(input, request.user!.userId, request.ip), 'Project created');
  }

  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = idParamSchema.parse(request.params);
    const input = updateWorkSchema.parse(request.body);
    sendSuccess(reply, await worksService.update(id, input, request.user!.userId, request.ip), 'Project updated');
  }

  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = idParamSchema.parse(request.params);
    sendSuccess(reply, await worksService.delete(id, request.user!.userId, request.ip), 'Project deleted');
  }
}

export const worksController = new WorksController();
