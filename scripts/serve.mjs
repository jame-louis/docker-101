// Dev/preview static server for the built `site/` folder.
// Serves site/ under the site `base` (e.g. /course-template/) so assets resolve
// exactly as they will in production. Zero dependencies (Node built-ins only).
//
//   node scripts/serve.mjs            # default port 4321
//   node scripts/serve.mjs --port 8080
//   PORT=8080 node scripts/serve.mjs
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { readSiteBase, SITE_DIR } from './lib.mjs';

const portArgIndex = process.argv.indexOf('--port');
const rawPort = process.env.PORT || (portArgIndex !== -1 ? process.argv[portArgIndex + 1] : undefined) || '4321';
const port = Number(rawPort);
const base = readSiteBase();
const host = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
};

function send(res, status, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, ...extra });
  res.end(body);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  let path = decodeURIComponent(url.pathname);

  // Redirect the bare origin to the site base.
  if (path === '/' || path === base.replace(/\/$/, '')) {
    send(res, 302, '', 'text/plain', { Location: base });
    return;
  }

  // Only serve paths under the base; anything else is a 404.
  if (!path.startsWith(base)) {
    send(res, 404, 'Not found');
    return;
  }
  path = path.slice(base.length) || '/';

  // Resolve to a file inside site/, guarding against path traversal.
  const filePath = normalize(join(SITE_DIR, path));
  if (!filePath.startsWith(normalize(SITE_DIR))) {
    send(res, 403, 'Forbidden');
    return;
  }

  const serveFile = (fp) => {
    if (existsSync(fp) && statSync(fp).isFile()) {
      send(res, 200, readFileSync(fp), MIME[extname(fp)] ?? 'application/octet-stream');
    } else {
      // SPA fallback (slide decks rely on this): serve index.html of the nearest dir.
      const index = join(fp, 'index.html');
      if (existsSync(index) && statSync(index).isFile()) {
        send(res, 200, readFileSync(index), MIME['.html']);
      } else {
        send(res, 404, 'Not found');
      }
    }
  };

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    serveFile(join(filePath, 'index.html'));
  } else {
    serveFile(filePath);
  }
});

server.listen(port, host, () => {
  console.log(`Serving site/ at http://${host}:${port}${base}`);
  console.log(`(site base: ${base} · run \`npm run build\` first if site/ is missing)`);
});
