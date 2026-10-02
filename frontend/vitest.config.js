import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

// Unit and performance tests (npm test). Kept apart from vite.config.js so
// the PWA / image plugins don't run under the test runner.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    testTimeout: 30000,
  },
});
