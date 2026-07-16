# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 자동으로 읽는 프로젝트 지침입니다.

## 프로젝트 한 줄 요약
대학어디가(adiga.kr) 대입일정을 수집해 캘린더로 보여주고, 일정이 다가오면 웹 푸시로 미리
알려주는 대시보드. **자동 매일 크롤링은 사용하지 않음** — 필요할 때 GitHub Actions에서 수동
실행(workflow_dispatch)하거나 로컬에서 `node crawl.js` 후 `npx wrangler deploy`.
- **저장소**: https://github.com/chj927il-arch/ipsi-calendar (public)
- **공개 URL**: https://ipsi-calendar.chj927il.workers.dev (Cloudflare Workers)

## 데이터 출처 (중요 — 실측 결과)
- `https://www.adiga.kr/uct/cas/scheduleView.do?menuId=PCUCTCAS1000` 페이지는 로그인 없이
  익명 세션으로 `POST /uct/cas/scheduleAjax.do`를 호출하면 HTML 조각(달력+목록)을 돌려준다.
- 파라미터: `_csrf`(초기 GET에서 추출), `searchScheduleType`, `calType=1&listType=1`(리스트형태),
  `calYear`, `calMonth`. 화면의 "일정유형" 체크박스 3개가 그대로 `searchScheduleType` 코드에
  대응한다 — **`01`=수시, `02`=정시(수능시험일 포함, "대입일정" 체크박스 하나가 사실은 `01,02`
  둘의 합), `03`=대학별 행사안내, `04`=대입 박람회/설명회**. 전부 수집하려면 `01,02,03,04`.
- 목록 응답의 `onclick="fnSchedulePopup(code, seq, title, null, startDate, endDate, note)"` 에서
  일정 데이터를 파싱한다(`lib/scheduleFetcher.js`). `code`는 `ATR`/`ATR_P`(수시),
  `FTR`/`FTR_P`(정시), `PGM`(대학별 행사안내), `EXPO`(박람회) 등. 수시/정시는 제목 자체에
  `[수시]`/`[정시]` 대괄호가 있어 카테고리를 거기서 뽑고, 대괄호가 없는 PGM/EXPO는 `code` 기반
  매핑(`CODE_CATEGORY_MAP`)으로 카테고리를 정한다.
- **주의**: `seq`는 해당 월 응답 안에서만 유효한 렌더링 순번이라 월마다 재사용된다(전역적으로
  안정적이지 않음) → 이벤트 `id`는 `title+startDate+endDate` 해시로 생성한다(`code`+`seq`값으로
  만들면 안 됨, 과거에 이 버그로 서로 다른 일정이 같은 id로 덮어써진 적 있음).
- 응답 안 한글이 `\uXXXX` JS 유니코드 이스케이프 리터럴로 인코딩되어 오므로 HTML 엔티티 디코딩과
  별도로 유니코드 이스케이프 디코딩이 필요하다(`decodeJsUnicode`).
- 한 번의 POST는 한 달치만 준다 → `config.js`의 `monthsBefore`/`monthsAfter` 범위만큼 월을
  순회해 수집 후 id 기준 de-dup(`lib/scheduleFetcher.js`의 `fetchAllEvents`).

## 아키텍처
- `lib/scheduleFetcher.js` — csrf/쿠키 획득, 월별 POST, 정규식 파싱, de-dup.
- `lib/diff.js` — 이전 스냅샷과 비교해 신규/변경/삭제 감지, `firstSeenAt`/`lastChangedAt` 유지.
- `crawl.js` — 크롤 1회 실행 진입점(Actions가 매일 호출). `public/data/schedule.json` 갱신.
- `server.js` — 로컬 테스트용 Express 서버(정적 서빙 + `/api/run` 수동 크롤).
- `public/index.html` — 캘린더 대시보드(다크모드, Pretendard, 글래스모피즘). `./data/schedule.json`
  을 정적으로 읽음(DB 없음).
- `public/push.js` — 웹 푸시 구독 UI 로직(권한 요청 → 서비스워커 등록 → `PushManager.subscribe`
  → `/api/push/subscribe`로 서버에 저장).
