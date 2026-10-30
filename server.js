/* Cookbook App — tiny local server (Node 18+, no dependencies)
 *
 *   npm start                   → http://localhost:3560
 *   node server.js --open       → also opens the app in an app window (reuses a running copy)
 *   COOKBOOK_AUTOSTOP=1         → shuts down a few minutes after the last app window closes
 *                                 (used by the Windows desktop icon, see launcher/)
 *
 * Serves the app's files and one API route, /api/import?url=…, which fetches a recipe
 * page or social media video for the browser (browsers aren't allowed to read other
 * websites directly). Optional: set YOUTUBE_API_KEY to use YouTube's official API.
 */
'use strict';

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');
const { importFromUrl, ImportError } = require('./importer.js');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3560;   // 3560, like the course number — avoids other dev servers on 3000
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : 'localhost');

const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const TIMEOUT_MS = 10000;   // use case step 3: the whole download (redirects included) gets 10 s
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/* ---------------- safe outbound fetching ---------------- */

/** True for loopback, private, link-local and other non-public addresses. */
function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6);
}

async function assertPublic(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('only http and https links are allowed');
  if (u.port && !['80', '443', ''].includes(u.port)) throw new Error('unusual port');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^localhost$|\.local$|\.internal$/i.test(host)) throw new Error('local addresses are not allowed');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('local addresses are not allowed');
}

/** fetch() that re-checks every redirect hop, times out, and caps the download size. */
async function safeFetch(url, { headers = {}, maxBytes = MAX_PAGE_BYTES } = {}) {
  let current = url;
  const deadline = AbortSignal.timeout(TIMEOUT_MS);   // one clock for every hop and the body
  try {
    return await fetchHops();
  } catch (e) {
    if (deadline.aborted || e.name === 'TimeoutError') throw new Error(`it took longer than ${TIMEOUT_MS / 1000} seconds`);
    throw e;
  }

  async function fetchHops() {
  for (let hop = 0; hop < 6; hop++) {
    await assertPublic(current);
    const res = await fetch(current, {
      headers: { ...BROWSER_HEADERS, ...headers },
      redirect: 'manual',
      signal: deadline,
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).href;
      continue;
    }
    if (!res.ok) throw new Error(`the site answered ${res.status}`);
    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > maxBytes) throw new Error('the page is too large');
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > maxBytes) throw new Error('the page is too large');
      chunks.push(chunk);
    }
    return { url: current, type: res.headers.get('content-type') || '', body: Buffer.concat(chunks) };
  }
  throw new Error('too many redirects');
  }
}

const realNet = {
  text: async (url, opts) => (await safeFetch(url, opts)).body.toString('utf8'),
  json: async (url, opts) => JSON.parse((await safeFetch(url, opts)).body.toString('utf8')),
  resolve: async (url) => (await safeFetch(url)).url,
};

/** Download the dish photo so it can be saved with the recipe (social media thumbnail links expire). */
async function imageAsDataUrl(url) {
  if (!url || /^data:/.test(url)) return url || '';
  try {
    const res = await safeFetch(url, { maxBytes: MAX_IMAGE_BYTES, headers: { Accept: 'image/*' } });
    const type = res.type.split(';')[0].trim();
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) return '';
    return `data:${type};base64,${res.body.toString('base64')}`;
  } catch (e) {
    return '';
  }
}

/* ---------------- HTTP server ---------------- */

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.gz': 'application/octet-stream',
};

/** Only the browser app is served — never server code, tests or git files. */
const PUBLIC_FILES = new Set(['index.html', 'app.js', 'parser.js', 'cookbook.js', 'scanner.js', 'styles.css', 'manifest.webmanifest', 'sw.js']);
/** Plus the icons and the PDF / photo reading libraries in vendor/ (run in the browser). */
const PUBLIC_PATHS = /^(icons\/[\w-]+\.(png|svg)|vendor\/[a-z]+\/[\w.-]+\.(mjs|js)|vendor\/tesseract\/lang\/[a-z_]+\.traineddata\.gz)$/;

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function handleImport(req, res, query) {
  const url = query.get('url') || '';
  try {
    const result = await importFromUrl(url, realNet, process.env);
    const remote = result.recipe.image;
    result.recipe.image = await imageAsDataUrl(remote);
    // TikTok/Instagram thumbnail links expire, so only keep a plain link for websites and YouTube.
    if (!result.recipe.image && /^https:\/\//.test(remote) && !/^(tiktok|instagram)$/.test(result.platform)) {
      result.recipe.image = remote;
    }
    send(res, 200, { ok: true, ...result });
  } catch (e) {
    const known = e instanceof ImportError;
    if (!known) console.error('[import]', url, e);
    send(res, known ? 422 : 500, {
      ok: false,
      error: known ? e.message : 'Something went wrong while reading that link.',
      code: known ? e.code || '' : 'error',
      caption: e.caption || '',
    });
  }
}

