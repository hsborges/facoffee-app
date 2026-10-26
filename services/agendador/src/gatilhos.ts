import type { Logger } from './logger.js';

/** Base URLs of the services whose triggers the agendador calls. */
export type Urls = { readonly participacao: string; readonly notificacao: string };

// The year first: January's cotas need the valor of the new year. The lembrete last, after the
// cotas of the month.
const gatilhos = ({ participacao, notificacao }: Urls) =>
  [
    ['iniciar-ano', participacao],
    ['iniciar-mes', participacao],
    ['lembrar-pendentes', notificacao],
  ] as const;

/**
 * Calls the time triggers: *Todo início de ano* and *Todo início de mês* in Participação, then
 * *Lembrar os pendentes* in Notificação, and logs what each did. All are idempotent, so a
 * failure stops the run and the next one retries.
 */
export const dispararGatilhos = async (
  urls: Urls,
  logger: Logger,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<void> => {
  for (const [gatilho, url] of gatilhos(urls)) {
    try {
      const response = await fetch(`${url}/${gatilho}`, { method: 'POST' });
      if (!response.ok) {
        logger.error('trigger failed', { gatilho, status: response.status });
        return;
      }
      logger.info('trigger fired', { gatilho, ...(await response.json()) });
    } catch (error) {
      logger.error('trigger failed', { gatilho, error });
      return;
    }
  }
};
