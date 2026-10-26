import { dispararGatilhos } from './gatilhos.js';
import { createLogger } from './logger.js';

// Hourly: the month turns at most an hour late, and a failed run is retried soon (ADR 0017).
const INTERVALO_MS = 60 * 60 * 1000;

const logger = createLogger('scheduler');
const { PARTICIPACAO_URL: participacao, NOTIFICACAO_URL: notificacao } = process.env;
if (!participacao || !notificacao) {
  logger.error('invalid configuration', {
    errors: ['PARTICIPACAO_URL and NOTIFICACAO_URL must be set'],
  });
  process.exit(1);
}

const disparar = () => dispararGatilhos({ participacao, notificacao }, logger);
const timer = setInterval(disparar, INTERVALO_MS);
logger.info('scheduler started', { intervalMs: INTERVALO_MS });
void disparar();

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    logger.info('shutting down', { signal });
    clearInterval(timer);
  });
}
