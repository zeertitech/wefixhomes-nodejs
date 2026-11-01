import { FastifyReply, FastifyRequest } from 'fastify';
import { enquiryService } from '../services/enquiry.service';
import {
  createEnquirySchema,
  listEnquiryQuerySchema,
  updateEnquiryStatusSchema,
} from '../validators/enquiry.validator';
import { paginationMeta, sendCreated, sendSuccess } from '../lib/response';

export class EnquiryController {
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = createEnquirySchema.parse(request.body);
    const enquiry = await enquiryService.create(input);
    sendCreated(
      reply,
      { id: enquiry.id, status: enquiry.status },
      'Estimate request received'
    );
  }

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = listEnquiryQuerySchema.parse(request.query);
    const { enquiries, total } = await enquiryService.list(query);
    sendSuccess(
      reply,
      enquiries,
      'Enquiries fetched',
      200,
      paginationMeta(query.page, query.limit, total)
    );
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const enquiry = await enquiryService.getById(request.params.id);
    sendSuccess(reply, enquiry, 'Enquiry fetched');
  }

  async updateStatus(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const input = updateEnquiryStatusSchema.parse(request.body);
    const enquiry = await enquiryService.updateStatus(
      request.params.id,
      input,
      request.user!.userId,
      request.ip
    );
    sendSuccess(reply, enquiry, 'Enquiry status updated');
  }
}

export const enquiryController = new EnquiryController();
