-- ============================================================================
-- Migration: Persistent Pass Restore Rate Limiting & Pan-African/Diaspora Currency Audit
-- ============================================================================

-- 1. Persistent Pass Restore Rate-Limiting Table (prevents phone enumeration across cold starts)
create table if not exists public.pass_restore_attempts (
  id uuid primary key default gen_random_uuid(),
  client_ip text not null,
  phone_key text not null,
  attempted_at timestamptz not null default now()
);

alter table public.pass_restore_attempts enable row level security;

create index if not exists idx_pass_restore_attempts_ip_time
  on public.pass_restore_attempts (client_ip, attempted_at desc);

create index if not exists idx_pass_restore_attempts_phone_time
  on public.pass_restore_attempts (phone_key, attempted_at desc);

create or replace function public.check_pass_restore_rate_limit(
  p_ip text,
  p_phone_key text,
  p_max_per_15m integer default 12
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip_count integer;
  v_phone_count integer;
  v_window timestamptz := now() - interval '15 minutes';
begin
  -- Opportunistically prune old attempts (> 2 hours old)
  delete from public.pass_restore_attempts
  where attempted_at < now() - interval '2 hours';

  select count(*) into v_ip_count
  from public.pass_restore_attempts
  where client_ip = coalesce(p_ip, 'unknown')
    and attempted_at >= v_window;

  select count(*) into v_phone_count
  from public.pass_restore_attempts
  where phone_key = coalesce(p_phone_key, 'unknown')
    and attempted_at >= v_window;

  if v_ip_count >= p_max_per_15m or v_phone_count >= p_max_per_15m then
    return false;
  end if;

  insert into public.pass_restore_attempts (client_ip, phone_key)
  values (coalesce(p_ip, 'unknown'), coalesce(p_phone_key, 'unknown'));

  return true;
end;
$$;

revoke all on function public.check_pass_restore_rate_limit(text, text, integer) from public, anon, authenticated;
grant execute on function public.check_pass_restore_rate_limit(text, text, integer) to service_role;

-- 2. Add currency & regional metadata columns to payment_transactions for Pan-African & Diaspora support
alter table public.payment_transactions
  add column if not exists currency text not null default 'KES',
  add column if not exists region_code text not null default 'KE';
