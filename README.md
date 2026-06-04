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

4. Create the admin auth user in Supabase Dashboard → Authentication → Users:

- Email: `ocpdc_admin@ocpdc.local`
- Password: `adminocpdc123`

5. Run the seed script:

```
supabase/seed.sql
```

6. Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with username `ocpdc_admin` and password `adminocpdc123`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (port 3000) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Routes

| Path | Access |
|------|--------|
| `/login` | Public |
| `/dashboard` | Authenticated |
| `/tracker` | Authenticated (`tracker.edit` for writes) |
| `/employees` | Authenticated (admin/manager or `employees.manage` for writes) |
| `/audit` | Admin only |
| `/settings` | Admin only (custom fields management) |

**Note:** The entire application is restricted to users with the `admin` role.
