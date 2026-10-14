import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ message: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(254, 'Email is too long')
    .toLowerCase(),
  password: z
    .string({ message: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
});

export const registerSchema = z.object({
  email: z
    .string({ message: 'Email is required' })
    .email('Invalid email format')
    .toLowerCase(),
  password: z
    .string({ message: 'Password is required' })
    .min(8, 'Password must be at least 8 characters'),
  firstName: z.string({ message: 'First name is required' }).min(1),
  lastName: z.string({ message: 'Last name is required' }).min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string({ message: 'Refresh token is required' }).min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const customerSignupSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Full name is required').max(100, 'Name is too long'),
    email: z.string().trim().min(1, 'Email is required').email('Invalid email format').max(254).toLowerCase(),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const verifyEmailOtpSchema = z.object({
  email: z.string().trim().email('Invalid email format').toLowerCase(),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export type CustomerSignupInput = z.infer<typeof customerSignupSchema>;
export type VerifyEmailOtpInput = z.infer<typeof verifyEmailOtpSchema>;

export const updateNameSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(100, 'Name is too long'),
});

export const startPhoneChangeSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
});

export const confirmPhoneSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
});

export const changePasswordSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const startEmailChangeSchema = z.object({
  newEmail: z.string().trim().email('Invalid email format').max(254).toLowerCase(),
});

export const confirmCurrentEmailSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const confirmNewEmailSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  newEmail: z.string().trim().email('Invalid email format').max(254).toLowerCase(),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or phone number').max(254),
});

export const verifyForgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or phone number').max(254),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const resetPasswordSchema = z
  .object({
    resetToken: z.string().min(32, 'Reset session expired. Request a new code'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type UpdateNameInput = z.infer<typeof updateNameSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyForgotPasswordInput = z.infer<typeof verifyForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
