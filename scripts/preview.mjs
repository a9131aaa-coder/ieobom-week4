/**
 * 설치가 필요 없는 로컬 미리보기용 서버입니다. 배포용 서버는 Next.js입니다.
 * Next.js 페이지와 동일한 화면 템플릿, 브라우저 JS, CSS, getDashboard()를 사용합니다.
 * 이 서버의 성공은 Next.js build/Vercel 배포의 성공을 의미하지 않습니다.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dashboardMarkup } from '../lib/dashboard-view.mjs';
import { getDashboard } from '../lib/dashboard-data.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const root = resolve('public');
const port = Number(process.env.PORT || 3000);
const types = { '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.md': 'text/plain; charset=utf-8' };
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>입어봄 — 로컬 미리보기</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/dashboard.css"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"></head><body>${dashboardMarkup}<script type="module" src="/dashboard.mjs"></script></body></html>`;
createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/api/dashboard') {
      try {
        const data = await getDashboard();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Data-Source': 'mock-json', 'X-Local-Preview': 'true' });
        return res.end(JSON.stringify(data));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: '대시보드 데이터를 불러오지 못했습니다.' }));
      }
    }
    if (url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html); }
    const path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (!path.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
    const file = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`입어봄 로컬 미리보기: http://localhost:${port}\nNext.js 빌드 및 공개 배포는 별도로 확인해야 합니다.`));
