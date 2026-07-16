// ── 로컬 테스트용 서버 ──
// 운영 환경(Cloudflare Workers + GitHub Actions)에서는 이 파일이 필요 없습니다.
// 내 PC에서 대시보드를 미리 보거나, "지금 새로고침"으로 수동 크롤링을 테스트할 때만 사용합니다.
const express = require('express');
const path = require('path');
const { execFile } = require('child_process');
const config = require('./config');

const app = express();
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.json());
// public 폴더를 그대로 서빙 → 대시보드(index.html)와 data/*.json 을 정적 파일로 제공
app.use(express.static(PUBLIC_DIR));

// 로컬에서 수동 크롤링 트리거 (대시보드 "지금 새로고침" 버튼)
app.post('/api/run', (req, res) => {
  execFile('node', [path.join(__dirname, 'crawl.js')], { cwd: __dirname, timeout: 120000 }, (err, stdout, stderr) => {
    if (err) {
      console.error('크롤 실패:', stderr || err.message);
      return res.status(500).json({ ok: false, error: (stderr || err.message).slice(0, 500) });
    }
    console.log(stdout.trim());
    res.json({ ok: true, message: stdout.trim() });
  });
});

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.listen(config.port, () => {
  console.log(`로컬 서버: http://localhost:${config.port}`);
  console.log('운영 배포는 GitHub Actions + Cloudflare Workers 가 담당합니다.');
});
