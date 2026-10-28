import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  conferidosComOValor,
  confirmarComprovante,
  creditoOuPendencia,
  definicaoDoValorDaCota,
  definirValoresDaCota,
  listaDeConferencia,
  receberPagamento,
  registrarGasto,
  saldoDepoisDosReembolsos,
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

  it('RN-FIN-02: refuses a PIX without comprovante before calling the API', async () => {
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
  it('RN-FIN-12: confirms the valor for the arquivo the gestor saw', async () => {
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

  it('RN-FIN-20: shows the pendência, the crédito or that the participante is em dia', () => {
    expect(creditoOuPendencia({ ...situacao, pendenteEmCentavos: 3250 })).toBe(
      'Pendente: R$\u00a032,50',
    );
    expect(creditoOuPendencia({ ...situacao, creditoEmCentavos: 6000 })).toBe(
      'Crédito: R$\u00a060,00',
    );
    expect(creditoOuPendencia(situacao)).toBe('Em dia');
  });
});

describe('listaDeConferencia', () => {
  it('RN-FIN-36: short steps to check in the comprovante, the valor being the one to confirmar', () => {
    expect(listaDeConferencia(3000)).toEqual([
      'É um comprovante de PIX, legível',
      'O valor é R$\u00a030,00',
      'A data é deste mês',
    ]);
    expect(listaDeConferencia(2550)[1]).toBe('O valor é R$\u00a025,50');
  });
});

describe('conferidosComOValor', () => {
  it('RN-FIN-36: correcting the valor unchecks its step, even when the valor goes back to the one before', () => {
    const todos = new Set(listaDeConferencia(3000));
    const corrigido = conferidosComOValor(todos, 2500);
    expect([...corrigido]).toEqual(['É um comprovante de PIX, legível', 'A data é deste mês']);
    expect([...conferidosComOValor(corrigido, 3000)]).toEqual([...corrigido]);
    expect(conferidosComOValor(todos, 3000)).toEqual(todos);
  });
});

describe('definicaoDoValorDaCota', () => {
  const so = (tipoDeCota: 'so-cafe' | 'completa', ano: number) => ({
    tipoDeCota,
    ano,
    valorEmCentavos: 2500,
  });

  it('RN-PAR-14: defines this year while a tipo de cota is missing in it', () => {
    expect(definicaoDoValorDaCota(2026, [so('completa', 2026)], [])).toEqual({
      ano: 2026,
      tipos: ['so-cafe'],
    });
  });

  it('RN-PAR-14: then the next year, only the tipos de cota still missing in it', () => {
    const doAno = [so('so-cafe', 2026), so('completa', 2026)];
    expect(definicaoDoValorDaCota(2026, doAno, [])).toEqual({
      ano: 2027,
      tipos: ['so-cafe', 'completa'],
    });
    expect(definicaoDoValorDaCota(2026, doAno, [so('so-cafe', 2027)])).toEqual({
      ano: 2027,
      tipos: ['completa'],
    });
  });

  it('RN-PAR-14: nothing to define once both years are defined', () => {
    const doAno = [so('so-cafe', 2026), so('completa', 2026)];
    expect(
      definicaoDoValorDaCota(2026, doAno, [so('so-cafe', 2027), so('completa', 2027)]),
    ).toBeUndefined();
  });
});

describe('definirValoresDaCota', () => {
  const definicoes = [
    { tipoDeCota: 'so-cafe', valorEmCentavos: 2500 },
    { tipoDeCota: 'completa', valorEmCentavos: 3500 },
  ] as const;

  it('defines each tipo de cota for the year', async () => {
    const chamadas = responde(
      new Response(null, { status: 204 }),
      new Response(null, { status: 204 }),
    );
    expect(await definirValoresDaCota('token', 2027, definicoes)).toEqual({
      feito: true,
      definidos: ['so-cafe', 'completa'],
    });
    expect(chamadas().map((chamada) => JSON.parse(chamada.corpo as string))).toEqual([
      { tipoDeCota: 'so-cafe', valorEmCentavos: 2500, ano: 2027 },
      { tipoDeCota: 'completa', valorEmCentavos: 3500, ano: 2027 },
    ]);
  });

  it('stops at the first refusal and tells which tipos de cota were already defined', async () => {
    const chamadas = responde(
      new Response(null, { status: 204 }),
      Response.json({ error: 'valor-ja-definido' }, { status: 409 }),
    );
    expect(await definirValoresDaCota('token', 2027, definicoes)).toEqual({
      feito: false,
      erro: 'valor-ja-definido',
      definidos: ['so-cafe'],
    });
    expect(chamadas()).toHaveLength(2);
  });
});

describe('saldoDepoisDosReembolsos', () => {
  const gasto = {
    id: 'g',
    participanteId,
    tipo: 'cafe',
    notaId: 'n',
    feitoEm: '2026-10-25T12:00:00Z',
  } as const;

  it('RN-FIN-37: takes from the saldo only the gastos do próprio bolso not reembolsados', () => {
    expect(
      saldoDepoisDosReembolsos(64650, [
        { ...gasto, valorEmCentavos: 4590, origem: 'proprio-bolso', reembolsado: false },
        { ...gasto, valorEmCentavos: 1000, origem: 'proprio-bolso', reembolsado: true },
        { ...gasto, valorEmCentavos: 2000, origem: 'caixinha', reembolsado: false },
      ]),
    ).toBe(60060);
  });
});
