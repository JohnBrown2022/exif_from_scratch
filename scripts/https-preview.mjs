import https from 'node:https';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function pickLanIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4') continue;
      if (entry.internal) continue;
      ips.push(entry.address);
    }
  }
  return Array.from(new Set(ips));
}

function contentTypeForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.webmanifest':
      return 'application/manifest+json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function toSafeFsPath(rootDir, urlPathname) {
  const normalizedPathname = path.posix
    .normalize(urlPathname)
    .replaceAll('\\', '/');
  const withLeadingSlash = normalizedPathname.startsWith('/')
    ? normalizedPathname
    : `/${normalizedPathname}`;
  const resolved = path.resolve(rootDir, `.${withLeadingSlash}`);
  const rootWithSep = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;
  if (!resolved.startsWith(rootWithSep) && resolved !== rootDir) return null;
  return resolved;
}

const argv = parseArgs(process.argv.slice(2));
if (argv.help) {
  // eslint-disable-next-line no-console
  console.log(`Usage:
  npm run build
  npm run preview:https -- --host 0.0.0.0 --port 4174 --cert <cert.pem> --key <key.pem>

Env:
  HTTPS_CERT_FILE, HTTPS_KEY_FILE

Options:
  --dir   dist dir (default: dist)
  --spa   SPA fallback to /index.html (default: true)
`);
  process.exit(0);
}

const host = typeof argv.host === 'string' ? argv.host : '0.0.0.0';
const port = typeof argv.port === 'string' ? Number(argv.port) : 4174;
const distDir = path.resolve(typeof argv.dir === 'string' ? argv.dir : 'dist');
const spaFallback = argv.spa !== 'false';

const certFile =
  (typeof argv.cert === 'string' ? argv.cert : null) ||
  process.env.HTTPS_CERT_FILE ||
  null;
const keyFile =
  (typeof argv.key === 'string' ? argv.key : null) || process.env.HTTPS_KEY_FILE || null;

if (!certFile || !keyFile) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing HTTPS cert/key. Pass --cert/--key or set HTTPS_CERT_FILE/HTTPS_KEY_FILE.',
  );
  process.exit(1);
}

const [cert, key] = await Promise.all([readFile(certFile), readFile(keyFile)]);

async function serveFile({ method, filePath, res }) {
  res.writeHead(200, { 'Content-Type': contentTypeForPath(filePath) });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

const server = https.createServer({ cert, key }, async (req, res) => {
  try {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      sendText(res, 405, 'Method Not Allowed');
      return;
    }

    const requestUrl = new URL(req.url ?? '/', `https://${req.headers.host ?? 'localhost'}`);
    let pathname = requestUrl.pathname;
    if (pathname === '/') pathname = '/index.html';

    const safePath = toSafeFsPath(distDir, pathname);
    if (!safePath) {
      sendText(res, 400, 'Bad Request');
      return;
    }

    try {
      const stats = await stat(safePath);
      if (stats.isFile()) {
        await serveFile({ method, filePath: safePath, res });
        return;
      }
    } catch (err) {
      if (!(err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT')) {
        sendText(res, 500, 'Server Error');
        return;
      }
    }

    if (spaFallback) {
      const accepts = String(req.headers.accept ?? '');
      const hasExt = path.posix.extname(pathname) !== '';
      if (accepts.includes('text/html') && !hasExt) {
        const indexPath = toSafeFsPath(distDir, '/index.html');
        if (!indexPath) {
          sendText(res, 500, 'Server Error');
          return;
        }
        await serveFile({ method, filePath: indexPath, res });
        return;
      }
    }

    sendText(res, 404, 'Not Found');
  } catch {
    sendText(res, 500, 'Server Error');
  }
});

server.listen(port, host, () => {
  const localUrl = `https://localhost:${port}/`;
  // eslint-disable-next-line no-console
  console.log(`\n  ➜  Local:   ${localUrl}`);
  for (const ip of pickLanIps()) {
    // eslint-disable-next-line no-console
    console.log(`  ➜  Network: https://${ip}:${port}/`);
  }
  // eslint-disable-next-line no-console
  console.log('');
});
