-- ==============================================================================
-- TubeTV: Microdrama Monetization, Coin Wallets & Episode Unlocks
-- Supports domestic Kenyan M-Pesa micro-unlocks & diaspora currency packages
-- ==============================================================================

-- 1. User Coin Wallets
create table if not exists public.user_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coin_balance integer not null default 0 check (coin_balance >= 0),
  bonus_coins integer not null default 0 check (bonus_coins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_wallets enable row level security;

drop policy if exists "Users can view their own wallet" on public.user_wallets;
create policy "Users can view their own wallet" on public.user_wallets
  for select to authenticated
  using (auth.uid() = user_id);

-- Automatically create wallet when user registers
create or replace function public.handle_user_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_wallets (user_id, coin_balance, bonus_coins)
  values (new.id, 20, 10) -- 30 welcome bonus coins for initial engagement
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_wallet on auth.users;
create trigger on_auth_user_created_wallet
  after insert on auth.users
  for each row execute function public.handle_user_wallet();

-- Backfill existing profiles with initial wallets
insert into public.user_wallets (user_id, coin_balance, bonus_coins)
select id, 20, 10 from auth.users
on conflict (user_id) do nothing;

-- 2. Episode Unlocks
create table if not exists public.episode_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  series_id text,
  unlock_method text not null check (unlock_method in ('free', 'coins', 'pass', 'ad', 'admin')),
  coins_spent integer not null default 0 check (coins_spent >= 0),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

alter table public.episode_unlocks enable row level security;

drop policy if exists "Users can view their episode unlocks" on public.episode_unlocks;
create policy "Users can view their episode unlocks" on public.episode_unlocks
  for select to authenticated
  using (auth.uid() = user_id);

create index if not exists episode_unlocks_user_series_idx
  on public.episode_unlocks (user_id, series_id);

-- 3. Coin Ledger (Audit Trail for Coin Deposits & Spends)
create table if not exists public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null, -- Positive for deposits, negative for unlocks
  balance_after integer not null check (balance_after >= 0),
  transaction_type text not null check (
    transaction_type in ('welcome_bonus', 'purchase', 'bonus', 'unlock', 'refund', 'ad_reward')
  ),
  reference_id text, -- Video GUID, Paystack Reference, or M-Pesa Receipt
  created_at timestamptz not null default now()
);

alter table public.coin_ledger enable row level security;

drop policy if exists "Users can view their coin ledger" on public.coin_ledger;
create policy "Users can view their coin ledger" on public.coin_ledger
  for select to authenticated
  using (auth.uid() = user_id);

create index if not exists coin_ledger_user_time_idx
  on public.coin_ledger (user_id, created_at desc);

-- 4. Atomic RPC Function: Unlock Episode with Coins
create or replace function public.unlock_episode_with_coins(
  p_video_id text,
  p_series_id text,
  p_cost integer default 10
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_wallet record;
  v_total_coins integer;
  v_deduct_bonus integer := 0;
  v_deduct_regular integer := 0;
  v_has_active_pass boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Authentication required.');
  end if;

  -- 1. Check if already unlocked
  if exists (select 1 from public.episode_unlocks where user_id = v_user_id and video_id = p_video_id) then
    return json_build_object('success', true, 'already_unlocked', true);
  end if;

  -- 2. Check if user holds an active VIP/Day Pass
  select exists (
    select 1 from public.subscriptions
    where user_id = v_user_id
      and is_active = true
      and (end_date is null or end_date > now())
  ) into v_has_active_pass;

  if v_has_active_pass then
    insert into public.episode_unlocks (user_id, video_id, series_id, unlock_method, coins_spent)
    values (v_user_id, p_video_id, p_series_id, 'pass', 0);
    return json_build_object('success', true, 'unlocked_via', 'vip_pass');
  end if;

  -- 3. Row lock wallet for atomic coin transaction
  select * into v_wallet
  from public.user_wallets
  where user_id = v_user_id
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'Wallet not found.');
  end if;

  v_total_coins := v_wallet.coin_balance + v_wallet.bonus_coins;
  if v_total_coins < p_cost then
    return json_build_object(
      'success', false,
      'error', 'Insufficient coins.',
      'required', p_cost,
      'balance', v_total_coins
    );
  end if;

  -- Spend bonus coins first, then regular coins
  if v_wallet.bonus_coins >= p_cost then
    v_deduct_bonus := p_cost;
    v_deduct_regular := 0;
  else
    v_deduct_bonus := v_wallet.bonus_coins;
    v_deduct_regular := p_cost - v_deduct_bonus;
  end if;

  -- Update wallet
  update public.user_wallets
  set bonus_coins = bonus_coins - v_deduct_bonus,
      coin_balance = coin_balance - v_deduct_regular,
      updated_at = now()
  where user_id = v_user_id;

  -- Record unlock
  insert into public.episode_unlocks (user_id, video_id, series_id, unlock_method, coins_spent)
  values (v_user_id, p_video_id, p_series_id, 'coins', p_cost);

  -- Record ledger
  insert into public.coin_ledger (user_id, amount, balance_after, transaction_type, reference_id)
  values (
    v_user_id,
    -p_cost,
    (v_wallet.coin_balance - v_deduct_regular) + (v_wallet.bonus_coins - v_deduct_bonus),
    'unlock',
    p_video_id
  );

  return json_build_object(
    'success', true,
    'unlocked_via', 'coins',
    'coins_spent', p_cost,
    'remaining_balance', (v_wallet.coin_balance - v_deduct_regular) + (v_wallet.bonus_coins - v_deduct_bonus)
  );
end;
$$;

grant execute on function public.unlock_episode_with_coins(text, text, integer) to authenticated;

-- 5. Service Role RPC: Credit Coins from Payment Webhook
create or replace function public.credit_user_coins(
  p_user_id uuid,
  p_regular_coins integer,
  p_bonus_coins integer,
  p_reference_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_regular integer;
  v_new_bonus integer;
begin
  insert into public.user_wallets (user_id, coin_balance, bonus_coins)
  values (p_user_id, p_regular_coins, p_bonus_coins)
  on conflict (user_id) do update
    set coin_balance = public.user_wallets.coin_balance + p_regular_coins,
        bonus_coins = public.user_wallets.bonus_coins + p_bonus_coins,
        updated_at = now()
  returning coin_balance, bonus_coins into v_new_regular, v_new_bonus;

  insert into public.coin_ledger (user_id, amount, balance_after, transaction_type, reference_id)
  values (
    p_user_id,
    p_regular_coins + p_bonus_coins,
    v_new_regular + v_new_bonus,
    'purchase',
    p_reference_id
  );

  return json_build_object(
    'success', true,
    'coin_balance', v_new_regular,
    'bonus_coins', v_new_bonus,
    'total', v_new_regular + v_new_bonus
  );
end;
$$;

revoke all on function public.credit_user_coins(uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function public.credit_user_coins(uuid, integer, integer, text) to service_role;
