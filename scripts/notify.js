// 매일 실행: 다가오는 일정을 구독자의 알림 선호(D-day)와 비교해 웹 푸시 발송
// 필요 환경변수: WORKER_BASE_URL, NOTIFY_API_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const config = require('../config');

const scheduleFilePath = path.join(__dirname, '..', config.scheduleFile);
const pushLogFilePath = path.join(__dirname, '..', config.pushLogFile);

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysBetween(dateStr, base) {
  return Math.round((new Date(dateStr) - new Date(base)) / 86400000);
}

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

async function fetchSubscriptions() {
  const { WORKER_BASE_URL, NOTIFY_API_KEY } = process.env;
  if (!WORKER_BASE_URL || !NOTIFY_API_KEY) {
    throw new Error('WORKER_BASE_URL / NOTIFY_API_KEY 환경변수가 필요합니다');
  }
  const res = await fetch(`${WORKER_BASE_URL}/api/push/subscriptions`, {
    headers: { 'X-Notify-Key': NOTIFY_API_KEY },
  });
  if (!res.ok) throw new Error(`구독 목록 조회 실패: ${res.status}`);
  const data = await res.json();
  return data.subscriptions || [];
}

async function pruneKeys(keys) {
  const { WORKER_BASE_URL, NOTIFY_API_KEY } = process.env;
  if (!keys.length) return;
  await fetch(`${WORKER_BASE_URL}/api/push/prune`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Notify-Key': NOTIFY_API_KEY },
    body: JSON.stringify({ keys }),
  }).catch(() => {});
}

async function main() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT 환경변수가 필요합니다');
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const schedule = loadJson(scheduleFilePath, { events: [] });
  const events = schedule.events || [];
  const pushLog = loadJson(pushLogFilePath, { sent: [] });
  const sentSet = new Set(pushLog.sent || []);

  const subscriptions = await fetchSubscriptions();
  const today = todayStr();
  const toPrune = [];
  let sentCount = 0;

  for (const sub of subscriptions) {
    const offsets = Array.isArray(sub.offsets) && sub.offsets.length ? sub.offsets : config.reminderOffsets;
    for (const event of events) {
      const diff = daysBetween(event.startDate, today);
      if (diff < 0 || !offsets.includes(diff)) continue;
      const logKey = `${sub.key}|${event.id}|${diff}`;
      if (sentSet.has(logKey)) continue;

      const payload = JSON.stringify({
        title: `${diff === 0 ? '오늘' : `D-${diff}`} ${event.title}`,
        body: `${event.startDate} ~ ${event.endDate}${event.note ? ` (${event.note})` : ''}`,
        url: './',
        tag: event.id,
      });

      try {
        await webpush.sendNotification(sub.subscription, payload);
        sentSet.add(logKey);
        sentCount++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          toPrune.push(sub.key);
        } else {
          console.error(`발송 실패 (${sub.key}):`, err.message);
        }
      }
    }
  }

  fs.mkdirSync(path.dirname(pushLogFilePath), { recursive: true });
  fs.writeFileSync(pushLogFilePath, JSON.stringify({ sent: Array.from(sentSet) }, null, 2), 'utf8');

  if (toPrune.length) await pruneKeys([...new Set(toPrune)]);

  console.log(`알림 발송 완료: ${sentCount}건 발송, 만료 구독 ${toPrune.length}건 정리`);
}

main().catch((e) => {
  console.error('알림 발송 실패:', e);
  process.exit(1);
});
