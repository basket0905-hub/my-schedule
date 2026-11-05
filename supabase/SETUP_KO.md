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
- `deleted_at`: timestamptz (삭제 동기화용, 아래 추가 SQL로 생성)

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

## 5. 삭제 동기화 컬럼 추가 (필수)
개발 브랜치의 삭제 동기화는 행을 즉시 영구 삭제하지 않고 `deleted_at`에 삭제 시각을 기록합니다. Supabase SQL Editor에서 `supabase/migrations/20261106_add_deleted_at.sql` 내용을 한 번 실행하세요. 이 SQL은 컬럼과 인덱스만 추가하며 기존 일정은 삭제하지 않습니다.

## 6. 현재 개발 브랜치 동기화
개발 브랜치(`supabase-cloud-sync`)에는 이메일 로그인, 로컬 일정과 클라우드 일정 병합, 등록·수정·완료 상태 변경 추적, 삭제 기록(soft delete)이 구현되어 있습니다. 클라우드 동기화를 사용하려면 위 `deleted_at` migration을 먼저 실행해야 합니다. 운영 브랜치 `main`에는 아직 반영하지 않았습니다.

동기화 테스트 전에는 앱의 **일정 백업하기**로 JSON 백업을 별도 보관하세요. 여러 기기에서 동시에 같은 일정을 수정하는 충돌 해결과 실제 iPhone 백그라운드 푸시 알림은 아직 검증되지 않았습니다.
