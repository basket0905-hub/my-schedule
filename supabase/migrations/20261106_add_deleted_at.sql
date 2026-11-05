-- 규림's Schedule soft-delete migration
-- 기존 일정/테이블을 삭제하지 않고 삭제 기록용 컬럼만 추가합니다.
-- 이 SQL을 Supabase SQL Editor에서 한 번 실행하세요.

alter table public.schedules
  add column if not exists deleted_at timestamptz;

create index if not exists schedules_user_deleted_at_idx
  on public.schedules (user_id, deleted_at);
