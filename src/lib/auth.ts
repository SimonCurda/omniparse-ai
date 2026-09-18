import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';

const DEV_JWT_SECRET = 'op-dev-secret-change-in-production';

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is required in production. ' +
      'Set it to a cryptographically random string (e.g. openssl rand -hex 32).'
    );
  }
  console.warn(
    `[auth] WARNING: JWT_SECRET is not set. Using insecure dev fallback. ` +
    `Do NOT use this in production!`
  );
}

const JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_SECRET;

export interface JWTPayload {
  userId: string;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function getUserFromRequest(req: Request): Promise<{ userId: string; email: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) return null;
  return { userId: payload.userId, email: payload.email };
}

export const PLAN_LIMITS: Record<string, number> = {
  free: 15,
  pro: 500,
  plus: 2000,
  business: 10000,
  enterprise: Infinity,
};

export const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  plus: 'Plus',
  business: 'Business',
  enterprise: 'Enterprise',
};

export const PLAN_CHAT_LIMITS: Record<string, number> = {
  free: 25,
  pro: Infinity,
  plus: Infinity,
  business: Infinity,
  enterprise: Infinity,
};

export const PLAN_BATCH_LIMITS: Record<string, number> = {
  free: 1,
  pro: 5,
  plus: Infinity,
  business: Infinity,
  enterprise: Infinity,
};

export const PLAN_CUSTOM_RULE_LIMITS: Record<string, number> = {
  free: 0,
  pro: 3,
  plus: 20,
  business: 30,
  enterprise: Infinity,
};

export const PLAN_APPROVAL_RULE_LIMITS: Record<string, number> = {
  free: 0,
  pro: 0,
  plus: 20,
  business: 30,
  enterprise: Infinity,
};

export const PLAN_ENTITY_LIMITS: Record<string, number> = {
  free: 0,
  pro: 0,
  plus: 0,
  business: 5,
  enterprise: Infinity,
};

export const PLAN_ORDER = ['free', 'pro', 'plus', 'business', 'enterprise'];

export function planTierIndex(plan: string): number {
  return PLAN_ORDER.indexOf(plan);
}

export function hasFeature(plan: string, feature: string): boolean {
  const matrix: Record<string, string[]> = {
    free: [
      'ai_extraction', 'confidence_scores', 'validation_rules', 'tampering_detection',
      'search_filter', 'csv_export', 'basic_analytics', 'lifecycle_status_basic',
    ],
    pro: [
      'ai_extraction', 'confidence_scores', 'validation_rules', 'tampering_detection',
      'search_filter', 'csv_export', 'basic_analytics', 'lifecycle_status_basic',
      'json_export', 'excel_export', 'duplicate_detection', 'batch_upload',
      'unlimited_chat', 'invoice_editing', 'custom_validation_rules',
    ],
    plus: [
      'ai_extraction', 'confidence_scores', 'validation_rules', 'tampering_detection',
      'search_filter', 'csv_export', 'basic_analytics', 'lifecycle_status_basic',
      'json_export', 'excel_export', 'duplicate_detection', 'batch_upload',
      'unlimited_chat', 'invoice_editing',
      'approval_workflows', 'line_item_tracking', 'line_item_duplicate_detection',
      'custom_validation_rules', 'vendor_risk_scoring', 'advanced_analytics',
      'audit_trail', 'bulk_operations', 'data_retention_control',
      'custom_export_templates', 'custom_lifecycle_statuses',
    ],
    business: [
      'ai_extraction', 'confidence_scores', 'validation_rules', 'tampering_detection',
      'search_filter', 'csv_export', 'basic_analytics', 'lifecycle_status_basic',
      'json_export', 'excel_export', 'duplicate_detection', 'batch_upload',
      'unlimited_chat', 'invoice_editing',
      'approval_workflows', 'line_item_tracking', 'line_item_duplicate_detection',
      'custom_validation_rules', 'vendor_risk_scoring', 'advanced_analytics',
      'audit_trail', 'bulk_operations', 'data_retention_control',
      'custom_export_templates', 'custom_lifecycle_statuses',
      'advanced_approval_workflows', 'executive_dashboard', 'multi_entity',
      'price_change_alerts', 'vendor_scorecard',
    ],
    enterprise: [
      'ai_extraction', 'confidence_scores', 'validation_rules', 'tampering_detection',
      'search_filter', 'csv_export', 'basic_analytics', 'lifecycle_status_basic',
      'json_export', 'excel_export', 'duplicate_detection', 'batch_upload',
      'unlimited_chat', 'invoice_editing',
      'approval_workflows', 'line_item_tracking', 'line_item_duplicate_detection',
      'custom_validation_rules', 'vendor_risk_scoring', 'advanced_analytics',
      'audit_trail', 'bulk_operations', 'data_retention_control',
      'custom_export_templates', 'custom_lifecycle_statuses',
      'advanced_approval_workflows', 'executive_dashboard', 'multi_entity',
      'price_change_alerts', 'vendor_scorecard',
      'unlimited_rules', 'advanced_audit_logs', 'compliance_exports',
    ],
  };
  return (matrix[plan] || matrix.free).includes(feature);
}
