# OCPDC Payroll Tracker

Compliance dashboard for tracking employee payroll documentation and monthly checklist completion.

## Stack

- TanStack Start v1, React 19, Vite 8, TypeScript
- Tailwind CSS v4 (Navy Trust theme)
- shadcn/ui, TanStack Query, Recharts
- Supabase (PostgreSQL, Auth, RLS)

## Setup

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Create a Supabase project and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key)
- `SUPABASE_SERVICE_ROLE_KEY`

3. Apply the database migration in the Supabase SQL editor or CLI:

```
supabase/migrations/20250604000000_initial_schema.sql
```

4. Run the seed script:

```
supabase/seed.sql
```

5. Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with username `ocpdc_admin` and password `adminocpdc123`.

## Deploy to Vercel

This app uses **TanStack Start + Nitro** (not a manual `api/` handler). Steps:

1. Push the repo to GitHub and import it in [Vercel](https://vercel.com).
2. **Framework preset:** Vercel should auto-detect Nitro. Build command: `npm run build`.
3. Add these **Environment Variables** in Vercel → Project → Settings → Environment Variables (all environments: Production, Preview, Development):

| Variable                        | Required        |
| ------------------------------- | --------------- |
| `VITE_SUPABASE_URL`             | Yes             |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes             |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes (audit log) |

4. Redeploy after saving env vars.

If you see `FUNCTION_INVOCATION_FAILED` / 500, the usual causes are:

- Missing Supabase env vars on Vercel (the server throws on startup/request).
- Old deployment config using `api/[[...index]].ts` and `outputDirectory: dist/client` — removed in favor of Nitro’s `.vercel/output`.

## Scripts

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `npm run dev`     | Development server (port 3000) |
| `npm run build`   | Production build               |
| `npm run preview` | Preview production build       |

## Routes

| Path         | Access                                                         |
| ------------ | -------------------------------------------------------------- |
| `/login`     | Public                                                         |
| `/dashboard` | Authenticated                                                  |
| `/tracker`   | Authenticated (`tracker.edit` for writes)                      |
| `/employees` | Authenticated (admin/manager or `employees.manage` for writes) |
| `/audit`     | Admin only                                                     |
| `/settings`  | Admin only (custom fields management)                          |

**Note:** The entire application is restricted to users with the `admin` role.
