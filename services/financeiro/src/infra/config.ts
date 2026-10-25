import { fail, ok, type Result } from '../domain/result.js';
import type { S3Config } from './armazem-s3.js';

/** Service configuration, read from environment variables. */
export type Config = {
  readonly service: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly rabbitmqUrl: string;
  readonly s3: S3Config;
};

const OBRIGATORIAS = [
  'SERVICE',
  'DATABASE_URL',
  'RABBITMQ_URL',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_BUCKET',
];

/**
 * Reads `SERVICE`, `DATABASE_URL`, `RABBITMQ_URL`, `S3_ENDPOINT`, `S3_ACCESS_KEY`,
 * `S3_SECRET_KEY`, `S3_BUCKET` (required) and `PORT` (default 3000).
 * Fails with every problem found, not just the first.
 */
export const readConfig = (
  env: Readonly<Record<string, string | undefined>>,
): Result<Config, string[]> => {
  const missing = OBRIGATORIAS.filter((name) => !env[name]);
  const port = Number(env.PORT ?? 3000);
  const errors = [
    ...missing.map((name) => `${name} is not set`),
    ...(Number.isInteger(port) && port >= 0 && port < 65536 ? [] : ['PORT is invalid']),
  ];
  if (errors.length > 0) return fail(errors);
  return ok({
    service: env.SERVICE as string,
    port,
    databaseUrl: env.DATABASE_URL as string,
    rabbitmqUrl: env.RABBITMQ_URL as string,
    s3: {
      endpoint: env.S3_ENDPOINT as string,
      accessKey: env.S3_ACCESS_KEY as string,
      secretKey: env.S3_SECRET_KEY as string,
      bucket: env.S3_BUCKET as string,
    },
  });
};
