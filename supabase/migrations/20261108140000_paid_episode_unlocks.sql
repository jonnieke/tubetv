-- New viewers can watch the two public episodes without a wallet grant.
-- Keep all existing balances and legitimate permanent unlocks.
create or replace function public.handle_user_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_wallets (user_id)
  values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function public.unlock_episode_with_coins(
  p_video_id text, p_series_id text, p_cost integer default 1
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.user_wallets%rowtype;
  v_balance integer;
begin
  if v_user_id is null or not exists (
    select 1 from auth.users u where u.id = v_user_id
      and not coalesce(u.is_anonymous, false)
      and coalesce(lower(u.email), '') not like '%@viewer.tube.co.ke'
      and ((u.phone is not null and u.phone_confirmed_at is not null)
        or (u.email is not null and u.email_confirmed_at is not null))
  ) then
    return json_build_object('success', false, 'error', 'Sign in with a verified account.');
  end if;

  if p_cost is distinct from 1 or p_video_id is null
      or p_video_id !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    return json_build_object('success', false, 'error', 'Invalid episode or coin price.');
  end if;

  -- Serialize all coin spends for the viewer, including repeated requests.
  insert into public.user_wallets (user_id) values (v_user_id) on conflict (user_id) do nothing;
  select * into v_wallet from public.user_wallets where user_id = v_user_id for update;
  v_balance := v_wallet.coin_balance + v_wallet.bonus_coins;

  if exists (
    select 1 from public.episode_unlocks
    where user_id = v_user_id and video_id = p_video_id
      and (unlock_method = 'admin' or (unlock_method = 'coins' and coins_spent >= 1))
  ) or exists (
    select 1 from public.subscriptions
    where user_id = v_user_id and is_active = true and tier <> 'free'
      and (end_date is null or end_date > now())
  ) then
    return json_build_object('success', true, 'already_unlocked', true, 'remaining_balance', v_balance);
  end if;

  if v_balance < 1 then
    return json_build_object('success', false, 'error', 'Insufficient coins.');
  end if;

  update public.user_wallets
  set bonus_coins = bonus_coins - case when v_wallet.bonus_coins > 0 then 1 else 0 end,
      coin_balance = coin_balance - case when v_wallet.bonus_coins > 0 then 0 else 1 end,
      updated_at = now()
  where user_id = v_user_id;

  -- A legacy VIP grant or zero-cost row is not a permanent purchase.
  insert into public.episode_unlocks (user_id, video_id, series_id, unlock_method, coins_spent)
  values (v_user_id, p_video_id, p_series_id, 'coins', 1)
  on conflict (user_id, video_id) do update
    set series_id = excluded.series_id, unlock_method = 'coins', coins_spent = 1, unlocked_at = now();

  insert into public.coin_ledger (user_id, amount, balance_after, transaction_type, reference_id)
  values (v_user_id, -1, v_balance - 1, 'unlock', p_video_id);

  return json_build_object('success', true, 'remaining_balance', v_balance - 1);
end;
$$;

revoke all on function public.unlock_episode_with_coins(text, text, integer) from public, anon;
grant execute on function public.unlock_episode_with_coins(text, text, integer) to authenticated;
