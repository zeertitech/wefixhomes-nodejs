import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { sendSuccess } from '../lib/response';
import { NotFoundError } from '../lib/errors';
import { auditService } from '../services/audit.service';

const updateInventorySchema = z.object({
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
  lowStockAt: z.number().int().min(0).optional(),
});

export class InventoryController {
  async getByVariant(
    request: FastifyRequest<{ Params: { variantId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const inventory = await prisma.inventory.findUnique({
      where: { variantId: request.params.variantId },
      include: {
        variant: {
          select: {
            sku: true,
            price: true,
            product: { select: { name: true, isActive: true } },
          },
        },
      },
    });
    if (!inventory) throw new NotFoundError('Inventory record');
    sendSuccess(reply, inventory, 'Inventory fetched');
  }

  async update(
    request: FastifyRequest<{ Params: { variantId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { quantity, lowStockAt } = updateInventorySchema.parse(request.body);

    const existing = await prisma.inventory.findUnique({
      where: { variantId: request.params.variantId },
    });
    if (!existing) throw new NotFoundError('Inventory record');

    const updated = await prisma.inventory.update({
      where: { variantId: request.params.variantId },
      data: {
        quantity,
        ...(lowStockAt !== undefined && { lowStockAt }),
      },
    });

    await auditService.log(
      'inventory',
      request.params.variantId,
      'UPDATE',
      { quantity: existing.quantity, lowStockAt: existing.lowStockAt },
      { quantity, lowStockAt },
      request.user!.userId
    );

    sendSuccess(reply, updated, 'Inventory updated');
  }

  async listLowStock(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const lowStock = await prisma.inventory.findMany({
      where: {
        variant: { isActive: true, deletedAt: null },
      },
      include: {
        variant: {
          select: {
            sku: true,
            price: true,
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { quantity: 'asc' },
    });

    // Filter in application layer so we can compare against each row's own threshold
    const filtered = lowStock.filter((inv) => inv.quantity <= inv.lowStockAt);

    sendSuccess(reply, filtered, 'Low stock items fetched');
  }
}

export const inventoryController = new InventoryController();
