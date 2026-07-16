// 이전 스냅샷과 새로 크롤한 일정을 비교해 신규/변경/삭제를 감지하고
// firstSeenAt(최초 발견)/lastChangedAt(마지막 변경) 타임스탬프를 유지한다.
function mergeAndDiff(prevEvents, newEvents, now = new Date().toISOString()) {
  const prevById = new Map(prevEvents.map((e) => [e.id, e]));
  const added = [];
  const changed = [];

  const merged = newEvents.map((ev) => {
    const prev = prevById.get(ev.id);
    if (!prev) {
      added.push(ev);
      return { ...ev, firstSeenAt: now, lastChangedAt: now };
    }
    const isChanged =
      prev.title !== ev.title ||
      prev.startDate !== ev.startDate ||
      prev.endDate !== ev.endDate ||
      prev.note !== ev.note ||
      prev.category !== ev.category;
    if (isChanged) {
      changed.push({ before: prev, after: ev });
      return { ...ev, firstSeenAt: prev.firstSeenAt || now, lastChangedAt: now };
    }
    return { ...ev, firstSeenAt: prev.firstSeenAt || now, lastChangedAt: prev.lastChangedAt || now };
  });

  const newIds = new Set(newEvents.map((e) => e.id));
  const removed = prevEvents.filter((e) => !newIds.has(e.id));

  return { merged, added, changed, removed };
}

module.exports = { mergeAndDiff };
