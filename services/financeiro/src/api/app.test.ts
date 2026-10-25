import { describe, expect, it } from 'vitest';
import { createLogger } from '../infra/logger.js';
import { type ApiDependencies, createApp } from './app.js';

const app = (deps: Partial<ApiDependencies> = {}) =>
  createApp({
    health: async () => ({ database: true, rabbitmq: true }),
    logger: createLogger('test', () => {}),
    ...deps,
  });

describe('GET /health', () => {
  it('200 when every dependency is healthy', async () => {
    const response = await app().request('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      dependencies: { database: true, rabbitmq: true },
    });
  });

  it('503 when a dependency fails', async () => {
    const response = await app({
      health: async () => ({ database: true, rabbitmq: false }),
    }).request('/health');
    expect(response.status).toBe(503);
  });
});
