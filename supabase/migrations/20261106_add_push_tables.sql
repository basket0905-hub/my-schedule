-- 규림's Schedule: Web Push subscription and delivery queue
-- Existing schedules and their data are not modified.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

create table if not exists public.schedule_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurrence_at timestamptz not null,
  reminder_minutes integer not null default 0,
  status text not null default 'queued' check (status in ('queued','sending','sent','partial','no_subscription','failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(schedule_id, occurrence_at, reminder_minutes)
);

alter table public.schedule_push_deliveries enable row level security;
-- No client policies: only the Edge Function's service-role client can access delivery records.
create index if not exists schedule_push_deliveries_user_created_idx
  on public.schedule_push_deliveries(user_id, created_at desc);
