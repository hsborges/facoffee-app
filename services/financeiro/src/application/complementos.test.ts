import { describe, expect, it } from 'vitest';
import type { Complemento } from '../domain/complemento.js';
import type { Event } from '../domain/event.js';
import { type Complementos, solicitarComplemento } from './complementos.js';

const gestor = { perfis: ['gestor'] };
const now = new Date('2026-11-10T15:00:00Z');

const inMemory = (ativos: readonly string[]) => {
  const salvos: Complemento[] = [];
  const events: Event[] = [];
  const complementos: Complementos = {
    ativos: async () => ativos,
    salvar: async (complemento, newEvents) => {
      salvos.push(complemento);
      events.push(...newEvents);
    },
  };
  let n = 0;
  const solicitar = solicitarComplemento(complementos, {
    now: () => now,
    newId: () => `id-${++n}`,
  });
  return { salvos, events, solicitar };
};

describe('solicitarComplemento', () => {
  it('saves the complemento divided among the ativos together with Complemento solicitado', async () => {
    const { salvos, events, solicitar } = inMemory(['p-1', 'p-2', 'p-3']);
    expect(await solicitar(gestor, 1000)).toEqual({ ok: true, value: 'id-1' });
    expect(salvos).toEqual([
      {
        id: 'id-1',
        valorTotalEmCentavos: 1000,
        partes: [
          { participanteId: 'p-1', valorEmCentavos: 334 },
          { participanteId: 'p-2', valorEmCentavos: 333 },
          { participanteId: 'p-3', valorEmCentavos: 333 },
        ],
        solicitadoEm: now,
      },
    ]);
    expect(events).toMatchObject([
      { id: 'id-2', type: 'finance.top-up-requested', payload: { topUpId: 'id-1' } },
    ]);
  });

  it('saves nothing when refused', async () => {
    const { salvos, solicitar } = inMemory([]);
    expect(await solicitar(gestor, 1000)).toEqual({ ok: false, error: 'sem-participantes-ativos' });
    expect(await solicitar({ perfis: ['participante'] }, 1000)).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
    expect(salvos).toEqual([]);
  });
});
