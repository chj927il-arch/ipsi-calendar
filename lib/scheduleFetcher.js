const crypto = require('crypto');
const config = require('../config');

const ENTITY_MAP = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
function decodeEntities(str) {
  return String(str || '').replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g, (m) => ENTITY_MAP[m]);
}

// 서버가 onclick 문자열 안에 한글을 JS 유니코드 이스케이프(수 등) 리터럴로 박아 보냄 → 실제 문자로 복원
function decodeJsUnicode(str) {
  return String(str || '').replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// 초기 페이지 GET → CSRF 토큰 + 세션 쿠키 확보 (로그인 불필요)
async function getSession() {
  const res = await fetch(config.adiga.baseUrl + config.adiga.viewPath);
  if (!res.ok) throw new Error(`adiga.kr 초기 페이지 로드 실패: ${res.status}`);
  const html = await res.text();
  const csrfMatch = html.match(/name="_csrf"\s+value="([^"]+)"/);
  if (!csrfMatch) throw new Error('adiga.kr CSRF 토큰을 찾지 못함 — 페이지 구조가 바뀌었을 수 있음');
  const cookie = (res.headers.get('set-cookie') || '')
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(';')[0])
    .join('; ');
  return { csrf: csrfMatch[1], cookie };
}

// 지정 연/월의 일정 목록 HTML 조각을 가져옴 (리스트형태로 요청)
async function fetchMonth(session, year, month) {
  const body = new URLSearchParams({
    _csrf: session.csrf,
    searchScheduleType: config.adiga.searchScheduleType,
    searchGdfStdClsfRgnCn: '',
    searchCefStdClsfRgnCn: '',
    searchMoveMonth: '0',
    calType: '1',
    listType: '1',
    calYear: String(year),
    calMonth: String(month),
  });
  const res = await fetch(config.adiga.baseUrl + config.adiga.ajaxPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Cookie: session.cookie,
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`${year}-${month} 일정 조회 실패: ${res.status}`);
  return res.text();
}

// HTML 조각에서 fnSchedulePopup(code, seq, title, _unused, startDate, endDate, note) 파싱
// 주의: seq는 해당 월 응답 안에서의 렌더링 순번일 뿐 전역적으로 안정적이지 않다(월마다 재부여됨).
// 실제로 동일한 일정이 서로 다른 월 응답에서 다른 seq를 받는 것을 확인함 → id는 내용 기반 해시로 생성.
function parseEvents(html) {
  const re = /fnSchedulePopup\(&quot;(.*?)&quot;,\s*(\d+),\s*&quot;(.*?)&quot;,\s*(?:null|&quot;.*?&quot;),\s*&quot;(.*?)&quot;,\s*&quot;(.*?)&quot;,\s*&quot;(.*?)&quot;\)/g;
  const events = [];
  let m;
  while ((m = re.exec(html))) {
    const [, , , rawTitle, startDate, endDate, rawNote] = m;
    const title = decodeJsUnicode(decodeEntities(rawTitle));
    const categoryMatch = title.match(/^\[([^\]]+)\]/);
    const id = crypto.createHash('sha1').update(`${title}|${startDate}|${endDate}`).digest('hex').slice(0, 12);
    events.push({
      id,
      category: categoryMatch ? categoryMatch[1] : '기타',
      title,
      startDate,
      endDate,
      note: decodeJsUnicode(decodeEntities(rawNote)).trim(),
    });
  }
  return events;
}

// -monthsBefore ~ +monthsAfter 범위의 모든 (year, month) 쌍 생성
function monthRange(baseDate, monthsBefore, monthsAfter) {
  const months = [];
  for (let offset = -monthsBefore; offset <= monthsAfter; offset++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return months;
}

// 설정된 월 범위를 모두 순회해 일정을 수집하고 id 기준으로 de-dup
async function fetchAllEvents(baseDate = new Date()) {
  const session = await getSession();
  const months = monthRange(baseDate, config.adiga.monthsBefore, config.adiga.monthsAfter);
  const byId = new Map();
  for (const { year, month } of months) {
    const html = await fetchMonth(session, year, month);
    for (const event of parseEvents(html)) {
      byId.set(event.id, event);
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

module.exports = { getSession, fetchMonth, parseEvents, monthRange, fetchAllEvents, decodeEntities, decodeJsUnicode };
