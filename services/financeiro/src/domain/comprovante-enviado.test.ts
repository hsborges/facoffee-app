import { describe, expect, it } from 'vitest';
import {
  type ComprovanteEnviado,
  cancelar,
  confirmar,
  editar,
  enviar,
  recusar,
} from './comprovante-enviado.js';

const participante = { id: 'participante-1', perfis: ['participante'] };
const gestor = { id: 'gestor-1', perfis: ['participante', 'gestor'] };
const agora = new Date('2026-11-10T15:00:00Z');
const contexto = { pagamentoId: 'pagamento-1', eventId: 'evento-1', agora };

const aConfirmar = enviar(
  participante,
  { comprovanteId: 'arquivo-1', valorEmCentavos: 3000 },
  { id: 'comprovante-1', agora },
);
const recusado: ComprovanteEnviado = { ...aConfirmar, situacao: 'recusado', motivo: 'Ilegível' };
const confirmado: ComprovanteEnviado = {
  ...aConfirmar,
  situacao: 'confirmado',
  valorConfirmadoEmCentavos: 3000,
};

describe('enviar', () => {
  it('leaves the comprovante of the participante a confirmar', () => {
    expect(aConfirmar).toEqual({
      id: 'comprovante-1',
      participanteId: 'participante-1',
      comprovanteId: 'arquivo-1',
      valorEmCentavos: 3000,
      enviadoEm: agora,
      situacao: 'a-confirmar',
    });
  });
});

describe('editar', () => {
  it('changes valor and arquivo while a confirmar', () => {
    const pedido = { comprovanteId: 'arquivo-2', valorEmCentavos: 2500 };
    expect(editar(participante, aConfirmar, pedido)).toEqual({
      ok: true,
      value: { ...aConfirmar, ...pedido },
    });
  });

  it('refuses a comprovante already confirmado or recusado', () => {
    for (const analisado of [confirmado, recusado]) {
      expect(editar(participante, analisado, aConfirmar)).toEqual({
        ok: false,
        error: 'comprovante-ja-analisado',
      });
    }
  });

  it('hides the comprovante of someone else, even from the gestor', () => {
    expect(editar(gestor, aConfirmar, aConfirmar)).toEqual({
      ok: false,
      error: 'comprovante-enviado-nao-encontrado',
    });
  });
});

describe('cancelar', () => {
  it('is only for the participante, while a confirmar', () => {
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
  it('receives the pagamento por PIX with the comprovante, producing Pagamento recebido', () => {
    expect(confirmar(gestor, aConfirmar, 3000, contexto)).toEqual({
      ok: true,
      value: {
        comprovante: confirmado,
        pagamento: {
          id: 'pagamento-1',
          participanteId: 'participante-1',
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
            participantId: 'participante-1',
            amountInCents: 3000,
            method: 'pix',
          },
        },
      },
    });
  });

  it('with the valor corrected by the gestor, the valor confirmado is what counts', () => {
    expect(confirmar(gestor, aConfirmar, 2000, contexto)).toMatchObject({
      ok: true,
      value: {
        comprovante: { valorEmCentavos: 3000, valorConfirmadoEmCentavos: 2000 },
        pagamento: { valorEmCentavos: 2000 },
        evento: { payload: { amountInCents: 2000 } },
      },
    });
  });

  it('only the gestor confirms, and only once', () => {
    expect(confirmar(participante, aConfirmar, 3000, contexto)).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
    for (const analisado of [confirmado, recusado]) {
      expect(confirmar(gestor, analisado, 3000, contexto)).toEqual({
        ok: false,
        error: 'comprovante-ja-analisado',
      });
    }
  });
});

describe('recusar', () => {
  it('keeps the motivo for the participante to see', () => {
    expect(recusar(gestor, aConfirmar, '  Valor diferente do PIX ')).toEqual({
      ok: true,
      value: { ...aConfirmar, situacao: 'recusado', motivo: 'Valor diferente do PIX' },
    });
  });

  it('refuses a recusa without motivo', () => {
    for (const motivo of ['', '   ']) {
      expect(recusar(gestor, aConfirmar, motivo)).toEqual({
        ok: false,
        error: 'recusa-sem-motivo',
      });
    }
  });

  it('only the gestor recusa, and only once', () => {
    expect(recusar(participante, aConfirmar, 'Ilegível')).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
    for (const analisado of [confirmado, recusado]) {
      expect(recusar(gestor, analisado, 'Ilegível')).toEqual({
        ok: false,
        error: 'comprovante-ja-analisado',
      });
    }
  });
});
