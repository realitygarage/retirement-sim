import { defineConfig } from '@playwright/test';

export default defineConfig({
  testMatch: 'retirement-simulator.spec.js',
  timeout: 30000,
  use: {
    headless: false,           // show the browser so you can watch tests run
    viewport: { width: 1400, height: 900 },
    baseURL: 'http://localhost:5173',
  },
  reporter: [
    ['list'],                  // live output in the terminal
    ['json', { outputFile: 'test-results/results.json' }],  // machine-readable
  ],
});