- `public/sw.js` — 서비스워커(푸시 수신/표시, 알림 클릭 시 포커스).
- `worker.js` + `wrangler.toml` — Cloudflare Worker: 정적 자산 서빙 + 푸시 구독 API
  (`/api/push/subscribe`, `/api/push/unsubscribe`, `/api/push/subscriptions`[보호],
  `/api/push/prune`[보호]). 구독 저장은 Cloudflare **KV**(`SUBSCRIPTIONS` 바인딩).
- `scripts/notify.js` — 매일 실행: `schedule.json`의 일정 D-day와 구독자 알림 선호(D-7/3/1/0)를
  비교해 `web-push` npm으로 발송. **발송 로직은 Cloudflare Worker가 아니라 GitHub Actions(Node
  런타임)에서 수행** — Workers 런타임에서 VAPID 암호화를 직접 구현하는 리스크를 피하기 위함.
  발송 여부는 `public/data/push-log.json`에 기록해 중복 발송 방지.
- `scripts/generate-vapid-keys.js` — VAPID 키 최초 1회 생성(`public/data/push-config.json`에
  공개키 자동 저장, 비밀키는 GitHub Secrets에 수동 등록 필요).
- `.github/workflows/daily.yml` — **수동 실행 전용**(workflow_dispatch만, 자동 크론 없음):
  크롤 → 알림 발송 → `public/data/*.json` 커밋 → Cloudflare 재배포.

## 데이터 스키마 (public/data/schedule.json)
```json
{
  "updatedAt": "ISO timestamp",
  "events": [
    { "id": "해시12자리", "category": "수시|정시|추가|행사|박람회|기타", "title": "[수시]원서접수",
      "startDate": "2026-09-07", "endDate": "2026-09-11", "note": "(중 3일 이상)",
      "firstSeenAt": "ISO", "lastChangedAt": "ISO" }
  ]
}
```
`public/data/push-config.json`: `{ "vapidPublicKey": "..." }` (공개값, 커밋 가능)
`public/data/push-log.json`: `{ "sent": ["subKeyHash|eventId|offset", ...] }`

## 절대 지켜야 할 규칙
1. **VAPID 비밀키(`VAPID_PRIVATE_KEY`)와 Worker 보호키(`NOTIFY_API_KEY`)는 절대 코드/커밋에
   넣지 말 것.** GitHub Secrets + `wrangler secret put`으로만 관리.
2. **`config.adiga.searchScheduleType`은 `01,02,03,04`를 유지할 것**(정시를 빼면 수능시험일이
   통째로 빠진다 — 처음 구현 때 이 실수로 한 번 데이터가 빠진 적 있음. 03/04는 사용자 요청으로
   추가함).
3. 이벤트 `id`는 내용 기반 해시(`title|startDate|endDate`)로만 생성할 것. code/seq 기반으로
   되돌리면 월별 재넘버링 때문에 다른 일정끼리 id가 충돌한다.
4. 한글 파일은 UTF-8로 저장.

## 명령어
```bash
npm install                 # 최초 1회
node crawl.js                # 대입일정 크롤 1회 실행 → public/data/schedule.json 갱신
node server.js                # 로컬 대시보드 (http://localhost:3000)
npx wrangler deploy          # 크롤한 최신 데이터를 실제 사이트에 반영(수동 배포)
node scripts/generate-vapid-keys.js   # VAPID 키 최초 1회 생성(이미 함, 재실행 불필요)
node scripts/notify.js       # 푸시 알림 발송 1회 실행(환경변수 필요, 로컬에선 보통 안 씀)
```
데이터를 갱신하고 싶을 때: `node crawl.js` → `npx wrangler deploy` 순서로 실행하면 됨(둘 다
로컬 wrangler 인증 이미 돼 있음).

## 배포 (완료된 상태)
GitHub 저장소·Cloudflare Worker·KV·시크릿 전부 등록 완료. 상세는 `DEPLOY.md` 참고.
**남은 것 1개**: `CLOUDFLARE_API_TOKEN` GitHub secret 미등록 — 이게 없으면 daily.yml을
수동 실행해도 마지막 "Cloudflare 재배포" 단계만 실패한다(크롤/알림/커밋은 정상). 등록 전까지는
데이터 갱신 후 `npx wrangler deploy`를 로컬에서 직접 실행할 것.
