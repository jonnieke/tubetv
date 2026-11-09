-- TubeTV Paystack Payment Gateway Integration
-- Adds Paystack transaction reference and channels to payment_transactions and subscriptions,
-- and defines an atomic fulfillment RPC for Paystack webhooks and instant verify polling.

alter table public.payment_transactions
  add column if not exists provider text not null default 'mpesa';

alter table public.payment_transactions
  add column if not exists paystack_reference text;

alter table public.payment_transactions
  add column if not exists paystack_access_code text;

alter table public.payment_transactions
  add column if not exists channel text;

alter table public.payment_transactions
  add column if not exists customer_email text;

create unique index if not exists payment_transactions_paystack_ref_uidx
  on public.payment_transactions (upper(paystack_reference))
  where paystack_reference is not null;

alter table public.subscriptions
  add column if not exists provider text not null default 'mpesa';

alter table public.subscriptions
  add column if not exists payment_reference text;

create index if not exists subscriptions_payment_ref_idx
  on public.subscriptions (upper(payment_reference))
  where payment_reference is not null;

-- Atomic fulfillment for Paystack transactions
create or replace function public.fulfill_paystack_payment(
  p_reference text,
  p_amount_kes integer,
  p_channel text default 'mobile_money',
  p_paid_at timestamptz default now(),
  p_customer_email text default null,
  p_phone text default null
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

  -- If transaction was not pre-created, infer plan from amount
  if not found then
    v_plan := case
      when p_amount_kes >= 249 then 'monthly'
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
    v_plan := v_tx.plan_code;
  end if;

  -- Idempotency check: if already succeeded, return existing active subscription
  if v_tx.status = 'succeeded' then
    select * into v_active_sub
    from public.subscriptions
    where upper(mpesa_ref) = v_clean_ref
       or upper(payment_reference) = v_clean_ref
    order by end_date desc nulls last
    limit 1;

    if found then
      return jsonb_build_object(
        'ok', true,
        'reused', true,
        'subscription_id', v_active_sub.id,
        'tier', v_active_sub.tier,
        'end_date', v_active_sub.end_date,
        'reference', v_clean_ref
      );
    end if;
  end if;

  -- Validate amount
  if p_amount_kes < v_tx.amount_kes then
    update public.payment_transactions
    set status = 'failed',
        result_description = 'Paid amount is less than plan amount.'
    where id = v_tx.id;
    return jsonb_build_object('ok', false, 'reason', 'underpaid');
  end if;

  update public.payment_transactions
  set status = 'succeeded',
      provider = 'paystack',
      channel = coalesce(p_channel, channel),
      customer_email = coalesce(p_customer_email, customer_email),
      mpesa_receipt = coalesce(v_clean_ref, mpesa_receipt),
      result_code = 0,
      result_description = 'Payment successful via Paystack (' || coalesce(p_channel, 'card') || ').',
      updated_at = now()
  where id = v_tx.id;

  -- Look for active subscription to extend
  if v_tx.user_id is not null then
    select * into v_active_sub
    from public.subscriptions
    where user_id = v_tx.user_id and is_active = true
    order by end_date desc nulls last
    limit 1;
  elsif v_tx.phone_e164 is not null and v_tx.phone_e164 <> '' then
    select * into v_active_sub
    from public.subscriptions
    where phone = v_tx.phone_e164 and is_active = true
    order by end_date desc nulls last
    limit 1;
  end if;

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
    is_active
  ) values (
    v_tx.user_id,
    coalesce(v_tx.phone_e164, p_phone),
    v_plan,
    v_clean_ref,
    v_clean_ref,
    'paystack',
    v_now,
    v_base + make_interval(days => v_days),
    true
  )
  returning * into v_new_sub;

  return jsonb_build_object(
    'ok', true,
    'reused', false,
    'subscription_id', v_new_sub.id,
    'tier', v_new_sub.tier,
    'end_date', v_new_sub.end_date,
    'reference', v_clean_ref
  );
end;
$$;

revoke all on function public.fulfill_paystack_payment(text, integer, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.fulfill_paystack_payment(text, integer, text, timestamptz, text, text) to service_role;

