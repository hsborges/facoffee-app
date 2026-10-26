import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  type ComprovanteEnviado,
  cancelar,
  confirmar,
  editar,
  enviar,
  recusar,
} from './comprovante-enviado.js';

const contrato = (type: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../../contracts/events/${type}.v1.json`, import.meta.url), 'utf8'),
  ).examples[0];
const enviado = contrato('finance.receipt-sent');

const participante = { id: enviado.payload.participantId, perfis: ['participante'] };
const gestor = { id: 'gestor-1', perfis: ['participante', 'gestor'] };
const agora = new Date(enviado.occurredAt);
const contexto = { pagamentoId: 'pagamento-1', eventId: 'evento-1', agora };
const pedido = (valorConfirmadoEmCentavos: number, comprovanteId = 'arquivo-1') => ({
  valorConfirmadoEmCentavos,
  comprovanteId,
});

const envio = enviar(
  participante,
  { comprovanteId: 'arquivo-1', valorEmCentavos: enviado.payload.amountInCents },
  { id: enviado.payload.receiptId, eventId: enviado.id, agora },
);
const aConfirmar = envio.comprovante;
const recusado: ComprovanteEnviado = { ...aConfirmar, situacao: 'recusado', motivo: 'Ilegível' };
const confirmado: ComprovanteEnviado = {
  ...aConfirmar,
  situacao: 'confirmado',
  valorConfirmadoEmCentavos: 3000,
};

describe('enviar', () => {
  it('RN-FIN-07: leaves the comprovante of the participante a confirmar, producing Comprovante enviado as in the contract', () => {
    expect(envio).toEqual({
      comprovante: {
        id: enviado.payload.receiptId,
        participanteId: participante.id,
        comprovanteId: 'arquivo-1',
        valorEmCentavos: 3000,
        enviadoEm: agora,
        situacao: 'a-confirmar',
      },
      evento: { ...enviado, occurredAt: agora.toISOString() },
    });
  });
});

describe('editar', () => {
  it('RN-FIN-11: changes valor and arquivo while a confirmar', () => {
    const pedido = { comprovanteId: 'arquivo-2', valorEmCentavos: 2500 };
    expect(editar(participante, aConfirmar, pedido)).toEqual({
      ok: true,
      value: { ...aConfirmar, ...pedido },
    });
  });

  it('RN-FIN-11: refuses a comprovante already confirmado or recusado', () => {
    for (const analisado of [confirmado, recusado]) {
      expect(editar(participante, analisado, aConfirmar)).toEqual({
        ok: false,
        error: 'comprovante-ja-analisado',
      });
    }
  });

  it('RN-FIN-11: hides the comprovante of someone else, even from the gestor', () => {
    expect(editar(gestor, aConfirmar, aConfirmar)).toEqual({
      ok: false,
      error: 'comprovante-enviado-nao-encontrado',
    });
  });
});

describe('cancelar', () => {
  it('RN-FIN-11: is only for the participante, while a confirmar', () => {
    expect(cancelar(participante, aConfirmar)).toEqual({ ok: true, value: undefined });
    expect(cancelar(participante, recusado)).toEqual({
      ok: false,
      error: 'comprovante-ja-analisado',
    });
    expect(cancelar(gestor, aConfirmar)).toEqual({
      ok: false,
      error: 'comprovante-enviado-nao-encontrado',
    });
  });
});

describe('confirmar', () => {
  it('RN-FIN-09: receives the pagamento por PIX with the comprovante, producing Pagamento recebido', () => {
    expect(confirmar(gestor, aConfirmar, pedido(3000), contexto)).toEqual({
      ok: true,
      value: {
        comprovante: confirmado,
        pagamento: {
          id: 'pagamento-1',
          participanteId: participante.id,
          valorEmCentavos: 3000,
          forma: 'pix',
          comprovanteId: 'arquivo-1',
          recebidoEm: agora,
        },
        evento: {
          id: 'evento-1',
          type: 'finance.payment-received',
          version: 1,
          occurredAt: agora.toISOString(),
          payload: {
            paymentId: 'pagamento-1',
            participantId: participante.id,
            amountInCents: 3000,
            method: 'pix',
          },
        },
      },
    });
  });

  it('RN-FIN-09: with the valor corrected by the gestor, the valor confirmado is what counts', () => {
    expect(confirmar(gestor, aConfirmar, pedido(2000), contexto)).toMatchObject({
      ok: true,
      value: {
        comprovante: { valorEmCentavos: 3000, valorConfirmadoEmCentavos: 2000 },
        pagamento: { valorEmCentavos: 2000 },
        evento: { payload: { amountInCents: 2000 } },
      },
    });
  });

  it('RN-FIN-08: only the gestor confirms, and only once', () => {
    expect(confirmar(participante, aConfirmar, pedido(3000), contexto)).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
    for (const analisado of [confirmado, recusado]) {
      expect(confirmar(gestor, analisado, pedido(3000), contexto)).toEqual({
        ok: false,
        error: 'comprovante-ja-analisado',
      });
    }
  });

  it('RN-FIN-12: refuses when the arquivo the gestor saw is no longer the one sent', () => {
    expect(confirmar(gestor, aConfirmar, pedido(3000, 'arquivo-2'), contexto)).toEqual({
      ok: false,
      error: 'comprovante-alterado',
    });
  });
});

describe('recusar', () => {
  const recusadoNoContrato = contrato('finance.receipt-rejected');
  const contexto = { eventId: recusadoNoContrato.id, agora };

  it('RN-FIN-10: keeps the motivo for the participante to see, producing Comprovante recusado as in the contract', () => {
    const { reason } = recusadoNoContrato.payload;
    expect(recusar(gestor, aConfirmar, `  ${reason} `, contexto)).toEqual({
      ok: true,
      value: {
        comprovante: { ...aConfirmar, situacao: 'recusado', motivo: reason },
        evento: { ...recusadoNoContrato, occurredAt: agora.toISOString() },
      },
    });
  });

  it('RN-FIN-10: refuses a recusa without motivo', () => {
    for (const motivo of ['', '   ']) {
      expect(recusar(gestor, aConfirmar, motivo, contexto)).toEqual({
        ok: false,
        error: 'recusa-sem-motivo',
      });
    }
  });

  it('RN-FIN-08: only the gestor recusa, and only once', () => {
    expect(recusar(participante, aConfirmar, 'Ilegível', contexto)).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
    for (const analisado of [confirmado, recusado]) {
      expect(recusar(gestor, analisado, 'Ilegível', contexto)).toEqual({
        ok: false,
        error: 'comprovante-ja-analisado',
      });
    }
  });
});
