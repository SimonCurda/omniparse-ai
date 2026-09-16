import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// In production on Vercel, use Supabase connection pooler settings.
// The DATABASE_URL from Supabase should already point to the pooler (port 6543) for Vercel.
// Fallback is only for local development with a direct connection.
export const db = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db