create table public.paystack_orders (
  reference text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id text not null,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null check (currency in ('KES', 'USD')),
  coins integer not null check (coins >= 0),
  bonus_coins integer not null check (bonus_coins >= 0),
  pass_tier text check (pass_tier in ('daily', 'weekly', 'monthly')),
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  check ((pass_tier is null and coins > 0)
    or (pass_tier is not null and coins = 0 and bonus_coins = 0))
);

alter table public.paystack_orders enable row level security;
revoke all on public.paystack_orders from public, anon, authenticated;
grant select on public.paystack_orders to authenticated;
grant select, insert on public.paystack_orders to service_role;
create policy "View own Paystack orders" on public.paystack_orders
  for select to authenticated using (auth.uid() = user_id);

create function public.fulfill_paystack_order(
  p_reference text, p_amount_minor integer, p_currency text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.paystack_orders%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_duration interval;
begin
  select * into v_order from public.paystack_orders
  where reference = p_reference for update;

  if not found or v_order.amount_minor is distinct from p_amount_minor
    or v_order.currency is distinct from p_currency then
    return false;
  end if;

  if v_order.fulfilled_at is not null then
    return true;
  end if;

  if v_order.pass_tier is null then
    perform public.credit_user_coins(
      v_order.user_id, v_order.coins, v_order.bonus_coins, v_order.reference
    );
  else
    v_duration := case v_order.pass_tier
      when 'daily' then interval '24 hours'
      when 'weekly' then interval '168 hours'
      when 'monthly' then interval '720 hours'
    end;

    -- Serialize pass purchases even when there is no subscription row yet.
    perform pg_advisory_xact_lock(hashtextextended(v_order.user_id::text, 0));
    select * into v_subscription from public.subscriptions
    where user_id = v_order.user_id and is_active = true
    for update;

    if not found then
      insert into public.subscriptions (user_id, phone, tier, end_date, is_active)
      select v_order.user_id, coalesce(phone, ''), v_order.pass_tier, now() + v_duration, true
      from auth.users where id = v_order.user_id;
    elsif v_subscription.end_date is not null or v_subscription.tier = 'free' then
      update public.subscriptions
      set tier = v_order.pass_tier,
          end_date = greatest(
            case when v_subscription.tier = 'free' then now() else v_subscription.end_date end,
            now()
          ) + v_duration
      where id = v_subscription.id;
    end if;
  end if;

  update public.paystack_orders set fulfilled_at = now() where reference = p_reference;
  return true;
end;
$$;

revoke all on function public.fulfill_paystack_order(text, integer, text)
  from public, anon, authenticated;
grant execute on function public.fulfill_paystack_order(text, integer, text) to service_role;
