import type { Logger } from './logger.js';

// The year first: January's cotas need the valor of the new year.
const GATILHOS = ['iniciar-ano', 'iniciar-mes'] as const;

/**
 * Calls the time triggers of Participação, *Todo início de ano* then *Todo início de mês*, and
 * logs what each did. Both are idempotent, so a failure stops the run and the next one retries.
 */
export const dispararGatilhos = async (
  participacaoUrl: string,
  logger: Logger,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<void> => {
  for (const gatilho of GATILHOS) {
    try {
      const response = await fetch(`${participacaoUrl}/${gatilho}`, { method: 'POST' });
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
