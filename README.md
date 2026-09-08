# OmniParse AI

AI-powered invoice parsing, validation, and approval platform.

## Quick start (local)

```bash
# 1. Install dependencies
bun install

# 2. Set up environment variables
copy .env.example .env
# Edit .env with your Supabase URL, Groq key, Stripe keys, etc.

# 3. Push database schema to Supabase
bunx prisma db push

# 4. (Optional) Seed test data — creates 5 test users on every plan
bun run seed
# Test logins:
#   free@omniparse.test / Test1234
#   pro@omniparse.test / Test1234
#   plus@omniparse.test / Test1234
#   business@omniparse.test / Test1234
#   enterprise@omniparse.test / Test1234

# 5. Start dev server
bun run dev
# → http://localhost:3000
```

## Tech stack

- **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind CSS 4
- **Prisma 6** + **Supabase Postgres**
- **Groq** (Llama + Qwen) for AI vision & chat
- **Stripe** for billing
- **shadcn/ui** for components
- Custom JWT + bcrypt auth (Supabase Auth migration planned post-launch)

## Deploy to Vercel

1. Push this repo to GitHub
2. Import the GitHub repo into Vercel
3. Add all env vars from `.env.example` in Vercel Project Settings → Environment Variables
4. Vercel auto-detects Next.js, builds & deploys on every push to `main`

## Required env vars

| Variable | Purpose | Where to get it |
|---|---|---|
| `DATABASE_URL` | Supabase Postgres connection | Supabase Dashboard → Project Settings → Database |
| `JWT_SECRET` | Signs user session tokens | `openssl rand -hex 32` |
| `GROQ_API_KEY` | AI chat & vision API | https://console.groq.com/keys |
| `STRIPE_SECRET_KEY` | Stripe billing | https://dashboard.stripe.com/apikeys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification | Stripe Dashboard → Webhooks |
| `STRIPE_PRO_PRICE_ID` | Pro tier price ID | Stripe Dashboard → Products |
| `STRIPE_ENTERPRISE_PRICE_ID` | Enterprise tier price ID | Stripe Dashboard → Products |
| `NEXT_PUBLIC_APP_URL` | App's public URL | Vercel deployment URL |
| `CRON_SECRET` | Vercel cron job auth | `openssl rand -hex 16` |

## Recent changes

### Chat leak fix (this commit)
- Swapped `qwen/qwen3.6-27b` (reasoning model that leaked thinking) → `llama-3.3-70b-versatile` as third chat fallback
- Added aggressive line-level thinking-strip (scans entire reply, not just leading paragraphs)
- Added Strategy 5 for inline JSON artifact extraction (recovers artifacts the model emits as prose)
- Fixed duplicate system message bug (was sending system prompt twice to Groq)
- Hardened `cleanReplyText` to strip inline partial JSON
- Tightened system prompt with explicit GOOD/BAD examples
- Added `scripts/test-chat-cleanup.ts` — 24-test sanity suite
- Fixed pre-existing TypeScript error in `filterRefusalLoop`

## Testing

```bash
# Chat cleanup logic sanity test (no API key needed)
bun run scripts/test-chat-cleanup.ts
# → 24 passed, 0 failed
```

## License

Private. All rights reserved.
