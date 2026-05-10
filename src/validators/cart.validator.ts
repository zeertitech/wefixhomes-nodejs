import { z } from 'zod';

export const addToCartSchema = z.object({
  variantId: z.string().cuid('Invalid variant ID'),
  quantity: z.number().int().min(1).max(10),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(10),
});

export const mergeCartSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  userId: z.string().cuid('Invalid user ID'),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type MergeCartInput = z.infer<typeof mergeCartSchema>;
