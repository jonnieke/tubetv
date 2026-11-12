-- Allow anonymous viewers to subscribe to Web Push notifications without an auth.users row
alter table public.push_subscriptions alter column user_id drop not null;
alter table public.push_subscriptions add column if not exists phone text;
alter table public.push_subscriptions add column if not exists device_hint text;

-- Update RLS policies to allow anon viewers to register push subscriptions
drop policy if exists "Users can insert their own subscriptions" on public.push_subscriptions;
create policy "Anyone can register push subscription"
on public.push_subscriptions for insert
to anon, authenticated
with check (true);

drop policy if exists "Users can update their own subscriptions" on public.push_subscriptions;
create policy "Anyone can update push subscription by endpoint"
on public.push_subscriptions for update
to anon, authenticated
using (true)
with check (true);

-- Create index on phone for targeted pass notifications
create index if not exists push_subscriptions_phone_idx
  on public.push_subscriptions (phone)
  where phone is not null;
