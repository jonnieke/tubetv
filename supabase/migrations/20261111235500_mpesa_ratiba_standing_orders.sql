-- Phase 3: Safaricom M-Pesa Ratiba (Standing Orders) for recurring monthly passes.

create table if not exists public.ratiba_mandates (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  phone_hash text not null,
  standing_order_name text not null default 'TubeTV Monthly Pass',
  standing_order_id text unique,
  merchant_request_id text,
  amount_kes numeric not null default 149 check (amount_kes > 0),
  frequency text not null default 'monthly' check (frequency in ('daily', 'weekly', 'monthly')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'paused', 'cancelled', 'failed')),
  start_date text,
  end_date text,
  next_billing_date timestamptz,
  last_billed_at timestamptz,
  last_mpesa_receipt text,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ratiba_mandates_phone_hash_idx on public.ratiba_mandates (phone_hash);
create index if not exists ratiba_mandates_status_idx on public.ratiba_mandates (status, next_billing_date);
create index if not exists ratiba_mandates_standing_order_idx on public.ratiba_mandates (standing_order_id);

alter table public.ratiba_mandates enable row level security;

-- Admin-only management policy
drop policy if exists "Admins manage ratiba_mandates" on public.ratiba_mandates;
create policy "Admins manage ratiba_mandates"
  on public.ratiba_mandates
  for all
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

-- Helper RPC to safely look up active mandate status by phone hash
create or replace function public.get_active_ratiba_mandate(p_phone_hash text)
returns table (
  id uuid,
  standing_order_name text,
  amount_kes numeric,
  frequency text,
  status text,
  next_billing_date timestamptz,
  last_billed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    rm.id,
    rm.standing_order_name,
    rm.amount_kes,
    rm.frequency,
    rm.status,
    rm.next_billing_date,
    rm.last_billed_at,
    rm.created_at
  from public.ratiba_mandates rm
  where rm.phone_hash = p_phone_hash
    and rm.status in ('pending', 'active')
  order by rm.created_at desc
  limit 1;
end;
$$;
