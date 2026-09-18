-- Lar Finance V3.6 — Wealth & Organization
-- Additive migration. Existing transaction rows are preserved.

alter table public.transactions
  add column if not exists tags text[] not null default '{}'::text[];

alter table public.transaction_trash
  add column if not exists tags text[] not null default '{}'::text[];

create table if not exists public.sinking_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  target_amount numeric not null check (target_amount > 0),
  target_date date,
  emoji text not null default '🎯',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sinking_fund_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  fund_id uuid not null references public.sinking_funds(id) on delete cascade,
  amount numeric not null check (amount > 0),
  contribution_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sinking_funds_user
  on public.sinking_funds(user_id, created_at);
create index if not exists idx_sinking_contributions_user_fund
  on public.sinking_fund_contributions(user_id, fund_id, contribution_date desc);

alter table public.sinking_funds enable row level security;
alter table public.sinking_fund_contributions enable row level security;

drop policy if exists sinking_funds_own_all on public.sinking_funds;
create policy sinking_funds_own_all
on public.sinking_funds for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists sinking_contributions_own_all on public.sinking_fund_contributions;
create policy sinking_contributions_own_all
on public.sinking_fund_contributions for all to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.sinking_funds f
    where f.id = fund_id and f.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.sinking_funds f
    where f.id = fund_id and f.user_id = auth.uid()
  )
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  kind text not null check (kind in ('payable','receivable')),
  counterparty text not null,
  original_amount numeric not null check (original_amount > 0),
  due_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payment_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_debts_user_kind
  on public.debts(user_id, kind, created_at);
create index if not exists idx_debt_payments_user_debt
  on public.debt_payments(user_id, debt_id, payment_date desc);

alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;

drop policy if exists debts_own_all on public.debts;
create policy debts_own_all
on public.debts for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists debt_payments_own_all on public.debt_payments;
create policy debt_payments_own_all
on public.debt_payments for all to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.debts d
    where d.id = debt_id and d.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.debts d
    where d.id = debt_id and d.user_id = auth.uid()
  )
);

create table if not exists public.net_worth_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  item_type text not null check (item_type in ('asset','liability')),
  name text not null,
  value numeric not null check (value >= 0),
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_net_worth_items_user_type
  on public.net_worth_items(user_id, item_type, created_at);

alter table public.net_worth_items enable row level security;

drop policy if exists net_worth_items_own_all on public.net_worth_items;
create policy net_worth_items_own_all
on public.net_worth_items for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create table if not exists public.transaction_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  type text not null check (type in ('income','expense')),
  amount numeric not null check (amount > 0),
  transaction_date date not null default current_date,
  description text,
  wallet_id uuid references public.wallets(id) on delete set null,
  suggested_category_id integer references public.categories(id) on delete set null,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create index if not exists idx_transaction_inbox_user_created
  on public.transaction_inbox(user_id, created_at desc);

alter table public.transaction_inbox enable row level security;

drop policy if exists transaction_inbox_own_all on public.transaction_inbox;
create policy transaction_inbox_own_all
on public.transaction_inbox for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    wallet_id is null
    or exists (
      select 1 from public.wallets w
      where w.id = wallet_id and w.user_id = auth.uid()
    )
  )
  and (
    suggested_category_id is null
    or exists (
      select 1 from public.categories c
      where c.id = suggested_category_id
        and (c.user_id = auth.uid() or c.user_id is null)
    )
  )
);

create table if not exists public.financial_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  note_month date not null,
  title text,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, note_month)
);

create index if not exists idx_financial_notes_user_month
  on public.financial_notes(user_id, note_month desc);

alter table public.financial_notes enable row level security;

