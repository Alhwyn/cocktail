# Plan: Securely link Supabase to Vercel (production)

This checklist connects your hosted Supabase project to Vercel **production** with sensible secrets hygiene. Your repo already documents a **pooler** `DATABASE_URL` in `.env.example`—use that pattern on Vercel for serverless-friendly Postgres access.

## 1. Prerequisites

- Supabase project in the dashboard (you already have a project ref in `.env.example`).
- Vercel project created and linked to this Git repo (Vercel dashboard → Import → select repo).
- Decide which **environments** need DB access:
  - **Production**: your live domain.
  - **Preview**: optional; often uses a separate DB or read-only credentials (see section 6).

## 2. Connection string (Postgres)

**Prefer Supabase Connection Pooling (transaction mode, port `6543`)** for anything running on Vercel’s serverless/edge-style runtimes. It matches the pattern in `.env.example` and avoids exhausting direct connections.

1. In Supabase: **Project Settings → Database**.
2. Under **Connection string**, choose **URI** and **Transaction pooler** (or equivalent wording).
3. Substitute `[YOUR-PASSWORD]` with the database password (reset it in the same screen if you do not have it).
4. **Do not** commit this URI. Store it only in Vercel **Environment Variables**.

If you see connection errors from Vercel to the pooler, check Supabase docs for your plan’s **IPv4/IPv6** notes; the pooler URL is usually the right fix before reaching for add-ons.

## 3. Vercel environment variables

In Vercel: **Project → Settings → Environment Variables**.


| Variable                    | Where to use                                                  | Notes                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`              | **Production** (and Preview only if intentional)              | Full pooler URI including password. Mark as sensitive.                                                                                     |
| `SUPABASE_URL`              | Production (if you use `@supabase/supabase-js`)               | Project URL from **Project Settings → API**.                                                                                               |
| `SUPABASE_ANON_KEY`         | Production **client** only if unavoidable                     | Safe for browser **only** with RLS enforced; scope to **Production** and optionally **Preview**.                                           |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** (API routes, server actions, background jobs) | **Never** expose to the browser. Never prefix with `NEXT_PUBLIC_` or `VITE_`. Production only unless you have a dedicated staging project. |


**Rules:**

- Set each variable’s **Environment** to **Production** (and add **Preview**/`Development` only when you have a clear split—see section 6).
- After saving, **redeploy** so new variables apply to the running build and serverless functions.
- For local dev, keep using `.env` (gitignored); do not paste production secrets into the repo.

## 4. Application wiring

- **Server-side Postgres** (e.g. `pg`, Drizzle, raw SQL): read `process.env.DATABASE_URL` only on the server. Never send the connection string to the client.
- **Supabase client (browser)**: use `SUPABASE_URL` + `SUPABASE_ANON_KEY` only; rely on **Row Level Security (RLS)** for every table exposed to the anon key.
- **Admin / bypass RLS**: use `SUPABASE_SERVICE_ROLE_KEY` only in trusted server code, never in client bundles.

Match variable names to whatever your framework expects (this repo uses Bun/React; if you add Vite-style public env vars, only put **anon** URL/key there, never the service role or `DATABASE_URL`).

## 5. Supabase security settings

1. **Authentication → URL configuration**: add your Vercel production URL (e.g. `https://your-app.vercel.app` and custom domain) to **Site URL** / redirect allow list if you use Supabase Auth.
2. **Database → RLS**: enable RLS on tables touched by the anon key; policies should enforce per-user or read-only rules as appropriate.
3. **API keys**: rotate keys in the dashboard if they were ever committed or leaked; update Vercel env vars and redeploy.

## 6. Preview and staging (recommended)

- **Option A (simplest):** Production DB variables only on **Production**; Preview deployments run without DB or with feature flags off.
- **Option B (safer):** Create a **second Supabase project** for staging; put staging URLs/keys in Vercel **Preview** environment so previews never touch production data.
- Never point **Preview** at production `DATABASE_URL` unless you accept the risk of test traffic and schema drift against live data.

## 7. Operational checklist

- Pooler `DATABASE_URL` set in Vercel **Production** (sensitive).
- If using Supabase JS: `SUPABASE_URL` + `SUPABASE_ANON_KEY` in Production; RLS verified on all relevant tables.
- `SUPABASE_SERVICE_ROLE_KEY` only on server-side env (if used at all).
- Auth redirect URLs include production (and staging) domains.
- No secrets in Git; `.env` remains gitignored.
- Redeploy after env changes; smoke-test a read/write path in production.

## 8. Optional hardening

- Use **least-privilege** DB roles if you outgrow the default `postgres` URL (custom role with limited grants).
- Enable **database backups** and note Supabase’s retention for your plan.
- Document a **rotation** procedure: new DB password or API key → update Vercel → redeploy.

---

*This file is a runbook for you and your team; keep it updated if you add Auth, Edge Functions, or separate staging projects.*