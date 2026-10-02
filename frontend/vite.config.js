import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { SEO } from './src/config/seoConfig.js'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Plugin to serve uploads directory from root level (dev mode only)
const serveUploadsDirectory = () => ({
  name: 'serve-uploads-directory',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url.startsWith('/uploads/')) {
        // Point to root/uploads directory (one level up from frontend folder)
        const uploadsRoot = resolve(__dirname, '..', 'uploads');
        const filePath = resolve(uploadsRoot, req.url.replace('/uploads/', ''));
        
        // Security check: ensure file is within uploads directory
        if (!filePath.startsWith(uploadsRoot)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = filePath.split('.').pop().toLowerCase();
          const contentTypes = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          };
          res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
          const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
          if (isImage) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
          fs.createReadStream(filePath).pipe(res);
        } else {
          next();
        }
      } else {
        next();
      }
    });
  },
});

const escapeAttr = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * SEO defaults in index.html, plus dist/seo-pages.json for the backend.
 *
 * - Fills <!--seo:start-->...<!--seo:end--> with the home page meta from
 *   src/config/seoConfig.js (data-rh: react-helmet-async replaces the tags
 *   per route; the backend's prerendered shells replace the block).
 * - Replaces __SITE_URL__ / __MEDIA_BASE_URL__ (VITE_SITE_URL / VITE_MEDIA_BASE_URL).
 * - Emits seo-pages.json (the static routes the backend prerenders,
 *   backend/services/seo_prerender.py) and robots.txt.
 */
const seoMetaPlugin = (env) => {
  const siteUrl = (env.VITE_SITE_URL || 'https://www.eaglechair.com').replace(/\/+$/, '')
  const mediaUrl = (env.VITE_MEDIA_BASE_URL || 'https://joshua.eaglechair.com').replace(/\/+$/, '')
  const home = SEO.pages.home
  const image = `${mediaUrl}/og-image.jpg`
  const tags = [
    `<title data-rh="true">${escapeAttr(home.title)}</title>`,
    `<meta data-rh="true" name="description" content="${escapeAttr(home.description)}" />`,
    '<meta data-rh="true" name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />',
    `<link data-rh="true" rel="canonical" href="${siteUrl}/" />`,
    '<meta data-rh="true" property="og:site_name" content="Eagle Chair" />',
    '<meta data-rh="true" property="og:locale" content="en_US" />',
    '<meta data-rh="true" property="og:type" content="website" />',
    `<meta data-rh="true" property="og:title" content="${escapeAttr(home.title)}" />`,
    `<meta data-rh="true" property="og:description" content="${escapeAttr(home.description)}" />`,
    `<meta data-rh="true" property="og:url" content="${siteUrl}/" />`,
    `<meta data-rh="true" property="og:image" content="${image}" />`,
    '<meta data-rh="true" property="og:image:type" content="image/jpeg" />',
    '<meta data-rh="true" property="og:image:width" content="1200" />',
    '<meta data-rh="true" property="og:image:height" content="630" />',
    '<meta data-rh="true" property="og:image:alt" content="Eagle Chair commercial restaurant seating" />',
    '<meta data-rh="true" name="twitter:card" content="summary_large_image" />',
    `<meta data-rh="true" name="twitter:title" content="${escapeAttr(home.title)}" />`,
    `<meta data-rh="true" name="twitter:description" content="${escapeAttr(home.description)}" />`,
    `<meta data-rh="true" name="twitter:image" content="${image}" />`,
    '<meta data-rh="true" name="twitter:image:alt" content="Eagle Chair commercial restaurant seating" />',
  ]
  return {
    name: 'seo-meta',
    transformIndexHtml(html) {
      return html
        .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, `<!--seo:start-->\n    ${tags.join('\n    ')}\n    <!--seo:end-->`)
        .replaceAll('__SITE_URL__', siteUrl)
        .replaceAll('__MEDIA_BASE_URL__', mediaUrl)
    },
    generateBundle() {
      const pages = Object.values(SEO.pages).map(({ url, title, description, noindex }) => ({
        url, title, description, noindex: Boolean(noindex),
      }))
      this.emitFile({ type: 'asset', fileName: 'seo-pages.json', source: JSON.stringify({ pages }, null, 2) })
      // The sitemap is written next to index.html by the backend prerender job
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: [
          '# Eagle Chair',
          '# Search engines, AI search/answer engines and link-preview bots are all welcome.',
          'User-agent: *',
          'Allow: /',
          'Disallow: /admin',
          'Disallow: /api/',
          'Disallow: /cart',
          'Disallow: /quote-request',
          'Disallow: /login',
          'Disallow: /forgot-password',
          'Disallow: /reset-password',
          'Disallow: /verify-email',
          '',
          `Sitemap: ${siteUrl}/sitemap.xml`,
          '',
        ].join('\n'),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => {
  const buildTimestamp = new Date().toISOString();
  const isProduction = mode === 'production';
  const env = loadEnv(mode, __dirname);
  
  console.log(`\n🏗️  Building in ${mode} mode`);
  console.log(`📅 Build timestamp: ${buildTimestamp}\n`);
  
  return {
    plugins: [
      react(),
      !isSsrBuild && seoMetaPlugin(env),
      // PWA and image optimizer are client-only; skip for SSR server bundle
      !isSsrBuild && VitePWA({
        registerType: 'autoUpdate',
        manifest: false, // We manage manifests (manifest.json + manifest-admin.json) ourselves
        workbox: {
          // Precache only the shell every visitor needs. Route/admin chunks are
          // cached on first use by the runtime rule below instead of being
          // downloaded up front (the full dist is several MB).
          globPatterns: ['assets/index-*.{js,css}', 'assets/react-vendor-*.js', 'favicon.ico'],
          // index.html is served by Apache/FastAPI (with no-cache) and must stay
          // fresh, so it's not precached; a navigateFallback pointing at a
          // non-precached URL throws and stops the SW from installing.
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // Hashed build output: content never changes for a given URL.
              urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/') && /-[\w-]{8,}\.(js|css)$/.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'build-assets',
                expiration: { maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
            {
              // Uploaded media. Filenames are unique per upload, so cache-first is safe.
              // Same-origin only: cross-origin (opaque) responses bloat quota.
              urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/uploads/images/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'uploads-image-cache',
                cacheableResponse: { statuses: [200] },
                expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true },
              },
            },
            // Never cache /api/v1/admin/*: responses are authenticated and would
            // persist in CacheStorage on shared machines.
          ],
        },
      }),
      !isSsrBuild && ViteImageOptimizer({
        png: { quality: 85 },
        jpeg: { quality: 85 },
        jpg: { quality: 85 },
        webp: { lossless: false, quality: 85 },
        svg: {
          multipass: true,
          plugins: ['preset-default'],
        },
      }),
      !isSsrBuild && !isProduction && serveUploadsDirectory(),
    ].filter(Boolean), // Remove falsy values from array
    
    // Optimize dependencies to ensure React is properly pre-bundled
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-is', 'lucide-react'],
      esbuildOptions: {
        target: 'esnext',
      },
    },
    
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        // Note: /uploads proxy removed in dev mode - files are served directly via serveUploadsDirectory plugin
        // In production, the built frontend will have uploads copied to dist/uploads or served via backend
      },
      fs: {
        allow: ['..'], // Allow serving files from the repo root (uploads/)
      },
    },
    
    build: {
      outDir: 'dist',
      sourcemap: false, // Never generate source maps in production for security
      rollupOptions: {
        output: {
          // Add hash to filenames for cache busting
          // SSR entry must keep a stable name: server/index.js imports dist/server/entry-server.js
          entryFileNames: isSsrBuild ? '[name].js' : 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          // Only the libraries every public page needs go in a shared vendor
          // chunk. Everything else (recharts, markdown, dropzone, dnd-kit...)
          // is left to Rollup so it rides along with the lazy route that uses it.
          // Match exact package dirs: a bare 'node_modules/react' prefix also
          // matches react-quill, react-markdown, etc. and drags them onto every page.
          manualChunks: (id) => {
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|react-helmet-async|react-fast-compare|invariant|shallowequal)[\\/]/.test(id)) {
              return 'react-vendor';
            }
          },
        },
      },
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 200, // Industry standard: 200KB per chunk
    },
    
    // Define app metadata
    define: {
      __APP_NAME__: JSON.stringify('Eagle Chair'),
      __APP_VERSION__: JSON.stringify('1.0.0'),
      __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
    },

    // SSR: bundle these CJS packages so Vite can transform them correctly
    ssr: {
      noExternal: ['react-helmet-async'],
    },
  };
});
