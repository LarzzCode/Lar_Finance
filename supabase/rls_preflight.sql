-- Lar Finance V2 — Supabase RLS preflight
-- READ-ONLY audit queries. This file is intentionally not executed by the app.
-- Run manually in Supabase SQL Editor before changing any RLS policy.

-- 1) Inspect current RLS state for Lar Finance tables.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles',
    'transactions',
    'categories',
    'wallets',
    'budgets',
    'subscriptions',
    'goals'
  )
order by c.relname;

-- 2) Inspect currently installed policies.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'transactions',
    'categories',
    'wallets',
    'budgets',
    'subscriptions',
    'goals'
  )
order by tablename, policyname;

-- 3) Check rows that have no owner. Any non-zero result must be investigated
-- BEFORE enabling restrictive RLS, otherwise historical rows may become hidden.
select 'transactions' as table_name, count(*) as rows_without_owner from public.transactions where user_id is null
union all
select 'categories', count(*) from public.categories where user_id is null
union all
select 'wallets', count(*) from public.wallets where user_id is null
union all
select 'budgets', count(*) from public.budgets where user_id is null
union all
select 'subscriptions', count(*) from public.subscriptions where user_id is null
union all
select 'goals', count(*) from public.goals where user_id is null;

-- 4) Check ownership distribution. Review whether the UUIDs are expected users.
select 'transactions' as table_name, user_id, count(*) as row_count from public.transactions group by user_id
union all
select 'categories', user_id, count(*) from public.categories group by user_id
union all
select 'wallets', user_id, count(*) from public.wallets group by user_id
union all
select 'budgets', user_id, count(*) from public.budgets group by user_id
union all
select 'subscriptions', user_id, count(*) from public.subscriptions group by user_id
union all
select 'goals', user_id, count(*) from public.goals group by user_id
order by table_name, row_count desc;

-- 5) Find orphan references that should be reviewed before tightening constraints.
select 'transactions.category_id -> categories' as check_name, count(*) as orphan_count
from public.transactions t
left join public.categories c on c.id = t.category_id
where t.category_id is not null and c.id is null
union all
select 'transactions.wallet_id -> wallets', count(*)
from public.transactions t
left join public.wallets w on w.id = t.wallet_id
where t.wallet_id is not null and w.id is null
union all
select 'budgets.category_id -> categories', count(*)
from public.budgets b
left join public.categories c on c.id = b.category_id
where b.category_id is not null and c.id is null
union all
select 'subscriptions.category_id -> categories', count(*)
from public.subscriptions s
left join public.categories c on c.id = s.category_id
where s.category_id is not null and c.id is null;

-- POLICY TEMPLATE (DO NOT RUN BLINDLY)
-- After reviewing all results above, the intended ownership rule for ordinary
-- user-owned tables is conceptually:
--
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id)
--
-- Profiles normally use:
--
--   USING (auth.uid() = id)
--   WITH CHECK (auth.uid() = id)
--
-- Existing production policies must be reviewed before creating/replacing them.
