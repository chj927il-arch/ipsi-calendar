# 배포 가이드 (1회성 설정)

로컬에서 `node server.js`로 캘린더는 이미 확인 가능합니다. 아래는 실제 공개 URL로 배포하고
매일 자동 갱신 + 웹 푸시가 동작하도록 만드는 1회성 설정입니다. 순서대로 진행하세요.

## 1. GitHub 저장소 만들기

```
gh repo create ipsi-calendar --private --source=. --remote=origin --push
```

(`gh` 명령이 없다면 github.com에서 새 저장소를 만든 뒤 `git remote add origin <저장소 URL>` 후
`git push -u origin main`)

## 2. Cloudflare Workers에 연결

1. https://dash.cloudflare.com → Workers & Pages → Create → **Import a repository**
2. 방금 만든 `ipsi-calendar` 저장소 선택 → Deploy (설정은 `wrangler.toml`을 자동으로 인식합니다)
3. 배포되면 나오는 주소를 기억해두세요 (예: `https://ipsi-calendar.<내계정>.workers.dev`)

## 3. KV 네임스페이스 만들기 (구독자 저장용)

```
npx wrangler login
npx wrangler kv namespace create SUBSCRIPTIONS
```

출력 결과에 나오는 `id = "...."` 값을 `wrangler.toml`의 `REPLACE_WITH_KV_NAMESPACE_ID` 자리에
붙여넣고 커밋/푸시하세요.

```
git add wrangler.toml
git commit -m "KV 네임스페이스 연결"
git push
```

## 4. Worker 보호키 등록

구독 목록 조회 API를 아무나 못 보게 막는 비밀키입니다. 아무 긴 임의의 문자열이면 됩니다.

```
npx wrangler secret put NOTIFY_API_KEY
```

실행하면 값을 입력하라고 나옵니다 — 아무 문자열이나 입력(예: 32자 이상 랜덤 문자열) 후 어딘가에
메모해두세요. 5번 단계에서 GitHub에도 **똑같은 값**을 등록해야 합니다.

## 5. GitHub Actions 시크릿 등록

이 저장소의 GitHub 페이지 → Settings → Secrets and variables → Actions → **New repository secret**
에서 아래 5개를 등록하세요.

| 이름 | 값 |
|---|---|
| `WORKER_BASE_URL` | 2번에서 확인한 주소 (마지막 `/` 없이) |
| `NOTIFY_API_KEY` | 4번에서 넣은 값과 동일하게 |
| `VAPID_PUBLIC_KEY` | 아래 명령 실행 결과 |
| `VAPID_PRIVATE_KEY` | 아래 명령 실행 결과 (절대 커밋 금지) |
| `VAPID_SUBJECT` | `mailto:본인이메일주소` |

VAPID 키는 아래 명령으로 생성합니다 (한 번만 실행하면 됨, 공개키는 자동으로
`public/data/push-config.json`에 저장되어 그대로 커밋하면 됩니다):

```
node scripts/generate-vapid-keys.js
```

```
git add public/data/push-config.json
git commit -m "VAPID 공개키 등록"
git push
```

## 6. 동작 확인

1. GitHub 저장소 → Actions 탭 → "입시일정 자동 갱신 + 알림 발송 (매일)" → **Run workflow**로
   수동 실행 → 로그에서 크롤/알림 발송이 정상인지 확인
2. 배포된 주소(2번 URL)로 접속 → 🔔 알림 설정 → 알림 켜기 → 브라우저 알림 허용
3. 다가오는 일정 중 D-day가 오늘 알림 선호(D-7/3/1/당일)와 맞아떨어지면 다음 날 자동 실행 때
   푸시 알림이 옵니다.

## 참고

- iOS Safari는 이 사이트를 홈 화면에 추가한 뒤에만 웹 푸시가 동작합니다.
- 매일 크론은 한국시간 오전 7시 13분에 자동 실행됩니다(`.github/workflows/daily.yml`).
- 크롤링 대상(월 범위, 알림 기본 오프셋)은 `config.js`에서 바꿀 수 있습니다.
