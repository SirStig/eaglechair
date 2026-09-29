import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Plugin to serve tmp directory (for temporary catalog images)
const serveTmpDirectory = () => ({
  name: 'serve-tmp-directory',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url.startsWith('/tmp/')) {
        const filePath = resolve(__dirname, req.url.slice(1)); // Remove leading slash
        if (fs.existsSync(filePath)) {
          // Determine content type
          const ext = filePath.split('.').pop().toLowerCase();
          const contentTypes = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'pdf': 'application/pdf',
          };
          res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
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

// https://vite.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => {
  const buildTimestamp = new Date().toISOString();
  const isProduction = mode === 'production';
  
  console.log(`\n🏗️  Building in ${mode} mode`);
  console.log(`📅 Build timestamp: ${buildTimestamp}\n`);
  
  return {
    plugins: [
      react(),
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
      !isSsrBuild && serveTmpDirectory(),
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
      // Serve tmp directory from frontend/tmp (for temporary catalog images)
      fs: {
        allow: ['..'], // Allow serving files from parent directory (frontend/tmp)
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
