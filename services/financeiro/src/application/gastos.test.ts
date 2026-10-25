import { describe, expect, it } from 'vitest';
import type { Gasto, PedidoDeGasto } from '../domain/gasto.js';
import { fail, ok } from '../domain/result.js';
import { type Gastos, registrarGasto } from './gastos.js';

const p1 = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const now = new Date('2026-11-10T15:00:00Z');
const doBolso: PedidoDeGasto = { valorEmCentavos: 4590, origem: 'proprio-bolso', notaId: 'nota-1' };

const inMemory = (conhecidos = [p1]) => {
  const salvos: Gasto[] = [];
  const gastos: Gastos = {
    salvar: async (gasto) => {
      if (!conhecidos.includes(gasto.participanteId)) return fail('participante-nao-encontrado');
      if (salvos.some((g) => g.notaId === gasto.notaId)) return fail('nota-ja-usada');
      salvos.push(gasto);
      return ok(undefined);
    },
  };
  let n = 0;
  const registrar = registrarGasto(gastos, async (id) => id === 'nota-1', {
    now: () => now,
    newId: () => `id-${++n}`,
  });
  return { salvos, registrar };
};

describe('registrarGasto', () => {
  it('saves the gasto as paid by the solicitante', async () => {
    const { salvos, registrar } = inMemory();
    expect(await registrar({ id: p1 }, doBolso)).toEqual({ ok: true, value: 'id-1' });
    expect(salvos).toEqual([{ ...doBolso, id: 'id-1', participanteId: p1, feitoEm: now }]);
  });

  it('refuses a nota that was not guardada, saving nothing', async () => {
    const { salvos, registrar } = inMemory();
    expect(await registrar({ id: p1 }, { ...doBolso, notaId: 'nao-existe' })).toEqual({
      ok: false,
      error: 'nota-nao-encontrada',
    });
    expect(salvos).toEqual([]);
  });

  it('passes on why the gasto was not saved', async () => {
    const { salvos, registrar } = inMemory();
    await registrar({ id: p1 }, doBolso);
    expect(await registrar({ id: p1 }, doBolso)).toEqual({ ok: false, error: 'nota-ja-usada' });
    expect(await inMemory([]).registrar({ id: p1 }, doBolso)).toEqual({
      ok: false,
      error: 'participante-nao-encontrado',
    });
    expect(salvos).toHaveLength(1);
  });
});
