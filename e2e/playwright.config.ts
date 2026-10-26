import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  // Starts the stack with Testcontainers and removes it at the end.
  globalSetup: './global-setup.ts',
  timeout: 120_000,
  // The tests count the participantes ativos: running them in parallel would race.
  workers: 1,
  // Prints the test.step of each test as it runs.
  reporter: [['list', { printSteps: true }]],
  use: { baseURL: 'http://localhost', trace: 'retain-on-failure' },
});
