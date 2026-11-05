-- 규림's Schedule: Supabase cloud-sync schema
-- Run this script once in Supabase Dashboard > SQL Editor.
create table if not exists public.schedules (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  schedule_date date not null,
  schedule_time time not null,
  repeat_rule text not null default 'none'
    check (repeat_rule in ('none','daily','weekly','monthly')),
  lead_minutes integer not null default 0
    check (lead_minutes in (0,5,10,30,60)),
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schedules_user_date_idx
  on public.schedules (user_id, schedule_date, schedule_time);

alter table public.schedules enable row level security;

drop policy if exists "Users can read own schedules" on public.schedules;
create policy "Users can read own schedules"
  on public.schedules for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own schedules" on public.schedules;
create policy "Users can insert own schedules"
  on public.schedules for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own schedules" on public.schedules;
create policy "Users can update own schedules"
  on public.schedules for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own schedules" on public.schedules;
create policy "Users can delete own schedules"
  on public.schedules for delete
  using (auth.uid() = user_id);

create or replace function public.set_schedule_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_schedules_updated_at on public.schedules;
create trigger set_schedules_updated_at
before update on public.schedules
for each row execute function public.set_schedule_updated_at();
