# 배포 현황

이미 완료된 것:
- GitHub 저장소: https://github.com/chj927il-arch/ipsi-calendar
- Cloudflare Worker 배포: https://ipsi-calendar.chj927il.workers.dev
- KV 네임스페이스(`SUBSCRIPTIONS`) 연결, `NOTIFY_API_KEY` 시크릿 등록
- GitHub Actions 시크릿(`WORKER_BASE_URL`, `NOTIFY_API_KEY`, `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) 등록 완료
- `.github/workflows/daily.yml`: 매일 크롤 → 알림 발송 → 데이터 커밋까지 자동화됨

## 남은 것 1개: 매일 자동 재배포용 Cloudflare API 토큰

지금 상태로는 daily.yml이 매일 최신 일정을 GitHub 저장소에는 커밋하지만, **실제 배포된
사이트(workers.dev)에는 자동 반영되지 않습니다.** (Cloudflare API 토큰 발급은 대시보드에서만
가능해 제가 대신 만들 수 없습니다.) 아래 1회만 진행하면 매일 완전 자동화됩니다.

1. https://dash.cloudflare.com/profile/api-tokens → **Create Token** → 템플릿
   **"Edit Cloudflare Workers"** 선택 → 계정(Account)에서 본인 계정 선택 → Continue → Create Token
2. 생성된 토큰 값을 복사한 뒤, 터미널에서:
   ```
   gh secret set CLOUDFLARE_API_TOKEN --repo chj927il-arch/ipsi-calendar
   ```
   실행하면 값을 붙여넣으라고 나옵니다 — 붙여넣기 후 Enter.

이 설정 전까지는 새 일정이 생기면 `node crawl.js` 후 `npx wrangler deploy`를 로컬에서 한 번
실행해주면 됩니다(둘 다 이미 정상 동작 확인함).

## 확인 방법

- GitHub 저장소 → Actions 탭 → "입시일정 자동 갱신 + 알림 발송 (매일)" → **Run workflow**로
  수동 실행해 로그 확인
- 사이트 접속 → 🔔 알림 설정 → 알림 켜기 → 브라우저 알림 허용 (iOS Safari는 홈 화면 추가 후에만
  동작)

## 참고

- 매일 크론은 한국시간 오전 7시 13분 자동 실행(`.github/workflows/daily.yml`)
- 크롤링 대상(월 범위)·알림 기본 오프셋은 `config.js`에서 조정 가능
- 데이터 스키마·아키텍처 상세는 `CLAUDE.md` 참고
