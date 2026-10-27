import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Analise } from './api';
import {
  atalhosDoValorPago,
  depoisDoPagamento,
  detalheDoComprovante,
  editarComprovante,
  enviarComprovante,
} from './participante';

const participanteId = '11111111-1111-4111-8111-111111111111';
const arquivo = new File(['%PDF'], 'pix.pdf');

// Answers each call with the next response, and keeps the calls.
const responde = (...respostas: Response[]) => {
  const fetch = vi.fn(async () => respostas.shift() ?? new Response(null, { status: 500 }));
  vi.stubGlobal('fetch', fetch);
  return () =>
    (fetch.mock.calls as unknown as [string, RequestInit][]).map(([caminho, init]) => ({
      caminho,
      corpo: init.body,
    }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('enviarComprovante', () => {
  it('guarda the comprovante for the participante, then sends it with the valor pago', async () => {
    const chamadas = responde(
      Response.json({ id: 'arquivo' }, { status: 201 }),
      Response.json({ id: 'comprovante' }, { status: 201 }),
    );
    expect(
      await enviarComprovante('token', {
        participanteId,
        valorEmCentavos: 3000,
        comprovante: arquivo,
      }),
    ).toEqual({ feito: true, id: 'comprovante' });
    const [guardar, enviar] = chamadas();
    expect(guardar?.caminho).toBe('/api/financeiro/guardar-comprovante');
    const form = guardar?.corpo as FormData;
    expect(form.get('participanteId')).toBe(participanteId);
    expect(enviar?.caminho).toBe('/api/financeiro/enviar-comprovante');
    expect(JSON.parse(enviar?.corpo as string)).toEqual({
      valorEmCentavos: 3000,
      comprovanteId: 'arquivo',
    });
  });

  it('does not send the comprovante when the arquivo is refused', async () => {
    const chamadas = responde(Response.json({ error: 'tipo-nao-aceito' }, { status: 400 }));
    expect(
      await enviarComprovante('token', {
        participanteId,
        valorEmCentavos: 3000,
        comprovante: arquivo,
      }),
    ).toEqual({ feito: false, erro: 'tipo-nao-aceito' });
    expect(chamadas()).toHaveLength(1);
  });
});

describe('editarComprovante', () => {
  const atual = {
    id: 'comprovante',
    participanteId,
    comprovanteId: 'arquivo',
    valorEmCentavos: 3000,
  };

  it('keeps the arquivo when no other is picked', async () => {
    for (const comprovante of [null, new File([], '')]) {
      const chamadas = responde(new Response(null, { status: 204 }));
      expect(
        await editarComprovante('token', { ...atual, valorEmCentavos: 2500, comprovante }),
      ).toEqual({ feito: true });
      const [editar, ...outras] = chamadas();
      expect(outras).toEqual([]);
      expect(editar?.caminho).toBe('/api/financeiro/comprovante-enviado/comprovante/editar');
      expect(JSON.parse(editar?.corpo as string)).toEqual({
        valorEmCentavos: 2500,
        comprovanteId: 'arquivo',
      });
    }
  });

  it('guarda the other arquivo first, then edits with it', async () => {
    const chamadas = responde(
      Response.json({ id: 'outro-arquivo' }, { status: 201 }),
      new Response(null, { status: 204 }),
    );
    expect(await editarComprovante('token', { ...atual, comprovante: arquivo })).toEqual({
      feito: true,
    });
    const [guardar, editar] = chamadas();
    expect(guardar?.caminho).toBe('/api/financeiro/guardar-comprovante');
    expect(JSON.parse(editar?.corpo as string)).toEqual({
      valorEmCentavos: 3000,
      comprovanteId: 'outro-arquivo',
    });
  });
});

describe('detalheDoComprovante', () => {
  const comprovante = { id: 'c', participanteId, comprovanteId: 'a', valorEmCentavos: 3000 };

  it('RN-FIN-10: tells a confirmar, the valor confirmado or the motivo da recusa', () => {
    const com = (analise: Analise) =>
      detalheDoComprovante({ ...comprovante, enviadoEm: '', ...analise });
    expect(com({ situacao: 'a-confirmar' })).toBe('Vale como pagamento quando o gestor confirmar.');
    expect(com({ situacao: 'confirmado', valorConfirmadoEmCentavos: 2000 })).toBe(
      'Valor confirmado: R$\u00a020,00',
    );
    expect(com({ situacao: 'recusado', motivo: 'Ilegível' })).toBe('Motivo: Ilegível');
  });
});

describe('atalhosDoValorPago', () => {
  it('RN-FIN-34: one month, until December and a semester of cota, from the current month', () => {
    expect(atalhosDoValorPago(3000, '2026-10')).toEqual([
      { rotulo: '1 mês', valorEmCentavos: 3000 },
      { rotulo: 'Até dezembro', valorEmCentavos: 9000 },
      { rotulo: 'Semestre', valorEmCentavos: 18000 },
    ]);
  });

  it('RN-FIN-34: a shortcut of the same valor as another is not repeated', () => {
    expect(atalhosDoValorPago(2500, '2026-12').map(({ rotulo }) => rotulo)).toEqual([
      '1 mês',
      'Semestre',
    ]);
    expect(atalhosDoValorPago(2500, '2026-07').map(({ rotulo }) => rotulo)).toEqual([
      '1 mês',
      'Até dezembro',
    ]);
  });
});

describe('depoisDoPagamento', () => {
  const pendente = { creditoEmCentavos: 0, pendenteEmCentavos: 3000 };

  it('RN-FIN-35: tells how the situação stands after paying', () => {
    expect(depoisDoPagamento('Bia', pendente, 3000)).toEqual({
      situacao: 'em-dia',
      texto: 'Bia fica em dia, sem crédito.',
    });
    expect(depoisDoPagamento('Ana', pendente, 9000)).toEqual({
      situacao: 'credito',
      texto: 'Ana fica com R$\u00a060,00 de crédito.',
    });
    expect(depoisDoPagamento('Você', pendente, 1000)).toEqual({
      situacao: 'pendente',
      texto: 'Você continua pendente em R$\u00a020,00.',
    });
  });

  it('RN-FIN-35: a crédito adds to what is paid', () => {
    expect(
      depoisDoPagamento('Ana', { creditoEmCentavos: 500, pendenteEmCentavos: 0 }, 1000),
    ).toEqual({ situacao: 'credito', texto: 'Ana fica com R$\u00a015,00 de crédito.' });
  });
});
