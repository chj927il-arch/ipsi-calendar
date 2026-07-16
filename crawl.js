const fs = require('fs');
const path = require('path');
const config = require('./config');
const { fetchAllEvents } = require('./lib/scheduleFetcher');
const { mergeAndDiff } = require('./lib/diff');

const scheduleFilePath = path.join(__dirname, config.scheduleFile);

function loadPrevious() {
  if (!fs.existsSync(scheduleFilePath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(scheduleFilePath, 'utf8'));
    return Array.isArray(data.events) ? data.events : [];
  } catch (e) {
    console.warn('기존 schedule.json 읽기 실패, 빈 목록으로 시작:', e.message);
    return [];
  }
}

async function main() {
  console.log('대학어디가 대입일정 크롤 시작...');
  const prevEvents = loadPrevious();
  const newEvents = await fetchAllEvents();
  const { merged, added, changed, removed } = mergeAndDiff(prevEvents, newEvents);

  const output = { updatedAt: new Date().toISOString(), events: merged };
  fs.mkdirSync(path.dirname(scheduleFilePath), { recursive: true });
  fs.writeFileSync(scheduleFilePath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`총 ${merged.length}건 저장 완료 (신규 ${added.length} / 변경 ${changed.length} / 삭제 ${removed.length})`);
  added.forEach((e) => console.log(`  [신규] ${e.title} (${e.startDate}~${e.endDate})`));
  changed.forEach((c) => console.log(`  [변경] ${c.after.title}: ${c.before.startDate}~${c.before.endDate} → ${c.after.startDate}~${c.after.endDate}`));
  removed.forEach((e) => console.log(`  [삭제] ${e.title}`));
}

main().catch((e) => {
  console.error('크롤 실패:', e);
  process.exit(1);
});
