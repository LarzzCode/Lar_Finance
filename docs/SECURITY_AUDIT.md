# Lar Finance V2 — Security & Data Correctness Audit

Last reviewed: 2026-09-16

## Scope

This audit covers the React/Vite frontend repository only. The repository does **not** contain Supabase migrations or the live Row Level Security (RLS) policy definitions, so the current production database policy state cannot be verified from GitHub alone.

No database migration, table change, data reset, or destructive SQL was executed as part of this audit.

## What is already protected in the V2 frontend

- Dashboard queries scope financial data with `user_id = auth user id`.
- Reports load transactions, categories, and wallets for the authenticated user only.
- Budgeting loads and mutates budgets using the authenticated user id.
- Savings goals load/update/delete with the authenticated user id.
- Subscription data is scoped to the authenticated user.
- Transaction creation always writes `user_id` from the active Supabase session.
- Environment files are ignored by git.

## V2.1 hardening applied

### Transaction input

- Categories are filtered by `user_id` and transaction type.
- Wallets are filtered by `user_id`.
- Monthly transactions used for wallet balance/category frequency are filtered by `user_id`.
- The selected wallet and category must exist in the authenticated user's loaded dataset before insert.
- Transaction amounts must be positive.

### Wallets

- Wallet reads are scoped by `user_id`.
- Wallet update/delete operations are scoped by `user_id`.
- A wallet cannot be deleted through the UI while transactions still reference it.
- Existing balance semantics are intentionally preserved: `saldo_awal + income_this_month - expense_this_month`.

### Categories

- Category reads/updates/deletes are scoped by `user_id`.
- Duplicate category names of the same type are blocked in the UI.
- Before delete, the app checks references from transactions, budgets, and subscriptions.
- Referenced categories are protected from deletion through the UI.

### Recurring subscriptions

The database currently has no documented `subscription_id` relation on transactions. To stay backward compatible without a schema migration, paid-state matching now requires:

1. normalized description equals subscription name,
2. transaction amount equals subscription amount, and
3. category matches when a category id is available.

This is safer than name-only matching, but a direct relational key is still the recommended long-term design.

## Important database checks still required

Before enabling or replacing RLS policies in production, run the preflight queries in `supabase/rls_preflight.sql` from the Supabase SQL Editor and review the output.

Do **not** enable restrictive policies before confirming that historical rows have correct `user_id` values. Rows with a missing or incorrect owner could appear to disappear after RLS is enforced even though they still exist in the database.

Tables expected to be user-owned:

- `profiles` (`id = auth.uid()`)
- `transactions`
- `categories`
- `wallets`
- `budgets`
- `subscriptions`
- `goals`

## Supabase Storage

Avatar uploads currently use the existing public `avatars` bucket behavior. Storage policies are not present in this repository, so they were not changed automatically.

Recommended later audit:

- authenticated users can upload only their own avatar object,
- users cannot overwrite/delete another user's object,
- public read is intentional if avatars are public.

Do not change the upload path or storage policies until the current bucket policy is inspected in Supabase.

## Remaining architectural improvements

These are intentionally deferred because they require schema/database decisions:

1. Add a direct `subscription_id` reference to subscription payment transactions.
2. Decide whether wallet balances are monthly snapshots or true lifetime account balances.
3. Version database migrations/policies in the repository (`supabase/migrations`).
4. Add automated tests for data ownership and finance calculations.

## Rule for future changes

Frontend filtering is defense-in-depth, **not a replacement for RLS**. Production Supabase tables that contain personal finance data should enforce ownership at the database layer even if every frontend query includes `user_id`.
