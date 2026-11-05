# 규림's Schedule - Supabase 연결 준비

이 문서는 이미 존재하는 `public.schedules` 테이블에 맞춰 클라우드 동기화를 준비하는 단계입니다.

## 1. 데이터 백업
현재 앱에서 **일정 백업하기**를 눌러 JSON 파일을 PC 또는 안전한 위치에 보관하세요.

## 2. 현재 데이터베이스 구조
이 프로젝트의 기존 `public.schedules` 테이블을 그대로 사용합니다.

- `id`: uuid
- `user_id`: uuid
- `title`: text
- `description`: text
- `starts_at`: timestamptz
- `timezone`: text
- `repeat_rule`: text
- `reminder_minutes`: integer[]
- `is_completed`: boolean
- `created_at`, `updated_at`: timestamptz

이 테이블에는 `schedule_date`, `schedule_time`, `lead_minutes`, `is_done` 컬럼이 없습니다. 앱과 SQL은 실제 컬럼명에 맞춰야 합니다.

## 3. SQL 실행
1. Supabase 대시보드에서 SQL Editor를 엽니다.
2. 새 쿼리를 만듭니다.
3. 이 저장소의 `supabase/schema.sql` 최신 내용을 붙여넣습니다.
4. Run을 누릅니다.

이 SQL은 기존 테이블을 생성/삭제/초기화하지 않습니다. `user_id, starts_at` 인덱스와 `updated_at` 갱신 트리거만 준비합니다. 기존 RLS 정책 `Manage own schedules`는 유지합니다.

## 4. 보안
현재 확인된 RLS 정책은 `authenticated` 사용자에게 `auth.uid() = user_id` 조건으로 본인 행의 ALL 작업을 허용합니다. RLS를 끄거나 정책을 무조건 교체하지 마세요.
브라우저에는 Supabase Project URL과 publishable/anon 공개 키만 사용합니다. service_role 키와 VAPID private key는 HTML, JavaScript, GitHub 저장소에 넣지 마세요.

## 5. 동기화 상태
이 SQL을 실행해도 앱의 클라우드 동기화가 바로 활성화되지는 않습니다. 현재 앱은 로컬 저장 방식입니다. 다음 단계에서 로그인, 기존 일정 가져오기, 로컬 일정과 클라우드 일정의 안전한 병합을 구현해야 합니다.
