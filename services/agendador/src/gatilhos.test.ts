import { describe, expect, it } from 'vitest';
import { dispararGatilhos } from './gatilhos.js';
import { createLogger } from './logger.js';

const logs: Record<string, unknown>[] = [];
const logger = createLogger('test', (line) => logs.push(JSON.parse(line)));
const urls = { participacao: 'http://participacao:3000', notificacao: 'http://notificacao:3000' };

const servicos = (responder: (url: string) => Response | Promise<Response>) => {
  const chamadas: string[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push(`${init?.method} ${url}`);
    return responder(String(url));
  };
  return { chamadas, fetch: fetch as typeof globalThis.fetch };
};

const respostas: Record<string, unknown> = {
  'iniciar-ano': { valoresRepetidos: 0 },
  'iniciar-mes': { cotasDevidas: 3 },
  'lembrar-pendentes': { lembretes: 2 },
};

describe('dispararGatilhos', () => {
  it('RNF-05: triggers the início do ano, the início do mês, then the lembrete, and logs what each did', async () => {
    logs.length = 0;
    const { chamadas, fetch } = servicos((url) =>
      Response.json(respostas[url.slice(url.lastIndexOf('/') + 1)]),
    );

    await dispararGatilhos(urls, logger, fetch);

    expect(chamadas).toEqual([
      'POST http://participacao:3000/iniciar-ano',
      'POST http://participacao:3000/iniciar-mes',
      'POST http://notificacao:3000/lembrar-pendentes',
    ]);
    expect(logs).toMatchObject([
      { level: 'info', gatilho: 'iniciar-ano', valoresRepetidos: 0 },
      { level: 'info', gatilho: 'iniciar-mes', cotasDevidas: 3 },
      { level: 'info', gatilho: 'lembrar-pendentes', lembretes: 2 },
    ]);
  });

  it('RNF-05: stops at a failed trigger, so the month never runs before the year; the next run retries', async () => {
    logs.length = 0;
    const falha = servicos(() => new Response(null, { status: 500 }));
    await dispararGatilhos(urls, logger, falha.fetch);
    expect(falha.chamadas).toHaveLength(1);
    expect(logs).toMatchObject([{ level: 'error', gatilho: 'iniciar-ano', status: 500 }]);

    const foraDoAr = servicos(() => Promise.reject(new TypeError('fetch failed')));
    await dispararGatilhos(urls, logger, foraDoAr.fetch);
    expect(foraDoAr.chamadas).toHaveLength(1);
    expect(logs[1]).toMatchObject({ level: 'error', gatilho: 'iniciar-ano' });
  });
});
