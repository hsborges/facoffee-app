import { describe, expect, it } from 'vitest';
import { dispararGatilhos } from './gatilhos.js';
import { createLogger } from './logger.js';

const logs: Record<string, unknown>[] = [];
const logger = createLogger('test', (line) => logs.push(JSON.parse(line)));

const participacao = (responder: (url: string) => Response | Promise<Response>) => {
  const chamadas: string[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push(`${init?.method} ${url}`);
    return responder(String(url));
  };
  return { chamadas, fetch: fetch as typeof globalThis.fetch };
};

describe('dispararGatilhos', () => {
  it('triggers the início do ano before the início do mês and logs what each did', async () => {
    logs.length = 0;
    const { chamadas, fetch } = participacao((url) =>
      Response.json(url.endsWith('ano') ? { valoresRepetidos: 0 } : { cotasDevidas: 3 }),
    );

    await dispararGatilhos('http://participacao:3000', logger, fetch);

    expect(chamadas).toEqual([
      'POST http://participacao:3000/iniciar-ano',
      'POST http://participacao:3000/iniciar-mes',
    ]);
    expect(logs).toMatchObject([
      { level: 'info', gatilho: 'iniciar-ano', valoresRepetidos: 0 },
      { level: 'info', gatilho: 'iniciar-mes', cotasDevidas: 3 },
    ]);
  });

  it('stops at a failed trigger, so the month never runs before the year; the next run retries', async () => {
    logs.length = 0;
    const falha = participacao(() => new Response(null, { status: 500 }));
    await dispararGatilhos('http://participacao:3000', logger, falha.fetch);
    expect(falha.chamadas).toHaveLength(1);
    expect(logs).toMatchObject([{ level: 'error', gatilho: 'iniciar-ano', status: 500 }]);

    const foraDoAr = participacao(() => Promise.reject(new TypeError('fetch failed')));
    await dispararGatilhos('http://participacao:3000', logger, foraDoAr.fetch);
    expect(foraDoAr.chamadas).toHaveLength(1);
    expect(logs[1]).toMatchObject({ level: 'error', gatilho: 'iniciar-ano' });
  });
});
