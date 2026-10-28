import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  // Starts the stack with Testcontainers and removes it at the end.
  globalSetup: './global-setup.ts',
  // A test takes about 10 s; the waits for events (ESPERA, 30 s) still fit.
  timeout: 60_000,
  // The tests count the participantes ativos: running them in parallel would race.
  workers: 1,
  // Prints the test.step of each test as it runs.
  reporter: [['list', { printSteps: true }]],
  // An action on a missing element fails on its own, naming it, instead of waiting for the test.
  use: {
    baseURL: 'http://localhost',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  // Mobile first (ADR 0028): the tests of the screens, tagged @celular, also run on the narrowest
  // phone the web supports.
  projects: [
    { name: 'computador' },
    {
      name: 'celular',
      grep: /@celular/,
      use: { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true },
    },
  ],
});
