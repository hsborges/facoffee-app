import { describe, expect, it } from 'vitest';
import type { Example } from '../domain/example.js';
import { fail, ok } from '../domain/result.js';
import { createLogger } from '../infra/logger.js';
import { type ApiDependencies, createApp } from './app.js';

const example: Example = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Coffee',
  registeredAt: new Date('2026-11-01T03:00:00Z'),
  confirmedAt: null,
};

const app = (deps: Partial<ApiDependencies> = {}) =>
  createApp({
    register: async ({ name }) => (name ? ok(example) : fail('empty-name')),
    find: async (id) => (id === example.id ? example : undefined),
    health: async () => ({ database: true, rabbitmq: true }),
    logger: createLogger('test', () => {}),
    ...deps,
  });

const post = (body: string) =>
  app().request('/examples', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
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

describe('POST /examples', () => {
  it('201 with the registered example', async () => {
    const response = await post('{"name":"Coffee"}');
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: example.id, name: 'Coffee' });
  });

  it('400 without a name and 422 when the domain rejects it', async () => {
    expect((await post('{')).status).toBe(400);
    expect((await post('{"name":""}')).status).toBe(422);
  });
});

describe('GET /examples/:id', () => {
  it('200 with the example and 404 for an unknown or invalid id', async () => {
    expect((await app().request(`/examples/${example.id}`)).status).toBe(200);
    expect((await app().request('/examples/22222222-2222-4222-8222-222222222222')).status).toBe(
      404,
    );
    expect((await app().request('/examples/abc')).status).toBe(404);
  });
});
