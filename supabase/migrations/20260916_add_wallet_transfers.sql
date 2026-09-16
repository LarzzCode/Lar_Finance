create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_wallet_id uuid not null references public.wallets(id) on delete restrict,
  to_wallet_id uuid not null references public.wallets(id) on delete restrict,
  amount numeric not null check (amount > 0),
  transfer_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  constraint transfers_distinct_wallets check (from_wallet_id <> to_wallet_id)
);

alter table public.transfers enable row level security;

drop policy if exists transfers_own_all on public.transfers;
create policy transfers_own_all
on public.transfers
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists idx_transfers_user_date on public.transfers(user_id, transfer_date desc);
create index if not exists idx_transfers_from_wallet on public.transfers(from_wallet_id);
create index if not exists idx_transfers_to_wallet on public.transfers(to_wallet_id);
