import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

const env = {
  SERVICE: 'example',
  DATABASE_URL: 'postgres://example@localhost/example',
  RABBITMQ_URL: 'amqp://localhost',
};

describe('readConfig', () => {
  it('reads environment variables with port 3000 by default', () => {
    expect(readConfig(env)).toEqual({
      ok: true,
      value: {
        service: 'example',
        port: 3000,
        databaseUrl: env.DATABASE_URL,
        rabbitmqUrl: env.RABBITMQ_URL,
      },
    });
  });

  it('lists every missing or invalid variable', () => {
    expect(readConfig({ PORT: 'abc' })).toEqual({
      ok: false,
      error: [
        'SERVICE is not set',
        'DATABASE_URL is not set',
        'RABBITMQ_URL is not set',
        'PORT is invalid',
      ],
    });
  });
});
