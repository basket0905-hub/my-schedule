# 규림's Schedule - 웹 푸시 알림 설정 (개발 브랜치)

> 이 기능은 개발 브랜치 전용입니다. 운영 브랜치 `main`과 현재 GitHub Pages 배포에는 반영되지 않습니다.

## 구성
- `supabase/migrations/20261106_add_push_tables.sql`: 기기 푸시 구독과 발송 중복 방지 테이블
- `supabase/functions/schedule-push/index.ts`: VAPID 웹 푸시 발송 Edge Function
- `supabase/config.toml`: 함수의 JWT 자동검증을 끄고 함수 코드에서 service-role 키를 검사
- `sw.js`: 푸시 수신, 알림 표시, 알림 탭 시 앱 열기
- `index.html`: 로그인 후 푸시 구독 버튼 표시

## 1. DB 테이블 만들기
Supabase Dashboard → SQL Editor에서 `supabase/migrations/20261106_add_push_tables.sql` 전체를 한 번 실행합니다.
기존 `schedules` 행은 변경하거나 삭제하지 않습니다.

## 2. VAPID 키 만들기 (Windows PowerShell 또는 CMD)
Node.js가 설치된 PC에서 다음 명령을 실행합니다.

```powershell
npx --yes web-push generate-vapid-keys
```

출력되는 Public Key와 Private Key를 안전한 곳에 보관합니다. Private Key는 GitHub, HTML, 채팅, 사용자 브라우저에 넣지 않습니다.

## 3. Supabase CLI 로그인 및 프로젝트 연결
```powershell
npx supabase login
npx supabase link --project-ref ynkhnejglpglvctxpwzi
```

VAPID 키를 Edge Function 비밀 환경변수로 설정합니다. 아래 값은 실제 생성한 키로 바꿉니다.

```powershell
npx supabase secrets set VAPID_PUBLIC_KEY=실제_PUBLIC_KEY VAPID_PRIVATE_KEY=실제_PRIVATE_KEY VAPID_SUBJECT=mailto:본인_이메일
```

Supabase는 `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`를 Edge Function 환경에 제공합니다. service-role 키를 소스 코드에 직접 넣지 않습니다.

## 4. Edge Function 배포
저장소를 PC에 내려받은 뒤 저장소 루트 폴더에서 실행합니다.

```powershell
npx supabase functions deploy schedule-push
```

## 5. 매분 예약 실행 설정
Supabase Dashboard의 Database → Extensions에서 `pg_cron`, `pg_net`, `supabase_vault`를 사용할 수 있는지 확인하고 필요하면 활성화합니다.
그 다음 SQL Editor에서 아래 SQL을 실행합니다. 두 번째 줄의 service-role 값은 Supabase Dashboard → Project Settings → API Keys의 service_role **legacy secret** 값입니다. 이 값은 Vault에만 저장하며 SQL 결과나 공개 저장소에 남기지 마세요.

```sql
select vault.create_secret('https://ynkhnejglpglvctxpwzi.supabase.co', 'schedule_push_project_url');
select vault.create_secret('여기에_service_role_legacy_secret', 'schedule_push_service_role');

select cron.schedule(
  'schedule-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'schedule_push_project_url') || '/functions/v1/schedule-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'schedule_push_service_role')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

이 스케줄은 매분 함수 실행을 요청합니다. 실행 기록은 Database → Cron Jobs에서 확인할 수 있습니다. 동일한 작업을 이미 만들었다면 중복 등록하지 마세요.

## 6. 기기에서 푸시 구독
1. 별도 테스트 호스트에 개발 브랜치를 배포합니다. 현재 GitHub Pages 운영 사이트 설정은 바꾸지 않습니다.
2. HTTPS 주소를 Safari에서 엽니다.
3. iPhone에서는 공유 → 홈 화면에 추가를 선택하고, 홈 화면 아이콘으로 앱을 실행합니다. 웹 푸시는 iOS/iPadOS 16.4 이상에서 홈 화면 웹 앱으로 실행해야 지원됩니다.
4. 앱에서 이메일 로그인 후 **푸시 알림 켜기**를 누르고 알림 허용을 선택합니다.
5. Supabase의 `push_subscriptions` 테이블에 해당 사용자의 구독 행이 생겼는지 확인합니다.

## 7. 테스트 및 제한
- 실제 푸시 수신 테스트는 Edge Function 배포, VAPID secrets 설정, Cron 실행, HTTPS 개발 호스트 배포, 기기 구독이 모두 끝난 뒤에만 가능합니다.
- 발송은 분 단위 Cron을 기준으로 하므로 예약 시각에 정확히 초 단위로 도착한다고 보장할 수 없습니다. 실패한 발송은 다음 실행에서 재시도하며, 발송 상태를 선점해 Cron 중복 실행에 따른 중복 전송을 줄입니다.
- iOS 알림 권한, 집중 모드, 네트워크, 배터리/OS 정책에 따라 지연 또는 미수신이 발생할 수 있습니다.
- 앱이 포그라운드에 있을 때 기존 로컬 알림과 서버 푸시가 중복되지 않도록 구독 완료 기기에서는 로컬 알림 검사를 중단합니다.
- 반복 일정은 매일/매주/매월을 지원합니다. 매월 29~31일처럼 해당 날짜가 없는 달의 처리 방식과 다중 기기 충돌은 추가 테스트가 필요합니다.
- 이 기능은 알림 표시를 구현합니다. 알림이 도착하자마자 iOS에서 자동으로 음성을 재생하는 것은 별도 OS 제한이 있습니다.

## 보안 주의
- VAPID Private Key와 service-role secret은 절대 GitHub에 커밋하지 않습니다.
- 브라우저에는 Supabase publishable key만 사용합니다.
- 테스트가 끝나기 전까지 `main`에 병합하거나 운영 사이트를 변경하지 않습니다.
