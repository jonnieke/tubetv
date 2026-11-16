-- Harden push_subscriptions: remove unrestricted anon/authenticated INSERT & UPDATE policies
-- and route anonymous/viewer registration through a scoped SECURITY DEFINER RPC keyed by endpoint.

drop policy if exists "Anyone can register push subscription" on public.push_subscriptions;
drop policy if exists "Anyone can update push subscription by endpoint" on public.push_subscriptions;

drop policy if exists "Users can insert their own subscriptions" on public.push_subscriptions;
create policy "Users can insert their own subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own subscriptions" on public.push_subscriptions;
create policy "Users can update their own subscriptions"
  on public.push_subscriptions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_phone text default null,
  p_device_hint text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_endpoint is null or char_length(p_endpoint) > 500 or p_endpoint !~ '^https://' then
    raise exception 'Invalid push endpoint';
  end if;
  if p_p256dh is null or char_length(p_p256dh) = 0 or char_length(p_p256dh) > 256 then
    raise exception 'Invalid p256dh key';
  end if;
  if p_auth is null or char_length(p_auth) = 0 or char_length(p_auth) > 128 then
    raise exception 'Invalid auth key';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, phone, device_hint)
  values (
    auth.uid(),
    p_endpoint,
    p_p256dh,
    p_auth,
    nullif(left(coalesce(p_phone, ''), 32), ''),
    nullif(left(coalesce(p_device_hint, ''), 120), '')
  )
  on conflict (endpoint) do update
  set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    phone = coalesce(excluded.phone, public.push_subscriptions.phone),
    device_hint = coalesce(excluded.device_hint, public.push_subscriptions.device_hint),
    user_id = coalesce(auth.uid(), public.push_subscriptions.user_id);
end;
$$;

revoke all on function public.register_push_subscription(text, text, text, text, text) from public;
grant execute on function public.register_push_subscription(text, text, text, text, text) to anon, authenticated;
