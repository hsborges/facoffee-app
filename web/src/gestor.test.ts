import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmarComprovante,
  creditoOuPendencia,
  receberPagamento,
  registrarGasto,
} from './gestor';

const participanteId = '11111111-1111-4111-8111-111111111111';
const arquivo = new File(['%PDF'], 'arquivo.pdf');

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

describe('receberPagamento', () => {
  const pagamento = { participanteId, valorEmCentavos: 3000 };

  it('guarda the comprovante of a PIX, then receives the pagamento with it', async () => {
    const chamadas = responde(
      Response.json({ id: 'comprovante' }, { status: 201 }),
      Response.json({ id: 'pagamento' }, { status: 201 }),
    );

    expect(
      await receberPagamento('token', { ...pagamento, forma: 'pix', comprovante: arquivo }),
    ).toEqual({ feito: true, id: 'pagamento' });
    const [guardar, receber] = chamadas();
    expect(guardar?.caminho).toBe('/api/financeiro/guardar-comprovante');
    const form = guardar?.corpo as FormData;
    expect(form.get('participanteId')).toBe(participanteId);
    expect(form.get('arquivo')).toBeInstanceOf(File);
    expect(receber?.caminho).toBe('/api/financeiro/receber-pagamento');
    expect(JSON.parse(receber?.corpo as string)).toEqual({
      ...pagamento,
      forma: 'pix',
      comprovanteId: 'comprovante',
    });
  });

  it('does not receive the pagamento when the comprovante is not guardado', async () => {
    const chamadas = responde(Response.json({ error: 'tipo-nao-aceito' }, { status: 400 }));
    expect(
      await receberPagamento('token', { ...pagamento, forma: 'pix', comprovante: arquivo }),
    ).toEqual({ feito: false, erro: 'tipo-nao-aceito' });
    expect(chamadas()).toHaveLength(1);
  });

  it('refuses a PIX without comprovante before calling the API', async () => {
    const chamadas = responde();
    for (const comprovante of [null, new File([], '')]) {
      expect(await receberPagamento('token', { ...pagamento, forma: 'pix', comprovante })).toEqual({
        feito: false,
        erro: 'pix-sem-comprovante',
      });
    }
    expect(chamadas()).toHaveLength(0);
  });

  it('receives a pagamento em dinheiro without comprovante, even if a file was picked', async () => {
    const chamadas = responde(Response.json({ id: 'pagamento' }, { status: 201 }));
    expect(
      await receberPagamento('token', { ...pagamento, forma: 'dinheiro', comprovante: arquivo }),
    ).toEqual({ feito: true, id: 'pagamento' });
    const [receber] = chamadas();
    expect(receber?.caminho).toBe('/api/financeiro/receber-pagamento');
    expect(JSON.parse(receber?.corpo as string)).toEqual({ ...pagamento, forma: 'dinheiro' });
  });
});

describe('registrarGasto', () => {
  it('guarda the nota, then registers the gasto with it', async () => {
    const chamadas = responde(
      Response.json({ id: 'nota' }, { status: 201 }),
      Response.json({ id: 'gasto' }, { status: 201 }),
    );
    const gasto = { valorEmCentavos: 4590, origem: 'proprio-bolso', tipo: 'cafe' } as const;

    expect(await registrarGasto('token', { ...gasto, nota: arquivo })).toEqual({
      feito: true,
      id: 'gasto',
    });
    const [guardar, registrar] = chamadas();
    expect(guardar?.caminho).toBe('/api/financeiro/guardar-nota');
    const form = guardar?.corpo as FormData;
    expect(form.get('arquivo')).toBeInstanceOf(File);
    expect(registrar?.caminho).toBe('/api/financeiro/registrar-gasto');
    expect(JSON.parse(registrar?.corpo as string)).toEqual({ ...gasto, notaId: 'nota' });
  });

  it('does not register the gasto when the nota is not guardada', async () => {
    const chamadas = responde(Response.json({ error: 'arquivo-grande-demais' }, { status: 413 }));
    expect(
      await registrarGasto('token', {
        valorEmCentavos: 4590,
        origem: 'caixinha',
        tipo: 'reposicao',
        nota: arquivo,
      }),
    ).toEqual({ feito: false, erro: 'arquivo-grande-demais' });
    expect(chamadas()).toHaveLength(1);
  });
});

describe('confirmarComprovante', () => {
  it('confirms the valor for the arquivo the gestor saw', async () => {
    const chamadas = responde(Response.json({ id: 'pagamento' }, { status: 201 }));
    expect(
      await confirmarComprovante('token', { id: 'enviado', comprovanteId: 'arquivo' }, 2500),
    ).toEqual({ feito: true, id: 'pagamento' });
    const [confirmar] = chamadas();
    expect(confirmar?.caminho).toBe('/api/financeiro/comprovante-enviado/enviado/confirmar');
    expect(JSON.parse(confirmar?.corpo as string)).toEqual({
      valorEmCentavos: 2500,
      comprovanteId: 'arquivo',
    });
  });
});

describe('creditoOuPendencia', () => {
  const situacao = { id: participanteId, ativo: true, creditoEmCentavos: 0, pendenteEmCentavos: 0 };

  it('shows the pendência, the crédito or that the participante is em dia', () => {
    expect(creditoOuPendencia({ ...situacao, pendenteEmCentavos: 3250 })).toBe(
      'Pendente: R$\u00a032,50',
    );
    expect(creditoOuPendencia({ ...situacao, creditoEmCentavos: 6000 })).toBe(
      'Crédito: R$\u00a060,00',
    );
    expect(creditoOuPendencia(situacao)).toBe('Em dia');
  });
});
