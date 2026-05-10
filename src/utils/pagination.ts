import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export function getPaginationParams(input: PaginationInput): {
  skip: number;
  take: number;
  orderBy: Record<string, string>;
} {
  return {
    skip: (input.page - 1) * input.limit,
    take: input.limit,
    orderBy: input.sortBy
      ? { [input.sortBy]: input.order }
      : { createdAt: input.order },
  };
}
