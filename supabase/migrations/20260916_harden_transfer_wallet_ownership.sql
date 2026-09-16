drop policy if exists transfers_own_all on public.transfers;

create policy transfers_own_all
on public.transfers
for all
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.wallets w
    where w.id = from_wallet_id and w.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.wallets w
    where w.id = to_wallet_id and w.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.wallets w
    where w.id = from_wallet_id and w.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.wallets w
    where w.id = to_wallet_id and w.user_id = (select auth.uid())
  )
);