drop policy if exists financial_notes_own_all on public.financial_notes;
create policy financial_notes_own_all
on public.financial_notes for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.post_inbox_item(
  p_item_id uuid,
  p_category_id integer,
  p_wallet_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.transaction_inbox%rowtype;
  v_category_type text;
  v_wallet_name text;
  v_new_id integer;
begin
  select *
  into v_item
  from public.transaction_inbox
  where id = p_item_id
    and user_id = auth.uid()
  for update;

  if not found then raise exception 'Inbox item not found'; end if;

  select c.type into v_category_type
  from public.categories c
  where c.id = p_category_id
    and (c.user_id = auth.uid() or c.user_id is null);

  if v_category_type is null then raise exception 'Category not available'; end if;
  if v_category_type <> v_item.type then raise exception 'Category type does not match inbox item'; end if;

  select w.name into v_wallet_name
  from public.wallets w
  where w.id = p_wallet_id
    and w.user_id = auth.uid();

  if v_wallet_name is null then raise exception 'Wallet not available'; end if;

  insert into public.transactions (
    category_id, amount, transaction_date, description, payment_method,
    user_id, wallet_id, tags
  )
  values (
    p_category_id, v_item.amount, v_item.transaction_date,
    coalesce(nullif(trim(v_item.description), ''), case when v_item.type = 'income' then 'Pemasukan' else 'Pengeluaran' end),
    v_wallet_name, v_item.user_id, p_wallet_id, v_item.tags
  )
  returning id into v_new_id;

  delete from public.transaction_inbox
  where id = p_item_id and user_id = auth.uid();

  return v_new_id;
end;
$$;

revoke all on function public.post_inbox_item(uuid, integer, uuid) from public, anon;
grant execute on function public.post_inbox_item(uuid, integer, uuid) to authenticated;

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
  select * into v_tx
  from public.transactions
  where id = p_transaction_id and user_id = auth.uid()
  for update;

  if not found then raise exception 'Transaction not found'; end if;

  insert into public.transaction_trash (
    user_id, original_transaction_id, category_id, amount, transaction_date,
    description, payment_method, original_created_at, wallet_id, split_group_id, tags
  )
  values (
    v_tx.user_id, v_tx.id, v_tx.category_id, v_tx.amount, v_tx.transaction_date,
    v_tx.description, v_tx.payment_method, v_tx.created_at, v_tx.wallet_id, v_tx.split_group_id, v_tx.tags
  )
  returning id into v_trash_id;

  delete from public.transactions
  where id = v_tx.id and user_id = auth.uid();

  return v_trash_id;
end;
$$;

create or replace function public.restore_transaction(p_trash_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trash public.transaction_trash%rowtype;
  v_new_id integer;
begin
  select * into v_trash
  from public.transaction_trash
  where id = p_trash_id and user_id = auth.uid()
  for update;

  if not found then raise exception 'Trash item not found'; end if;
  if v_trash.expires_at < now() then raise exception 'Restore window has expired'; end if;

  if v_trash.category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = v_trash.category_id
      and (c.user_id = auth.uid() or c.user_id is null)
  ) then raise exception 'Category is no longer available'; end if;

  if v_trash.wallet_id is not null and not exists (
    select 1 from public.wallets w
    where w.id = v_trash.wallet_id and w.user_id = auth.uid()
  ) then raise exception 'Wallet is no longer available'; end if;

  insert into public.transactions (
    category_id, amount, transaction_date, description, payment_method,
    created_at, user_id, wallet_id, split_group_id, tags
  )
  values (
    v_trash.category_id, v_trash.amount, v_trash.transaction_date,
    v_trash.description, v_trash.payment_method, v_trash.original_created_at,
    v_trash.user_id, v_trash.wallet_id, v_trash.split_group_id, v_trash.tags
  )
  returning id into v_new_id;

  delete from public.transaction_trash
  where id = p_trash_id and user_id = auth.uid();

  return v_new_id;
end;
$$;

revoke all on function public.trash_transaction(integer) from public, anon;
revoke all on function public.restore_transaction(uuid) from public, anon;
grant execute on function public.trash_transaction(integer) to authenticated;
grant execute on function public.restore_transaction(uuid) to authenticated;
