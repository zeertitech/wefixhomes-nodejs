import { z } from 'zod';
import { MAX_CART_QUANTITY } from '../lib/commerce';

export const addToCartSchema = z.object({
  variantId: z.string().cuid('Invalid variant ID'),
  quantity: z.number().int().min(1).max(MAX_CART_QUANTITY),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(MAX_CART_QUANTITY),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
