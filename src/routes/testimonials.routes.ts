import { FastifyInstance } from 'fastify';
import { testimonialsController } from '../controllers/testimonials.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

const staff = [authenticate, authorize('ADMIN', 'STAFF')];
const secured = [{ bearerAuth: [] }];
const writeLimit = { config: { rateLimit: { max: 60, timeWindow: 60_000 } } };

export async function publicTestimonialRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    schema: { tags: ['Testimonials'], summary: 'List published customer reviews' },
    handler: testimonialsController.listPublic.bind(testimonialsController),
  });
}

export async function adminTestimonialRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    schema: { tags: ['Testimonials'], summary: 'List customer reviews', security: secured },
    preHandler: staff,
    handler: testimonialsController.listAdmin.bind(testimonialsController),
  });

  app.post('/', {
    ...writeLimit,
    schema: { tags: ['Testimonials'], summary: 'Create a customer review', security: secured },
    preHandler: staff,
    handler: testimonialsController.create.bind(testimonialsController),
  });

  app.get('/:id', {
    schema: { tags: ['Testimonials'], summary: 'Get a customer review', security: secured },
    preHandler: staff,
    handler: testimonialsController.getAdmin.bind(testimonialsController),
  });

  app.patch('/:id', {
    ...writeLimit,
    schema: { tags: ['Testimonials'], summary: 'Update a customer review', security: secured },
    preHandler: staff,
    handler: testimonialsController.update.bind(testimonialsController),
  });

  app.delete('/:id', {
    ...writeLimit,
    schema: { tags: ['Testimonials'], summary: 'Delete a customer review', security: secured },
    preHandler: staff,
    handler: testimonialsController.remove.bind(testimonialsController),
  });
}
