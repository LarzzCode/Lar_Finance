alter table public.transactions
  add column if not exists split_group_id uuid;

create index if not exists idx_transactions_split_group_id
  on public.transactions(split_group_id)
  where split_group_id is not null;

create table if not exists public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text,
  transaction_type text not null check (transaction_type in ('income','expense')),
  match_field text not null default 'description' check (match_field in ('description')),
  match_operator text not null default 'contains' check (match_operator in ('contains','equals','starts_with')),
  match_value text not null,
  category_id integer not null references public.categories(id) on delete restrict,
  wallet_id uuid references public.wallets(id) on delete set null,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_category_rules_user_active_priority
  on public.category_rules(user_id, is_active, priority, created_at);

alter table public.category_rules enable row level security;

drop policy if exists category_rules_own_all on public.category_rules;
create policy category_rules_own_all
on public.category_rules
for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.categories c
    where c.id = category_id
      and (c.user_id = auth.uid() or c.user_id is null)
  )
  and (
    wallet_id is null
    or exists (
      select 1
      from public.wallets w
      where w.id = wallet_id and w.user_id = auth.uid()
    )
  )
);

create table if not exists public.wallet_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  amount numeric not null check (amount <> 0),
  adjustment_date date not null default current_date,
  expected_balance numeric not null,
  actual_balance numeric not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_wallet_adjustments_user_wallet_date
  on public.wallet_adjustments(user_id, wallet_id, adjustment_date desc);

alter table public.wallet_adjustments enable row level security;

drop policy if exists wallet_adjustments_own_all on public.wallet_adjustments;
create policy wallet_adjustments_own_all
on public.wallet_adjustments
for all
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.wallets w
    where w.id = wallet_id and w.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.wallets w
    where w.id = wallet_id and w.user_id = auth.uid()
  )
);

create table if not exists public.transaction_trash (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  original_transaction_id integer not null,
  category_id integer references public.categories(id) on delete restrict,
  amount numeric not null,
  transaction_date date,
  description text,
  payment_method text,
  original_created_at timestamp without time zone,
  wallet_id uuid references public.wallets(id) on delete restrict,
  split_group_id uuid,
  trashed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists idx_transaction_trash_user_trashed
  on public.transaction_trash(user_id, trashed_at desc);

alter table public.transaction_trash enable row level security;

drop policy if exists transaction_trash_own_all on public.transaction_trash;
create policy transaction_trash_own_all
on public.transaction_trash
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.trash_transaction(p_transaction_id integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.transactions%rowtype;
  v_trash_id uuid;
begin
  select *
  into v_tx
  from public.transactions
  where id = p_transaction_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  insert into public.transaction_trash (
    user_id, original_transaction_id, category_id, amount, transaction_date,
    description, payment_method, original_created_at, wallet_id, split_group_id
  )
  values (
    v_tx.user_id, v_tx.id, v_tx.category_id, v_tx.amount, v_tx.transaction_date,
    v_tx.description, v_tx.payment_method, v_tx.created_at, v_tx.wallet_id, v_tx.split_group_id
  )
  returning id into v_trash_id;

  delete from public.transactions
  where id = v_tx.id
    and user_id = auth.uid();

  return v_trash_id;
end;
$$;

revoke all on function public.trash_transaction(integer) from public, anon;
grant execute on function public.trash_transaction(integer) to authenticated;
