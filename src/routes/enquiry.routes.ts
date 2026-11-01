import { FastifyInstance } from 'fastify';
import { enquiryController } from '../controllers/enquiry.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

export async function enquiryRoutes(app: FastifyInstance): Promise<void> {
  app.post('/', {
    schema: {
      tags: ['Enquiries'],
      summary: 'Submit a public estimate enquiry',
    },
    config: {
      rateLimit: {
        max: 5,
        timeWindow: 60_000,
      },
    },
    handler: enquiryController.create.bind(enquiryController),
  });

  app.get('/', {
    schema: {
      tags: ['Enquiries'],
      summary: 'List estimate enquiries',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: enquiryController.list.bind(enquiryController),
  });

  app.get<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Enquiries'],
      summary: 'Get one estimate enquiry',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: enquiryController.getById.bind(enquiryController),
  });

  app.patch<{ Params: { id: string } }>('/:id', {
    schema: {
      tags: ['Enquiries'],
      summary: 'Update an enquiry status',
      security: [{ bearerAuth: [] }],
    },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: enquiryController.updateStatus.bind(enquiryController),
  });
}
