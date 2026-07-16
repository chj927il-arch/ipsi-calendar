// 브라우저 웹 푸시 구독/알림 설정 UI 로직
const REMINDER_OFFSETS = [7, 3, 1, 0];
const OFFSET_LABEL = { 7: 'D-7', 3: 'D-3', 1: 'D-1', 0: '당일' };
const STORAGE_KEY = 'ipsi_reminder_offsets';

function loadSelectedOffsets() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(raw) && raw.length) return raw;
  } catch (e) {}
  return [7, 3, 1];
}
function saveSelectedOffsets(offsets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(offsets));
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const pushState = { offsets: loadSelectedOffsets(), vapidPublicKey: null, subscription: null };

function setMsg(text, kind) {
  const el = document.getElementById('pushMsg');
  el.textContent = text || '';
  el.className = 'push-msg' + (kind ? ' ' + kind : '');
}

function renderOffsetChips() {
  const box = document.getElementById('offsetChips');
  box.innerHTML = REMINDER_OFFSETS.map((o) => {
    const on = pushState.offsets.includes(o);
    return `<div class="offset-chip${on ? ' on' : ''}" data-offset="${o}">${on ? '✓ ' : ''}${OFFSET_LABEL[o]}</div>`;
  }).join('');
  box.querySelectorAll('.offset-chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      const o = Number(chip.getAttribute('data-offset'));
      if (pushState.offsets.includes(o)) {
        pushState.offsets = pushState.offsets.filter((x) => x !== o);
      } else {
        pushState.offsets.push(o);
      }
      saveSelectedOffsets(pushState.offsets);
      renderOffsetChips();
      if (pushState.subscription) await sendSubscription(pushState.subscription);
    });
  });
}

function updatePushStatusUI() {
  const statusEl = document.getElementById('pushStatus');
  const btn = document.getElementById('pushSubscribeBtn');
  const deniedHint = document.getElementById('pushDeniedHint');
  deniedHint.style.display = 'none';
  btn.disabled = false;
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    statusEl.textContent = '이 브라우저는 웹 푸시를 지원하지 않아요';
    btn.disabled = true;
    return;
  }
  if (Notification.permission === 'denied') {
    statusEl.textContent = '알림이 차단되어 있어요';
    btn.disabled = true;
    deniedHint.style.display = '';
    return;
  }
  if (pushState.subscription) {
    statusEl.textContent = '알림 켜짐';
    btn.textContent = '알림 끄기';
  } else {
    statusEl.textContent = '알림 꺼짐';
    btn.textContent = '알림 켜기';
  }
}

async function fetchVapidPublicKey() {
  if (pushState.vapidPublicKey) return pushState.vapidPublicKey;
  const res = await fetch('./data/push-config.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('push-config.json 없음');
  const data = await res.json();
  if (!data.vapidPublicKey) throw new Error('VAPID 공개키 미설정');
  pushState.vapidPublicKey = data.vapidPublicKey;
  return pushState.vapidPublicKey;
}

async function sendSubscription(subscription) {
  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, offsets: pushState.offsets }),
    });
    if (!res.ok) throw new Error(String(res.status));
    setMsg('알림 설정이 저장되었어요.', 'ok');
  } catch (e) {
    setMsg('알림 서버에 저장하지 못했어요. 배포된 사이트에서 다시 시도해주세요.', 'err');
  }
}

async function subscribeToPush() {
  setMsg('');
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setMsg('알림 권한이 허용되지 않았어요.', 'err');
      updatePushStatusUI();
      return;
    }
    const reg = await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    const vapidPublicKey = await fetchVapidPublicKey();
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    pushState.subscription = subscription;
    await sendSubscription(subscription);
    updatePushStatusUI();
  } catch (e) {
    setMsg('알림 설정 중 오류가 발생했어요: ' + e.message, 'err');
  }
}

async function unsubscribeFromPush() {
  setMsg('');
  try {
    if (pushState.subscription) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: pushState.subscription.endpoint }),
      }).catch(() => {});
      await pushState.subscription.unsubscribe();
      pushState.subscription = null;
    }
    setMsg('알림을 껐어요.', 'ok');
    updatePushStatusUI();
  } catch (e) {
    setMsg('알림 끄기 중 오류가 발생했어요: ' + e.message, 'err');
  }
}

document.getElementById('notifyToggleBtn').addEventListener('click', () => {
  const panel = document.getElementById('notifyPanel');
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
});

document.getElementById('pushSubscribeBtn').addEventListener('click', () => {
  if (pushState.subscription) unsubscribeFromPush();
  else subscribeToPush();
});

(async function initPush() {
  renderOffsetChips();
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) pushState.subscription = await reg.pushManager.getSubscription();
    } catch (e) {}
  }
  updatePushStatusUI();
})();
