import { FastifyInstance } from 'fastify';
import { userController } from '../controllers/customer.controller';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.post('/', {
    schema: { tags: ['Users'], summary: 'Create a new customer' },
    handler: userController.create.bind(userController),
  });

  app.get('/', {
    schema: { tags: ['Users'], summary: 'List all customers', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: userController.list.bind(userController),
  });

  app.get<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Users'], summary: 'Get customer by ID', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: userController.getById.bind(userController),
  });

  app.patch<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Users'], summary: 'Update customer', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate, authorize('ADMIN', 'STAFF')],
    handler: userController.update.bind(userController),
  });

  app.delete<{ Params: { id: string } }>('/:id', {
    schema: { tags: ['Users'], summary: 'Soft-delete customer', security: [{ bearerAuth: [] }] },
    preHandler: [authenticate, authorize('ADMIN')],
    handler: userController.delete.bind(userController),
  });

  // Address sub-routes
  app.post<{ Params: { id: string } }>('/:id/addresses', {
    schema: { tags: ['Users'], summary: 'Add address to customer' },
    handler: userController.addAddress.bind(userController),
  });

  app.patch<{ Params: { id: string; addressId: string } }>('/:id/addresses/:addressId', {
    schema: { tags: ['Users'], summary: 'Update a customer address' },
    handler: userController.updateAddress.bind(userController),
  });

  app.delete<{ Params: { id: string; addressId: string } }>('/:id/addresses/:addressId', {
    schema: { tags: ['Users'], summary: 'Delete a customer address' },
    handler: userController.deleteAddress.bind(userController),
  });
}
