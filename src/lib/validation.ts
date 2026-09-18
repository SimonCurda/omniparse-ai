import { z } from 'zod';

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z.object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be at most 100 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .refine(
        (pwd) => /[A-Z]/.test(pwd),
        'Password must contain at least one uppercase letter'
      )
      .refine(
        (pwd) => /[a-z]/.test(pwd),
        'Password must contain at least one lowercase letter'
      )
      .refine(
        (pwd) => /[0-9]/.test(pwd),
        'Password must contain at least one number'
      ),
    termsAccepted: z.literal(true, { error: 'You must accept the Terms of Service and Privacy Policy' }),
    ageConfirmed: z.literal(true, { error: 'You must confirm you are at least 15 years old' }),
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .refine(
        (pwd) => /[A-Z]/.test(pwd),
        'Password must contain at least one uppercase letter'
      )
      .refine(
        (pwd) => /[a-z]/.test(pwd),
        'Password must contain at least one lowercase letter'
      )
      .refine(
        (pwd) => /[0-9]/.test(pwd),
        'Password must contain at least one number'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  });

// ─── Upload Validation ────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateFile(file: File): string | null {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return `File "${file.name}" exceeds the 10 MB size limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return `File "${file.name}" has unsupported type "${file.type}". Allowed: PDF, JPEG, PNG, WebP`;
  }

  // Check extension
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `File "${file.name}" has unsupported extension ".${ext}". Allowed: .pdf, .jpg, .jpeg, .png, .webp`;
  }

  return null; // No error
}

// ─── Chat Schema ──────────────────────────────────────────────────────────────

export const chatSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message must be at most 1000 characters'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
});

// ─── Invoice ID Schema ────────────────────────────────────────────────────────

export const invoiceIdSchema = z.object({
  id: z.string().min(1, 'Invoice ID is required'),
});

// ─── Helper: Get Client IP ────────────────────────────────────────────────────

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}