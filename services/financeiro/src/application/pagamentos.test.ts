import { describe, expect, it } from 'vitest';
import type { Event } from '../domain/event.js';
import type { Pagamento, PedidoDePagamento } from '../domain/pagamento.js';
import { fail, ok } from '../domain/result.js';
import { type Pagamentos, receberPagamento } from './pagamentos.js';

const p1 = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const gestor = { perfis: ['gestor'] };
const now = new Date('2026-11-10T15:00:00Z');
const porPix: PedidoDePagamento = {
  participanteId: p1,
  valorEmCentavos: 3000,
  forma: 'pix',
  comprovanteId: 'comprovante-1',
};

const inMemory = (conhecidos = [p1]) => {
  const salvos: Pagamento[] = [];
  const events: Event[] = [];
  const pagamentos: Pagamentos = {
    salvar: async (pagamento, newEvents) => {
      if (!conhecidos.includes(pagamento.participanteId)) {
        return fail('participante-nao-encontrado');
      }
      if (salvos.some((p) => p.comprovanteId && p.comprovanteId === pagamento.comprovanteId)) {
        return fail('comprovante-ja-usado');
      }
      salvos.push(pagamento);
      events.push(...newEvents);
      return ok(undefined);
    },
  };
  const comprovantes = new Map([['comprovante-1', p1]]);
  let n = 0;
  const receber = receberPagamento(
    pagamentos,
    async (participanteId, id) => comprovantes.get(id) === participanteId,
    { now: () => now, newId: () => `id-${++n}` },
  );
  return { salvos, events, receber };
};

describe('receberPagamento', () => {
  it('saves the pagamento together with Pagamento recebido', async () => {
    const { salvos, events, receber } = inMemory();
    expect(await receber(gestor, porPix)).toEqual({ ok: true, value: 'id-1' });
    expect(salvos).toEqual([{ ...porPix, id: 'id-1', recebidoEm: now }]);
    expect(events).toMatchObject([
      { id: 'id-2', type: 'finance.payment-received', payload: { paymentId: 'id-1' } },
    ]);
  });

  it('refuses a comprovante not guardado for the participante', async () => {
    const { salvos, receber } = inMemory();
    for (const pedido of [
      { ...porPix, comprovanteId: 'nao-existe' },
      { ...porPix, participanteId: 'outro' },
    ]) {
      expect(await receber(gestor, pedido)).toEqual({
        ok: false,
        error: 'comprovante-nao-encontrado',
      });
    }
    expect(salvos).toEqual([]);
  });

  it('refuses a pagamento por PIX without comprovante, saving nothing', async () => {
    const { salvos, receber } = inMemory();
    expect(await receber(gestor, { ...porPix, comprovanteId: null })).toEqual({
      ok: false,
      error: 'pix-sem-comprovante',
    });
    expect(salvos).toEqual([]);
  });

  it('passes on why the pagamento was not saved', async () => {
    const { events, receber } = inMemory();
    await receber(gestor, porPix);
    expect(await receber(gestor, porPix)).toEqual({ ok: false, error: 'comprovante-ja-usado' });
    const emDinheiro = { ...porPix, forma: 'dinheiro', comprovanteId: null } as const;
    expect(await inMemory([]).receber(gestor, emDinheiro)).toEqual({
      ok: false,
      error: 'participante-nao-encontrado',
    });
    expect(events).toHaveLength(1);
  });
});
