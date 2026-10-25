import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

const env = {
  SERVICE: 'notification',
  DATABASE_URL: 'postgres://notificacao@localhost/notificacao',
  RABBITMQ_URL: 'amqp://localhost',
  USUARIO_URL: 'http://usuario:3000',
  SMTP_URL: 'smtp://mailpit:1025',
  SMTP_FROM: 'FACOFFEE <facoffee@ufms.br>',
};

describe('readConfig', () => {
  it('reads environment variables with port 3000 by default', () => {
    expect(readConfig(env)).toEqual({
      ok: true,
      value: {
        service: 'notification',
        port: 3000,
        databaseUrl: env.DATABASE_URL,
        rabbitmqUrl: env.RABBITMQ_URL,
        usuarioUrl: env.USUARIO_URL,
        smtpUrl: env.SMTP_URL,
        smtpFrom: env.SMTP_FROM,
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
        'USUARIO_URL is not set',
        'SMTP_URL is not set',
        'SMTP_FROM is not set',
        'PORT is invalid',
      ],
    });
  });
});
