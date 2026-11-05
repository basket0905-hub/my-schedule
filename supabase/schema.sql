-- 규림's Schedule: 기존 public.schedules 테이블 호환용 SQL
-- 중요: 기존 테이블/컬럼/일정 데이터는 삭제하거나 재생성하지 않습니다.
-- 현재 테이블 컬럼: id(uuid), user_id, title, description, starts_at,
-- timezone, repeat_rule, reminder_minutes(integer[]), is_completed,
-- created_at, updated_at

-- 기존 컬럼명 starts_at에 맞춘 인덱스 (schedule_date 사용 금지)
create index if not exists schedules_user_starts_at_idx
  on public.schedules (user_id, starts_at);

-- RLS를 켜 둡니다. 기존 "Manage own schedules" 정책은 유지합니다.
alter table public.schedules enable row level security;

-- updated_at 자동 갱신
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
