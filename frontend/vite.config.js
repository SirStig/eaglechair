import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimize chunks for better loading
    rollupOptions: {
      output: {
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
  },
})
