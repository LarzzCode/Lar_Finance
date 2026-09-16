# Lar Finance V2

Lar Finance is a personal finance management web app built with React, Vite, Tailwind CSS, and Supabase.

## Core features

- Supabase authentication and user profiles
- Monthly cashflow dashboard
- Income and expense tracking
- Wallet management
- Categories with custom icons
- Monthly budgeting and spending progress
- Recurring subscription tracking
- Savings goals
- Reports with charts and Excel export
- PWA support

## Security and data correctness

The V2 frontend scopes user-owned financial queries with the authenticated Supabase user id and adds guards for destructive actions such as deleting wallets or categories that are still referenced by financial records.

See `docs/SECURITY_AUDIT.md` for the current audit notes and `supabase/rls_preflight.sql` for read-only checks to run before changing production RLS policies.

> Important: frontend filtering is defense-in-depth and does not replace Supabase Row Level Security.

## Development

```bash
npm install
npm run dev
```

Create local environment variables for:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_KEY=
```

Environment files are excluded from git.

## Production

Live app: https://finance-app-lar.vercel.app/
