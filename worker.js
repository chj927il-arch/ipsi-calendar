// Cloudflare Worker — 정적 자산(public/) 서빙 + 웹 푸시 구독 관리 API
// 바인딩: ASSETS(정적 자산), SUBSCRIPTIONS(KV)
// 시크릿: NOTIFY_API_KEY (구독 목록 조회/정리 API 보호용, GitHub Actions에서만 사용)
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
      return handleSubscribe(request, env);
    }
    if (url.pathname === '/api/push/unsubscribe' && request.method === 'POST') {
      return handleUnsubscribe(request, env);
    }
    if (url.pathname === '/api/push/subscriptions' && request.method === 'GET') {
      return handleListSubscriptions(request, env);
    }
    if (url.pathname === '/api/push/prune' && request.method === 'POST') {
      return handlePrune(request, env);
    }

    // 그 외 요청은 정적 자산으로
    return env.ASSETS.fetch(request);
  },
};

async function handleSubscribe(request, env) {
  let payload = {};
  try { payload = await request.json(); } catch (e) {}
  const subscription = payload.subscription;
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return json({ ok: false, error: '구독 정보가 올바르지 않습니다' }, 400);
  }
  const offsets = Array.isArray(payload.offsets) ? payload.offsets.filter((n) => Number.isInteger(n)) : [7, 3, 1, 0];
  const key = await hashKey(subscription.endpoint);
  await env.SUBSCRIPTIONS.put(key, JSON.stringify({ subscription, offsets, updatedAt: new Date().toISOString() }));
  return json({ ok: true });
}

async function handleUnsubscribe(request, env) {
  let payload = {};
  try { payload = await request.json(); } catch (e) {}
  if (!payload.endpoint) return json({ ok: false, error: 'endpoint 필요' }, 400);
  const key = await hashKey(payload.endpoint);
  await env.SUBSCRIPTIONS.delete(key);
  return json({ ok: true });
}

async function handleListSubscriptions(request, env) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: '인증 실패' }, 401);

  const items = [];
  let cursor;
  do {
    const page = await env.SUBSCRIPTIONS.list({ cursor });
    for (const k of page.keys) {
      const value = await env.SUBSCRIPTIONS.get(k.name);
      if (value) {
        try { items.push({ key: k.name, ...JSON.parse(value) }); } catch (e) {}
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return json({ ok: true, subscriptions: items });
}

async function handlePrune(request, env) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: '인증 실패' }, 401);
  let payload = {};
  try { payload = await request.json(); } catch (e) {}
  const keys = Array.isArray(payload.keys) ? payload.keys : [];
  await Promise.all(keys.map((k) => env.SUBSCRIPTIONS.delete(k)));
  return json({ ok: true, removed: keys.length });
}

function isAuthorized(request, env) {
  const provided = request.headers.get('X-Notify-Key') || '';
  return Boolean(env.NOTIFY_API_KEY) && provided === env.NOTIFY_API_KEY;
}

async function hashKey(endpoint) {
  const data = new TextEncoder().encode(endpoint);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
