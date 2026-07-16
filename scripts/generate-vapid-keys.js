// 웹 푸시에 필요한 VAPID 키 쌍을 1회 생성합니다.
// 실행: node scripts/generate-vapid-keys.js
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();
const pushConfigPath = path.join(__dirname, '..', 'public', 'data', 'push-config.json');

fs.mkdirSync(path.dirname(pushConfigPath), { recursive: true });
fs.writeFileSync(pushConfigPath, JSON.stringify({ vapidPublicKey: keys.publicKey }, null, 2), 'utf8');

console.log('VAPID 키를 생성했습니다.\n');
console.log('공개키(publicKey)는 아래 파일에 자동 저장했습니다 — 그대로 git에 커밋해도 됩니다:');
console.log('  ' + pushConfigPath);
console.log('');
console.log('비밀키(privateKey)는 절대 커밋하지 말고, GitHub 저장소 Secrets에 VAPID_PRIVATE_KEY로 등록하세요:');
console.log('  ' + keys.privateKey);
console.log('');
console.log('GitHub Secrets에 아래 값들도 함께 등록해야 합니다:');
console.log('  VAPID_PUBLIC_KEY  = ' + keys.publicKey);
console.log('  VAPID_SUBJECT     = mailto:본인이메일@example.com');