function serveFile(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (e) { return send(res, 400, 'Bad request', 'text/plain'); }
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  const inside = file.startsWith(ROOT + path.sep);
  const rel2 = path.relative(ROOT, file).split(path.sep).join('/');
  const allowed = PUBLIC_FILES.has(rel2) || PUBLIC_PATHS.test(rel2);
  if (!inside || !allowed || !TYPES[path.extname(file)]) return send(res, 404, 'Not found', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)], 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const { pathname, searchParams } = new URL(req.url, 'http://localhost');
  const beacon = req.method === 'POST' && pathname === '/api/bye';   // navigator.sendBeacon uses POST
  if (req.method !== 'GET' && req.method !== 'HEAD' && !beacon) return send(res, 405, { ok: false, error: 'Method not allowed' });
  if (pathname === '/api/health') return send(res, 200, { ok: true, app: 'cookbook' });
  if (pathname === '/api/ping') { autostop.ping(); return send(res, 200, { ok: true }); }
  if (pathname === '/api/bye') { autostop.bye(); return send(res, 200, { ok: true }); }
  if (pathname === '/api/import') return handleImport(req, res, searchParams);
  return serveFile(req, res, pathname);
});

/* ---------------- auto-stop (desktop launcher) ---------------- */

// Open app pages ping every 30 s. A closed window sends "bye". Background windows can be
// throttled to one timer a minute, so the server waits a few minutes before giving up.
const autostop = {
  enabled: process.env.COOKBOOK_AUTOSTOP === '1',
  idleMs: Number(process.env.COOKBOOK_IDLE_MS) || 3 * 60 * 1000,
  deadline: Date.now() + (Number(process.env.COOKBOOK_START_MS) || 5 * 60 * 1000),  // time to open the first window
  ping() { this.deadline = Date.now() + this.idleMs; },
  bye() { this.deadline = Math.min(this.deadline, Date.now() + Math.min(20000, this.idleMs)); },  // a reload pings again
  start() {
    if (!this.enabled) return;
    setInterval(() => {
      if (Date.now() > this.deadline) {
        console.log('No Cookbook window open — shutting down.');
        process.exit(0);
      }
    }, Math.min(5000, this.idleMs / 2)).unref();
  },
};

/* ---------------- opening the app window ---------------- */

/** Open the app in Edge/Chrome "app mode" (its own window, no tabs), else the default browser. */
function openApp(url) {
  const tryRun = (cmd, args) => new Promise((resolve) => {
    try {
      const p = spawn(cmd, args, { detached: true, stdio: 'ignore' });
      p.on('error', () => resolve(false));
      p.on('spawn', () => { p.unref(); resolve(true); });
    } catch (e) { resolve(false); }
  });
  const profile = path.join(process.env.LOCALAPPDATA || process.env.HOME || ROOT, process.platform === 'win32' ? 'Cookbook\\browser' : '.cookbook-browser');
  const appArgs = [`--app=${url}`, `--user-data-dir=${profile}`, '--window-size=1200,900', '--no-first-run', '--no-default-browser-check'];
  const pf = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = process.platform === 'win32'
    ? [...pf.map((d) => path.join(d, 'Microsoft\\Edge\\Application\\msedge.exe')), ...pf.map((d) => path.join(d, 'Google\\Chrome\\Application\\chrome.exe'))]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
      : ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'];
  return (async () => {
    for (const c of candidates) {
      if (path.isAbsolute(c) && !fs.existsSync(c)) continue;
      if (await tryRun(c, appArgs)) return;
    }
    if (process.platform === 'win32') await tryRun('cmd', ['/c', 'start', '', url]);
    else await tryRun(process.platform === 'darwin' ? 'open' : 'xdg-open', [url]);
  })();
}

async function alreadyRunning(url) {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1500) });
    return (await res.json()).app === 'cookbook';
  } catch (e) {
    return false;
  }
}

if (require.main === module) {
  const open = process.argv.includes('--open');
  const shownHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  const url = `http://${shownHost}:${PORT}`;
  (async () => {
    if (open && await alreadyRunning(url)) {      // second click on the icon: just open a window
      await openApp(url);
      return;
    }
    server.on('error', (e) => {
      console.error(e.code === 'EADDRINUSE'
        ? `Port ${PORT} is already used by another program. Close it, or start with PORT=<number>.`
        : e.message);
      process.exit(1);
    });
    server.listen(PORT, HOST, () => {
      console.log(`Cookbook app running at ${url}`);
      autostop.start();
      if (open) openApp(url);
    });
  })();
}

module.exports = { server, isPrivateAddress, safeFetch, autostop };
