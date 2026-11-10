-- ==============================================================================
-- Migration: Single Device Concurrency & KSh 149 Monthly Subscription
-- ==============================================================================

-- 1. Add active_device_id to public.subscriptions for 1-device concurrency enforcement
alter table public.subscriptions
  add column if not exists active_device_id text;

create index if not exists subscriptions_active_device_idx
  on public.subscriptions (active_device_id)
  where active_device_id is not null;

-- 2. Update fulfill_paystack_payment to recognise KSh 149 as Monthly Pass
create or replace function public.fulfill_paystack_payment(
  p_reference text,
  p_amount_kes integer,
  p_channel text default 'mobile_money',
  p_paid_at timestamptz default now(),
  p_customer_email text default null,
  p_phone text default null,
  p_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.payment_transactions%rowtype;
  v_clean_ref text := upper(trim(coalesce(p_reference, '')));
  v_active_sub public.subscriptions%rowtype;
  v_now timestamptz := coalesce(p_paid_at, now());
  v_base timestamptz;
  v_days integer;
  v_new_sub public.subscriptions%rowtype;
  v_plan text;
begin
  if v_clean_ref = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_reference');
  end if;

  select * into v_tx
  from public.payment_transactions
  where upper(paystack_reference) = v_clean_ref
     or upper(mpesa_receipt) = v_clean_ref
     or upper(checkout_request_id) = v_clean_ref
  for update;

  -- If transaction was not pre-created, infer plan from amount (Monthly is now KSh 149)
  if not found then
    v_plan := case
      when p_amount_kes >= 149 then 'monthly'
      when p_amount_kes >= 50 then 'weekly'
      else 'daily'
    end;

    insert into public.payment_transactions (
      user_id,
      phone_e164,
      plan_code,
      amount_kes,
      idempotency_key,
      paystack_reference,
      provider,
      channel,
      customer_email,
      status,
      created_at
    ) values (
      null,
      p_phone,
      v_plan,
      p_amount_kes,
      'paystack_' || v_clean_ref,
      v_clean_ref,
      'paystack',
      p_channel,
      p_customer_email,
      'pending',
      v_now
    )
    returning * into v_tx;
  else
    v_plan := coalesce(v_tx.plan_code, case
      when p_amount_kes >= 149 then 'monthly'
      when p_amount_kes >= 50 then 'weekly'
      else 'daily'
    end);
  end if;

  if v_tx.status = 'succeeded' then
    select * into v_active_sub
    from public.subscriptions
    where (upper(payment_reference) = v_clean_ref or upper(mpesa_ref) = v_clean_ref)
      and is_active = true
    order by end_date desc
    limit 1;

    if found then
      return jsonb_build_object('ok', true, 'reused', true, 'subscription_id', v_active_sub.id);
    end if;
  end if;

  update public.payment_transactions
  set status = 'succeeded',
      channel = coalesce(p_channel, channel),
      customer_email = coalesce(p_customer_email, customer_email),
      phone_e164 = coalesce(phone_e164, p_phone),
      result_code = 0,
      result_description = 'Payment successful via Paystack'
  where id = v_tx.id;

  v_days := case v_plan
    when 'monthly' then 30
    when 'weekly' then 7
    else 1
  end;

  v_base := case
    when v_active_sub.id is not null and v_active_sub.end_date is not null and v_active_sub.end_date > v_now
      then v_active_sub.end_date
    else v_now
  end;

  if v_tx.user_id is not null then
    update public.subscriptions
    set is_active = false
    where user_id = v_tx.user_id and is_active = true;
  elsif v_active_sub.id is not null then
    update public.subscriptions
    set is_active = false
    where id = v_active_sub.id;
  end if;

  insert into public.subscriptions (
    user_id,
    phone,
    tier,
    mpesa_ref,
    payment_reference,
    provider,
    start_date,
    end_date,
    is_active,
    active_device_id
  ) values (
    v_tx.user_id,
    coalesce(v_tx.phone_e164, p_phone),
    v_plan,
    v_clean_ref,
    v_clean_ref,
    'paystack',
    v_now,
    v_base + make_interval(days => v_days),
    true,
    p_device_id
  )
  returning * into v_new_sub;

  return jsonb_build_object(
    'ok', true,
    'reused', false,
    'subscription_id', v_new_sub.id,
    'tier', v_new_sub.tier,
    'end_date', v_new_sub.end_date
  );
end;
$$;
