import { z } from 'zod';

export const createOrderSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  addressId: z.string().cuid('Invalid address ID'),
  cartId: z.string().cuid('Invalid cart ID'),
  couponCode: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid('Must be a valid UUID').optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'FAILED', 'REFUNDED']),
  reason: z.string().max(500).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
