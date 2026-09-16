create or replace function public.post_recurring_transaction(recurring_uuid uuid, post_date date default current_date)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.recurring_transactions%rowtype;
  wallet_name text;
  inserted_id integer;
  period_start date := date_trunc('month', post_date)::date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into r
  from public.recurring_transactions
  where id = recurring_uuid and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Recurring transaction not found';
  end if;

  if r.last_posted_month = period_start then
    raise exception 'Recurring transaction already posted for this month';
  end if;

  select name into wallet_name
  from public.wallets
  where id = r.wallet_id and user_id = auth.uid();

  if wallet_name is null then
    raise exception 'Wallet not found';
  end if;

  insert into public.transactions (
    user_id, amount, transaction_date, description, category_id, wallet_id, payment_method
  ) values (
    auth.uid(), r.amount, post_date, coalesce(nullif(r.description, ''), r.name), r.category_id, r.wallet_id, wallet_name
  ) returning id into inserted_id;

  update public.recurring_transactions
  set last_posted_month = period_start, updated_at = now()
  where id = r.id;

  return inserted_id;
end;
$$;

revoke execute on function public.post_recurring_transaction(uuid, date) from public, anon;
grant execute on function public.post_recurring_transaction(uuid, date) to authenticated, service_role;
