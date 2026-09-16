create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense')),
  amount numeric not null check (amount > 0),
  category_id integer not null references public.categories(id) on delete restrict,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  day_of_month integer not null check (day_of_month between 1 and 31),
  description text,
  is_active boolean not null default true,
  last_posted_month date,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now()
);

create index if not exists idx_recurring_transactions_user_id on public.recurring_transactions(user_id);
create index if not exists idx_recurring_transactions_wallet_id on public.recurring_transactions(wallet_id);
create index if not exists idx_recurring_transactions_category_id on public.recurring_transactions(category_id);
create index if not exists idx_recurring_transactions_active_day on public.recurring_transactions(user_id, is_active, day_of_month);

alter table public.recurring_transactions enable row level security;

drop policy if exists recurring_transactions_own_all on public.recurring_transactions;
create policy recurring_transactions_own_all
on public.recurring_transactions
for all
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.wallets w
    where w.id = wallet_id and w.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.categories c
    where c.id = category_id
      and (c.user_id is null or c.user_id = (select auth.uid()))
      and c.type = type
  )
);
