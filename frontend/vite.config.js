import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
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
          // Determine content type
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
export default defineConfig(({ mode }) => {
  const buildTimestamp = new Date().toISOString();
  const isProduction = mode === 'production';
  
  console.log(`\n🏗️  Building in ${mode} mode`);
  console.log(`📅 Build timestamp: ${buildTimestamp}\n`);
  
  return {
    plugins: [
      react(),
      serveTmpDirectory(), // Serve tmp directory for catalog images
      // Only serve uploads directory directly in dev mode
      // In production, files are served from frontend/dist/uploads
      !isProduction && serveUploadsDirectory(),
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
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          // Manual chunk splitting for optimal performance
          manualChunks: (id) => {
            // React vendor chunk - must include all React-related packages
            if (id.includes('node_modules/react') || 
                id.includes('node_modules/react-dom') || 
                id.includes('node_modules/react-router') ||
                id.includes('node_modules/react-is') ||
                id.includes('node_modules/react/jsx-runtime')) {
              return 'react-vendor';
            }
            // Chart/visualization chunk - keep with React since it depends on it
            if (id.includes('node_modules/recharts')) {
              return 'react-vendor'; // Put recharts with React since it needs React.forwardRef
            }
            // UI libraries chunk
            if (id.includes('node_modules/framer-motion') || id.includes('node_modules/lucide-react')) {
              return 'ui-vendor';
            }
            // Query library chunk
            if (id.includes('node_modules/@tanstack/react-query')) {
              return 'query-vendor';
            }
            // Form libraries chunk
            if (id.includes('node_modules/react-hook-form') || id.includes('node_modules/react-quill')) {
              return 'form-vendor';
            }
            // Carousel chunk
            if (id.includes('node_modules/react-slick') || id.includes('node_modules/slick-carousel')) {
              return 'carousel-vendor';
            }
            // Map libraries chunk
            if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) {
              return 'map-vendor';
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
  };
});
