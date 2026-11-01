import { z } from 'zod';
import { paginationSchema } from '../utils/pagination';
import { SLUG_PATTERN } from './catalogue.validator';

export const SERVICE_SLUGS = [
  'painting',
  'electrical',
  'plumbing',
  'tiling',
  'carpentry',
  'other',
] as const;

function normalizeIndianMobile(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export const createEnquirySchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name.').max(100, 'Name is too long'),
  phone: z
    .string()
    .trim()
    .transform(normalizeIndianMobile)
    .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')),
  service: z
    .string()
    .trim()
    .min(1, 'Please select a service.')
    .max(400, 'Please select fewer services.')
    .transform((value) => [...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))].join(','))
    .refine(
      (value) => {
        const parts = value.split(',');
        return parts.length > 0 && parts.length <= 12 && parts.every((part) => SLUG_PATTERN.test(part));
      },
      'Please select a service.',
    ),
  address: z
    .string()
    .trim()
    .min(1, 'Please enter your address or location.')
    .max(300, 'Address is too long'),
  requirement: z
    .string()
    .trim()
    .max(1000, 'Requirement is too long')
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const ENQUIRY_STATUSES = ['NEW', 'CONTACTED', 'CLOSED'] as const;

export const updateEnquiryStatusSchema = z.object({
  status: z.enum(ENQUIRY_STATUSES),
});

export const listEnquiryQuerySchema = paginationSchema.extend({
  status: z.enum(ENQUIRY_STATUSES).optional(),
  service: z.string().trim().min(1).max(80).regex(SLUG_PATTERN).optional(),
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
export type UpdateEnquiryStatusInput = z.infer<typeof updateEnquiryStatusSchema>;
export type ListEnquiryQuery = z.infer<typeof listEnquiryQuerySchema>;
