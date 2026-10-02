/**
 * SSR Express server
 *
 * Development:  node server/index.js          (uses Vite middleware for HMR)
 * Production:   NODE_ENV=production node server/index.js
 *
 * Production build required before serving:
 *   npm run build:client   → dist/  (static assets + index.html)
 *   npm run build:server   → dist/server/entry-server.js
 */

/* global process */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Writable } from 'stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Paths that are handled upstream (FastAPI/nginx) or are static assets —
// the SSR layer should not attempt to render these as React pages.
const PASSTHROUGH_PREFIXES = ['/api/', '/uploads/', '/data/', '/assets/'];

function isPassthrough(url) {
  return PASSTHROUGH_PREFIXES.some((p) => url.startsWith(p));
}

// ── CMS content for SSR ──
// The backend (re)exports contentData.json into the built dist/data folder;
// in dev Vite serves it from public/data. CONTENT_DATA_PATH overrides both.
const CONTENT_DATA_PATH = process.env.CONTENT_DATA_PATH ||
  path.resolve(ROOT, isProduction ? 'dist/data/contentData.json' : 'public/data/contentData.json');

// Same shape check as src/utils/contentDataLoader.js - the client only adopts
// the embedded payload when it passes, so the server must agree.
const REQUIRED_CONTENT_KEYS = ['siteSettings', 'heroSlides', 'salesReps'];

let contentFileCache = { mtimeMs: -1, size: -1, data: null };

/**
 * Read contentData.json, re-parsing only when the file's mtime/size change.
 * A half-written file (backend export in progress) keeps the last good copy.
 */
function loadInitialContent() {
  try {
    const stat = fs.statSync(CONTENT_DATA_PATH);
    if (stat.mtimeMs !== contentFileCache.mtimeMs || stat.size !== contentFileCache.size) {
      const data = JSON.parse(fs.readFileSync(CONTENT_DATA_PATH, 'utf-8'));
      const valid = data && typeof data === 'object' &&
        REQUIRED_CONTENT_KEYS.every((key) => data[key] !== undefined);
      contentFileCache = { mtimeMs: stat.mtimeMs, size: stat.size, data: valid ? data : null };
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      contentFileCache = { mtimeMs: -1, size: -1, data: null };
    } else {
      console.warn('[SSR] Could not read contentData.json:', err.message);
    }
  }
  return contentFileCache.data;
}

/**
 * Serialize for an inline <script>. Escaping "<" prevents "</script>" (or
 * "<!--") inside CMS text from breaking out of the script element; U+2028/9
 * are escaped for older JS parsers.
 */
function serializeForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

async function createServer() {
  const app = express();

  let vite;
  let productionTemplate;
  let productionRender;

  if (!isProduction) {
    // ── DEV: wire up Vite's dev middleware for HMR + on-demand transforms ──
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      root: ROOT,
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    // ── PROD: serve pre-built static assets ──
    const clientDist = path.resolve(ROOT, 'dist');
    app.use(express.static(clientDist, { index: false }));

    const templatePath = path.resolve(clientDist, 'index.html');
    if (!fs.existsSync(templatePath)) {
      throw new Error(
        `Production index.html not found at ${templatePath}.\nRun "npm run build:client" first.`
      );
    }
    productionTemplate = fs.readFileSync(templatePath, 'utf-8');

    const serverEntryPath = path.resolve(ROOT, 'dist/server/entry-server.js');
    if (!fs.existsSync(serverEntryPath)) {
      throw new Error(
        `SSR server bundle not found at ${serverEntryPath}.\nRun "npm run build:server" first.`
      );
    }
    ({ render: productionRender } = await import(serverEntryPath));
  }

  // ── SSR handler for all HTML page requests ──
  app.use('*', async (req, res) => {
    const url = req.originalUrl;

    if (isPassthrough(url)) {
      return res.status(404).end();
    }

    try {
      let template;
      let render;

      if (!isProduction) {
        const rawHtml = fs.readFileSync(path.resolve(ROOT, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, rawHtml);
        ({ render } = await vite.ssrLoadModule('/src/entry-server.jsx'));
      } else {
        template = productionTemplate;
        render = productionRender;
      }

      // CMS content is rendered into the HTML and handed to the client, so
      // hydration starts from the same data (no loading flash / mismatch)
      const initialContent = loadInitialContent();

      // Render the React tree and collect head tags from HelmetProvider
      const { pipe, helmet } = await render(url, { initialContent });

      const headTags = helmet
        ? [
            helmet.title?.toString() ?? '',
            helmet.meta?.toString() ?? '',
            helmet.link?.toString() ?? '',
            helmet.script?.toString() ?? '',
          ].join('')
        : '';

      // Buffer the streamed HTML so we can splice it into the template
      let body = '';
      await new Promise((resolve, reject) => {
        const sink = new Writable({
          write(chunk, _enc, cb) {
            body += chunk.toString();
            cb();
          },
        });
        sink.on('finish', resolve);
        sink.on('error', reject);
        pipe(sink);
      });

      const contentScript = initialContent
        ? `<script>window.__INITIAL_CONTENT__=${serializeForScript(initialContent)};</script>`
        : '';

      // Use replacer functions: `$` sequences in CMS text must not be
      // interpreted as String.replace patterns. The page's Helmet tags replace
      // the default meta block (<!--seo:start-->...<!--seo:end-->), which stays
      // as the fallback when SSR is bypassed.
      let html = template;
      if (headTags) {
        html = html.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, () => '');
      }
      html = html
        .replace('<!--ssr-head-->', () => headTags + contentScript)
        .replace('<!--ssr-outlet-->', () => body);

      res.status(200).set('Content-Type', 'text/html').end(html);
    } catch (err) {
      if (vite) vite.ssrFixStacktrace(err);
      console.error('[SSR error]', err.stack);
      res.status(500).end(err.message);
    }
  });

  return app;
}

createServer().then((app) => {
  app.listen(PORT, () => {
    const env = isProduction ? 'production' : 'development';
    console.log(`SSR server (${env}) → http://localhost:${PORT}`);
  });
});
