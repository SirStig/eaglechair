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
    ],
    
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
      // Serve tmp directory from frontend/tmp (for temporary catalog images)
      fs: {
        allow: ['..'], // Allow serving files from parent directory (frontend/tmp)
      },
    },
    
    build: {
      outDir: 'dist',
      sourcemap: !isProduction, // Only in dev
      // Optimize chunks for better loading
      rollupOptions: {
        output: {
          // Add hash to filenames for cache busting
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['framer-motion', 'react-slick', 'slick-carousel'],
            'form-vendor': ['react-hook-form', 'react-quill', 'react-dropzone'],
            'utils-vendor': ['axios', '@tanstack/react-query', 'zustand', 'date-fns', 'clsx'],
          },
        },
      },
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 1000,
    },
    
    // Define app metadata
    define: {
      __APP_NAME__: JSON.stringify('Eagle Chair'),
      __APP_VERSION__: JSON.stringify('1.0.0'),
      __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
    },
  };
});
