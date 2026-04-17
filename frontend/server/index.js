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

      // Render the React tree and collect head tags from HelmetProvider
      const { pipe, helmet } = await render(url);

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

      let html = template
        .replace('<!--ssr-head-->', headTags)
        .replace('<!--ssr-outlet-->', body);

      // When SSR injects a <title>, strip the static default to avoid duplicates.
      // The static default remains as fallback when SSR is bypassed (pure SPA via FastAPI).
      if (headTags && headTags.includes('<title')) {
        html = html.replace(/<title(?! data-rh)[^>]*>[^<]*<\/title>/, '');
      }

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
