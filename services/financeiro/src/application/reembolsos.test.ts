import { describe, expect, it } from 'vitest';
import type { Event } from '../domain/event.js';
import type { Gasto } from '../domain/gasto.js';
import type { Reembolso } from '../domain/reembolso.js';
import { fail, ok } from '../domain/result.js';
import { type Reembolsos, reembolsarGasto } from './reembolsos.js';

const gestor = { perfis: ['gestor'] };
const now = new Date('2026-11-10T15:00:00Z');
const gasto = (id: string, origem: Gasto['origem']): Gasto => ({
  id,
  participanteId: '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d',
  valorEmCentavos: 4590,
  origem,
  notaId: `nota-${id}`,
  feitoEm: now,
});

const inMemory = () => {
  const gastos = [gasto('do-bolso', 'proprio-bolso'), gasto('da-caixinha', 'caixinha')];
  const salvos: Reembolso[] = [];
  const events: Event[] = [];
  const reembolsos: Reembolsos = {
    buscarGasto: async (id) => gastos.find((g) => g.id === id),
    salvar: async (reembolso, newEvents) => {
      if (salvos.some((r) => r.gastoId === reembolso.gastoId)) return fail('gasto-ja-reembolsado');
      salvos.push(reembolso);
      events.push(...newEvents);
      return ok(undefined);
    },
  };
  let n = 0;
  const reembolsar = reembolsarGasto(reembolsos, { now: () => now, newId: () => `id-${++n}` });
  return { salvos, events, reembolsar };
};

describe('reembolsarGasto', () => {
  it('saves the reembolso together with Reembolso feito', async () => {
    const { salvos, events, reembolsar } = inMemory();
    expect(await reembolsar(gestor, 'do-bolso')).toEqual({ ok: true, value: 'id-1' });
    expect(salvos).toEqual([{ id: 'id-1', gastoId: 'do-bolso', feitoEm: now }]);
    expect(events).toMatchObject([
      {
        id: 'id-2',
        type: 'finance.reimbursement-made',
        payload: { reimbursementId: 'id-1', expenseId: 'do-bolso', amountInCents: 4590 },
      },
    ]);
  });

  it('does not reembolsar the same gasto twice', async () => {
    const { salvos, events, reembolsar } = inMemory();
    await reembolsar(gestor, 'do-bolso');
    expect(await reembolsar(gestor, 'do-bolso')).toEqual({
      ok: false,
      error: 'gasto-ja-reembolsado',
    });
    expect(salvos).toHaveLength(1);
    expect(events).toHaveLength(1);
  });

  it('refuses an unknown gasto, a gasto pago pela caixinha or someone other than the gestor', async () => {
    const { salvos, reembolsar } = inMemory();
    expect(await reembolsar(gestor, 'nao-existe')).toEqual({
      ok: false,
      error: 'gasto-nao-encontrado',
    });
    expect(await reembolsar(gestor, 'da-caixinha')).toEqual({
      ok: false,
      error: 'gasto-pago-pela-caixinha',
    });
    expect(await reembolsar({ perfis: ['participante'] }, 'do-bolso')).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
    expect(salvos).toEqual([]);
  });

  it('refuses someone other than the gestor before looking for the gasto', async () => {
    const { reembolsar } = inMemory();
    expect(await reembolsar({ perfis: ['participante'] }, 'nao-existe')).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
  });
});
