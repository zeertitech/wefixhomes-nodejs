import { FastifyInstance } from 'fastify';
import { worksController } from '../controllers/works.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

const staff = [authenticate, authorize('ADMIN', 'STAFF')];
const secured = [{ bearerAuth: [] }];
const writeLimit = { config: { rateLimit: { max: 60, timeWindow: 60_000 } } };

export async function publicWorkRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    schema: { tags: ['Works'], summary: 'List published projects' },
    handler: worksController.listPublic.bind(worksController),
  });

  app.get('/:slug', {
    schema: { tags: ['Works'], summary: 'Get a published project with its gallery' },
    handler: worksController.getPublic.bind(worksController),
  });
}

export async function adminWorkRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', {
    schema: { tags: ['Works'], summary: 'List projects', security: secured },
    preHandler: staff,
    handler: worksController.listAdmin.bind(worksController),
  });

  app.post('/', {
    ...writeLimit,
    schema: { tags: ['Works'], summary: 'Create a project', security: secured },
    preHandler: staff,
    handler: worksController.create.bind(worksController),
  });

  app.get('/:id', {
    schema: { tags: ['Works'], summary: 'Get a project', security: secured },
    preHandler: staff,
    handler: worksController.getAdmin.bind(worksController),
  });

  app.patch('/:id', {
    ...writeLimit,
    schema: { tags: ['Works'], summary: 'Update a project', security: secured },
    preHandler: staff,
    handler: worksController.update.bind(worksController),
  });

  app.delete('/:id', {
    ...writeLimit,
    schema: { tags: ['Works'], summary: 'Delete a project', security: secured },
    preHandler: staff,
    handler: worksController.remove.bind(worksController),
  });
}
