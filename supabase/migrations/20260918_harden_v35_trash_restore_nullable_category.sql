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
  select *
  into v_trash
  from public.transaction_trash
  where id = p_trash_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Trash item not found';
  end if;

  if v_trash.category_id is not null and not exists (
    select 1
    from public.categories c
    where c.id = v_trash.category_id
      and (c.user_id = auth.uid() or c.user_id is null)
  ) then
    raise exception 'Category is no longer available';
  end if;

  if v_trash.wallet_id is not null and not exists (
    select 1
    from public.wallets w
    where w.id = v_trash.wallet_id
      and w.user_id = auth.uid()
  ) then
    raise exception 'Wallet is no longer available';
  end if;

  insert into public.transactions (
    category_id, amount, transaction_date, description, payment_method,
    created_at, user_id, wallet_id, split_group_id
  )
  values (
    v_trash.category_id, v_trash.amount, v_trash.transaction_date,
    v_trash.description, v_trash.payment_method, v_trash.original_created_at,
    v_trash.user_id, v_trash.wallet_id, v_trash.split_group_id
  )
  returning id into v_new_id;

  delete from public.transaction_trash
  where id = p_trash_id
    and user_id = auth.uid();

  return v_new_id;
end;
$$;

revoke all on function public.restore_transaction(uuid) from public, anon;
grant execute on function public.restore_transaction(uuid) to authenticated;
