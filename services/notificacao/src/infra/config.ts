import { HORA_DOS_LEMBRETES } from '../domain/lembrete.js';
import { fail, ok, type Result } from '../domain/result.js';

/** Service configuration, read from environment variables. */
export type Config = {
  readonly service: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly rabbitmqUrl: string;
  readonly usuarioUrl: string;
  readonly financeiroUrl: string;
  readonly smtpUrl: string;
  readonly smtpFrom: string;
  readonly horaDosLembretes: number;
};

const OBRIGATORIAS = [
  'SERVICE',
  'DATABASE_URL',
  'RABBITMQ_URL',
  'USUARIO_URL',
  'FINANCEIRO_URL',
  'SMTP_URL',
  'SMTP_FROM',
];

/**
 * Reads `SERVICE`, `DATABASE_URL`, `RABBITMQ_URL`, `USUARIO_URL`, `FINANCEIRO_URL`, `SMTP_URL`,
 * `SMTP_FROM` (required), `PORT` (default 3000) and `HORA_DOS_LEMBRETES` (0 to 23, default
 * {@link HORA_DOS_LEMBRETES}). Fails with every problem found, not just the first.
 */
export const readConfig = (
  env: Readonly<Record<string, string | undefined>>,
): Result<Config, string[]> => {
  const missing = OBRIGATORIAS.filter((name) => !env[name]);
  const port = Number(env.PORT ?? 3000);
  const horaDosLembretes = Number(env.HORA_DOS_LEMBRETES || HORA_DOS_LEMBRETES);
  const errors = [
    ...missing.map((name) => `${name} is not set`),
    ...(Number.isInteger(port) && port >= 0 && port < 65536 ? [] : ['PORT is invalid']),
    ...(Number.isInteger(horaDosLembretes) && horaDosLembretes >= 0 && horaDosLembretes < 24
      ? []
      : ['HORA_DOS_LEMBRETES is invalid']),
  ];
  if (errors.length > 0) return fail(errors);
  return ok({
    service: env.SERVICE as string,
    port,
    databaseUrl: env.DATABASE_URL as string,
    rabbitmqUrl: env.RABBITMQ_URL as string,
    usuarioUrl: env.USUARIO_URL as string,
    financeiroUrl: env.FINANCEIRO_URL as string,
    smtpUrl: env.SMTP_URL as string,
    smtpFrom: env.SMTP_FROM as string,
    horaDosLembretes,
  });
};
