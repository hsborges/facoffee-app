import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type PedidoDePagamento, receber } from './pagamento.js';

const contrato = JSON.parse(
  readFileSync(
    new URL('../../../../contracts/events/finance.payment-received.v1.json', import.meta.url),
    'utf8',
  ),
).examples[0];

const gestor = { perfis: ['participante', 'gestor'] };
const contexto = {
  pagamentoId: contrato.payload.paymentId,
  eventId: contrato.id,
  agora: new Date(contrato.occurredAt),
};
const porPix: PedidoDePagamento = {
  participanteId: contrato.payload.participantId,
  valorEmCentavos: contrato.payload.amountInCents,
  forma: 'pix',
  comprovanteId: '11111111-1111-4111-8111-111111111111',
};
const emDinheiro: PedidoDePagamento = { ...porPix, forma: 'dinheiro', comprovanteId: null };

describe('receber', () => {
  it('RN-FIN-02: records the pagamento por PIX and produces Pagamento recebido as in the contract', () => {
    const result = receber(gestor, porPix, contexto);
    expect(result).toEqual({
      ok: true,
      value: {
        pagamento: { ...porPix, id: contexto.pagamentoId, recebidoEm: contexto.agora },
        evento: { ...contrato, occurredAt: contexto.agora.toISOString() },
      },
    });
  });

  it('RN-FIN-02: records the pagamento em dinheiro as cash', () => {
    const result = receber(gestor, emDinheiro, contexto);
    expect(result).toMatchObject({ ok: true, value: { evento: { payload: { method: 'cash' } } } });
  });

  it('RN-FIN-02: refuses a pagamento por PIX without comprovante', () => {
    expect(receber(gestor, { ...porPix, comprovanteId: null }, contexto)).toEqual({
      ok: false,
      error: 'pix-sem-comprovante',
    });
  });

  it('RN-FIN-02: refuses a comprovante on a pagamento em dinheiro', () => {
    expect(
      receber(gestor, { ...emDinheiro, comprovanteId: porPix.comprovanteId }, contexto),
    ).toEqual({ ok: false, error: 'comprovante-so-no-pix' });
  });

  it('RN-FIN-01: only the gestor receives pagamentos', () => {
    expect(receber({ perfis: ['participante'] }, porPix, contexto)).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
  });
});
