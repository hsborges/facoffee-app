import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

const env = {
  SERVICE: 'example',
  DATABASE_URL: 'postgres://example@localhost/example',
  RABBITMQ_URL: 'amqp://localhost',
  S3_ENDPOINT: 'http://localhost:8333',
  S3_ACCESS_KEY: 'chave',
  S3_SECRET_KEY: 'segredo',
  S3_BUCKET: 'financeiro',
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
        s3: {
          endpoint: env.S3_ENDPOINT,
          accessKey: env.S3_ACCESS_KEY,
          secretKey: env.S3_SECRET_KEY,
          bucket: env.S3_BUCKET,
        },
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
        'S3_ENDPOINT is not set',
        'S3_ACCESS_KEY is not set',
        'S3_SECRET_KEY is not set',
        'S3_BUCKET is not set',
        'PORT is invalid',
      ],
    });
  });
});
