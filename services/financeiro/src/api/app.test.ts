import { describe, expect, it } from 'vitest';
import {
  type Armazem,
  type Arquivo,
  baixarComprovante,
  baixarNota,
  comprovanteDoParticipante,
  guardarComprovante,
  guardarNota,
  notaDoParticipante,
} from '../application/arquivos.js';
import { solicitarComplemento } from '../application/complementos.js';
import {
  type ComprovantesEnviados,
  cancelarComprovante,
  confirmarComprovante,
  editarComprovante,
  enviarComprovante,
  listarComprovantesAConfirmar,
  listarMeusComprovantes,
  recusarComprovante,
} from '../application/comprovantes-enviados.js';
import {
  consultarCreditoEPendente,
  listarCreditoEPendentes,
  listarPendentes,
} from '../application/credito.js';
import { listarGastos, registrarGasto } from '../application/gastos.js';
import { receberPagamento } from '../application/pagamentos.js';
import { reembolsarGasto } from '../application/reembolsos.js';
import { TAMANHO_MAXIMO } from '../domain/arquivo.js';
import type { ComprovanteEnviado } from '../domain/comprovante-enviado.js';
import type { Gasto } from '../domain/gasto.js';
import { fail, ok } from '../domain/result.js';
import { createLogger } from '../infra/logger.js';
import { type ApiDependencies, createApp } from './app.js';

const participante = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const outro = '11111111-1111-4111-8111-111111111111';
const gestor = { 'x-user-id': '22222222-2222-4222-8222-222222222222', 'x-user-roles': 'gestor' };
const doParticipante = { 'x-user-id': participante, 'x-user-roles': 'participante' };
const doOutro = { 'x-user-id': outro, 'x-user-roles': 'participante' };

const totais = [{ id: participante, ativo: true, devidoEmCentavos: 3000, pagoEmCentavos: 9000 }];
const buscarTotais = async (id?: string) => totais.filter((t) => id === undefined || t.id === id);
const devido = {
  cotas: [{ mes: '2026-11', tipoDeCota: 'completa' as const, valorEmCentavos: 3000 }],
  complementos: [
    { id: outro, solicitadoEm: new Date('2026-11-20T15:00:00Z'), parteEmCentavos: 1001 },
  ],
};

const gastoDoBolso: Gasto = {
  id: '33333333-3333-4333-8333-333333333333',
  participanteId: participante,
  valorEmCentavos: 4590,
  origem: 'proprio-bolso',
  tipo: 'cafe',
  notaId: outro,
  feitoEm: new Date(),
};
const gastoDaCaixinha: Gasto = {
  ...gastoDoBolso,
  id: '44444444-4444-4444-8444-444444444444',
  origem: 'caixinha',
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

const app = (deps: Partial<ApiDependencies> = {}) => {
  const arquivos = new Map<string, Arquivo>();
  const armazem: Armazem = {
    guardar: async (chave, arquivo) => {
      arquivos.set(chave, arquivo);
    },
    obter: async (chave) => arquivos.get(chave),
  };
  let ids = 0;
  const newId = () => `0000000${++ids}-0000-4000-8000-000000000000`;
  const reembolsados = new Set<string>();
  const enviados = new Map<string, ComprovanteEnviado>();
  const seAConfirmar = async (c: ComprovanteEnviado) => {
    if (enviados.get(c.id)?.situacao !== 'a-confirmar') return fail('comprovante-ja-analisado');
    enviados.set(c.id, c);
    return ok(undefined);
  };
  const comprovantesEnviados: ComprovantesEnviados = {
    buscar: async (id) => enviados.get(id),
    aConfirmar: async () => [...enviados.values()].filter((c) => c.situacao === 'a-confirmar'),
    doParticipante: async (id) => [...enviados.values()].filter((c) => c.participanteId === id),
    salvar: async (c) => {
      enviados.set(c.id, c);
      return ok(undefined);
    },
    editar: seAConfirmar,
    recusar: seAConfirmar,
    remover: async (id) => {
      if (enviados.get(id)?.situacao !== 'a-confirmar') return fail('comprovante-ja-analisado');
      enviados.delete(id);
      return ok(undefined);
    },
    confirmar: seAConfirmar,
  };
  return createApp({
    guardarComprovante: guardarComprovante(armazem, newId),
    guardarNota: guardarNota(armazem, newId),
    baixarComprovante: baixarComprovante(armazem),
    baixarNota: baixarNota(armazem),
    receberPagamento: receberPagamento(
      { salvar: async () => ok(undefined) },
      comprovanteDoParticipante(armazem),
      { now: () => new Date(), newId },
    ),
    registrarGasto: registrarGasto(
      { salvar: async () => ok(undefined) },
      notaDoParticipante(armazem),
      {
        now: () => new Date(),
        newId,
      },
    ),
    reembolsarGasto: reembolsarGasto(
      {
        buscarGasto: async (id) => [gastoDoBolso, gastoDaCaixinha].find((g) => g.id === id),
        salvar: async ({ gastoId }) => {
          if (reembolsados.has(gastoId)) return fail('gasto-ja-reembolsado');
          reembolsados.add(gastoId);
          return ok(undefined);
        },
      },
      { now: () => new Date(), newId },
    ),
    enviarComprovante: enviarComprovante(comprovantesEnviados, comprovanteDoParticipante(armazem), {
      now: () => new Date(),
      newId,
    }),
    editarComprovante: editarComprovante(comprovantesEnviados, comprovanteDoParticipante(armazem)),
    cancelarComprovante: cancelarComprovante(comprovantesEnviados),
    confirmarComprovante: confirmarComprovante(comprovantesEnviados, {
      now: () => new Date(),
      newId,
    }),
    recusarComprovante: recusarComprovante(comprovantesEnviados),
    listarComprovantesAConfirmar: listarComprovantesAConfirmar(comprovantesEnviados.aConfirmar),
    listarMeusComprovantes: listarMeusComprovantes(comprovantesEnviados.doParticipante),
    solicitarComplemento: solicitarComplemento(
      { ativos: async () => [participante, outro], salvar: async () => {} },
      { now: () => new Date(), newId },
    ),
    consultarCaixinha: async () => ({
      saldoEmCentavos: -1500,
      gastosDoAnoAnteriorEmCentavos: 90000,
      gastosDoAnoAnteriorPorTipoEmCentavos: {
        cafe: 60000,
        'outros-itens': 20000,
        'conserto-e-manutencao': 10000,
        reposicao: 0,
      },
    }),
    consultarCaixinhaDoMes: async (mes) => ({
      mes,
      saldoNoInicioEmCentavos: 1000,
      recebidoEmCentavos: 500,
      gastosPorTipoEmCentavos: {
        cafe: 300,
        'outros-itens': 0,
        'conserto-e-manutencao': 0,
        reposicao: 0,
      },
      saldoNoFimEmCentavos: 1200,
    }),
    listarGastos: listarGastos(async () => []),
    listarCreditoEPendentes: listarCreditoEPendentes(buscarTotais),
    consultarCreditoEPendente: consultarCreditoEPendente(buscarTotais, async () => devido),
    listarPendentes: listarPendentes(buscarTotais, async () => devido),
    health: async () => ({ database: true, rabbitmq: true, armazenamento: true }),
    logger: createLogger('test', () => {}),
    ...deps,
  });
};

const formulario = (campos: Record<string, string | Uint8Array>) => {
  const form = new FormData();
  for (const [nome, valor] of Object.entries(campos)) {
    if (typeof valor === 'string') form.append(nome, valor);
    else form.append(nome, new Blob([valor as BlobPart]), 'arquivo');
  }
  return form;
};

const enviar = (
  api: ReturnType<typeof app>,
  path: string,
  headers: Record<string, string>,
  body: BodyInit,
) => api.request(path, { method: 'POST', headers, body });

describe('GET /health', () => {
  it('200 when every dependency is healthy', async () => {
    const response = await app().request('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      dependencies: { database: true, rabbitmq: true, armazenamento: true },
    });
  });

  it('503 when a dependency fails', async () => {
    const response = await app({
      health: async () => ({ database: true, rabbitmq: true, armazenamento: false }),
    }).request('/health');
    expect(response.status).toBe(503);
  });
});

describe('comprovante', () => {
  const guardado = async () => {
    const api = app();
    const response = await enviar(
      api,
      '/guardar-comprovante',
      gestor,
      formulario({ arquivo: PNG, participanteId: participante }),
    );
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    return { api, id };
  };

  it('is guardado by the gestor and downloaded by its participante, with the real type', async () => {
    const { api, id } = await guardado();
    const response = await api.request(`/comprovante/${id}`, { headers: doParticipante });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  it('404 for another participante, as if it did not exist', async () => {
    const { api, id } = await guardado();
    expect((await api.request(`/comprovante/${id}`, { headers: doOutro })).status).toBe(404);
    expect((await api.request('/comprovante/abc', { headers: gestor })).status).toBe(404);
  });

  it('401 without the logged-in person', async () => {
    const { api, id } = await guardado();
    expect((await api.request(`/comprovante/${id}`)).status).toBe(401);
    const form = formulario({ arquivo: PNG, participanteId: participante });
    expect((await enviar(api, '/guardar-comprovante', {}, form)).status).toBe(401);
  });

  it('is guardado by the participante for themself, but 403 for someone else', async () => {
    const proprio = formulario({ arquivo: PNG, participanteId: participante });
    expect((await enviar(app(), '/guardar-comprovante', doParticipante, proprio)).status).toBe(201);
    const alheio = formulario({ arquivo: PNG, participanteId: outro });
    const response = await enviar(app(), '/guardar-comprovante', doParticipante, alheio);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'sem-permissao' });
  });

  it('400 without arquivo or a valid participanteId', async () => {
    for (const form of [
      formulario({ participanteId: participante }),
      formulario({ arquivo: PNG, participanteId: 'abc' }),
      formulario({ arquivo: PNG }),
    ]) {
      const response = await enviar(app(), '/guardar-comprovante', gestor, form);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'pedido-invalido' });
    }
  });
});

describe('nota', () => {
  it('is guardada and downloaded by any participante', async () => {
    const api = app();
    const response = await enviar(api, '/guardar-nota', doOutro, formulario({ arquivo: PNG }));
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    const baixada = await api.request(`/nota/${id}`, { headers: doParticipante });
    expect(baixada.status).toBe(200);
    expect(new Uint8Array(await baixada.arrayBuffer())).toEqual(PNG);
  });

  it('400 for a type not accepted', async () => {
    const html = new TextEncoder().encode('<html>');
    const response = await enviar(app(), '/guardar-nota', doOutro, formulario({ arquivo: html }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'tipo-nao-aceito' });
  });

  it('413 above 5 MB', async () => {
    const grande = new Uint8Array(TAMANHO_MAXIMO + 1);
    grande.set(PNG);
    const response = await enviar(app(), '/guardar-nota', doOutro, formulario({ arquivo: grande }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'arquivo-grande-demais' });
  });

  it('413 for a body far above the limit, before reading it', async () => {
    const response = await enviar(
      app(),
      '/guardar-nota',
      doOutro,
      new Uint8Array(TAMANHO_MAXIMO * 2),
    );
    expect(response.status).toBe(413);
  });

  it('404 for a nota that does not exist and 401 without the logged-in person', async () => {
    const api = app();
    expect((await api.request(`/nota/${outro}`, { headers: doOutro })).status).toBe(404);
    expect((await api.request(`/nota/${outro}`)).status).toBe(401);
  });
});

describe('POST /receber-pagamento', () => {
  const receber = (api: ReturnType<typeof app>, headers: Record<string, string>, body: unknown) =>
    enviar(
      api,
      '/receber-pagamento',
      { ...headers, 'content-type': 'application/json' },
      JSON.stringify(body),
    );
  const emDinheiro = { participanteId: participante, valorEmCentavos: 3000, forma: 'dinheiro' };

  it('201 with the id of the pagamento por PIX, referencing its comprovante', async () => {
    const api = app();
    const form = formulario({ arquivo: PNG, participanteId: participante });
    const comprovante = await enviar(api, '/guardar-comprovante', gestor, form);
    const { id: comprovanteId } = (await comprovante.json()) as { id: string };

    const response = await receber(api, gestor, { ...emDinheiro, forma: 'pix', comprovanteId });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: expect.any(String) });
  });

  it.each([
    [participante.toUpperCase(), participante],
    [participante, participante.toUpperCase()],
  ])(
    'matches ids in any case (comprovante of %s, pagamento of %s)',
    async (doComprovante, doPagamento) => {
      const api = app();
      const form = formulario({ arquivo: PNG, participanteId: doComprovante });
      const comprovante = await enviar(api, '/guardar-comprovante', gestor, form);
      const { id } = (await comprovante.json()) as { id: string };

      const response = await receber(api, gestor, {
        ...emDinheiro,
        participanteId: doPagamento,
        forma: 'pix',
        comprovanteId: id.toUpperCase(),
      });
      expect(response.status).toBe(201);
    },
  );

  it('201 for a pagamento em dinheiro', async () => {
    expect((await receber(app(), gestor, emDinheiro)).status).toBe(201);
  });

  it('400 for a pagamento por PIX without comprovante', async () => {
    const response = await receber(app(), gestor, { ...emDinheiro, forma: 'pix' });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'pix-sem-comprovante' });
  });

  it('404 for a comprovante that was not guardado for the participante', async () => {
    const comprovanteId = outro;
    const response = await receber(app(), gestor, { ...emDinheiro, forma: 'pix', comprovanteId });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'comprovante-nao-encontrado' });
  });

  it('400 for an invalid pedido', async () => {
    for (const body of [
      { ...emDinheiro, participanteId: 'abc' },
      { ...emDinheiro, valorEmCentavos: 0 },
      { ...emDinheiro, valorEmCentavos: 10.5 },
      { ...emDinheiro, forma: 'cheque' },
      { ...emDinheiro, comprovanteId: 'abc' },
      'nao-e-objeto',
      { ...emDinheiro, observacao: 'x'.repeat(5000) },
    ]) {
      const response = await receber(app(), gestor, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'pedido-invalido' });
    }
  });

  it('403 when not the gestor and 401 without the logged-in person', async () => {
    expect((await receber(app(), doParticipante, emDinheiro)).status).toBe(403);
    expect((await receber(app(), {}, emDinheiro)).status).toBe(401);
  });
});

describe('comprovante enviado', () => {
  const json = (api: ReturnType<typeof app>, path: string, headers: object, body?: unknown) =>
    enviar(
      api,
      path,
      { ...headers, 'content-type': 'application/json' } as Record<string, string>,
      body === undefined ? '' : JSON.stringify(body),
    );
  const guardar = async (api: ReturnType<typeof app>) => {
    const form = formulario({ arquivo: PNG, participanteId: participante });
    const guardado = await enviar(api, '/guardar-comprovante', doParticipante, form);
    return ((await guardado.json()) as { id: string }).id;
  };
  const enviado = async () => {
    const api = app();
    const comprovanteId = await guardar(api);
    const response = await json(api, '/enviar-comprovante', doParticipante, {
      valorEmCentavos: 3000,
      comprovanteId: comprovanteId.toUpperCase(),
    });
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    return { api, id, comprovanteId };
  };
  const ler = async (api: ReturnType<typeof app>, path: string, headers: object) =>
    (await api.request(path, { headers: headers as Record<string, string> })).json();

  it('is sent by the participante a confirmar, for them and the gestor to see', async () => {
    const { api, id, comprovanteId } = await enviado();
    const esperado = {
      id,
      participanteId: participante,
      comprovanteId,
      valorEmCentavos: 3000,
      enviadoEm: expect.any(String),
      situacao: 'a-confirmar',
    };
    expect(await ler(api, '/comprovante-enviado/eu', doParticipante)).toEqual([esperado]);
    expect(await ler(api, '/comprovante-enviado/eu', doOutro)).toEqual([]);
    expect(await ler(api, '/comprovante-enviado', gestor)).toEqual([esperado]);
    const response = await api.request('/comprovante-enviado', { headers: doParticipante });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'sem-permissao' });
  });

  it('400 without a positive valor or an arquivo, and 404 for an arquivo of someone else', async () => {
    const api = app();
    const comprovanteId = await guardar(api);
    for (const body of [
      { valorEmCentavos: 0, comprovanteId },
      { valorEmCentavos: -100, comprovanteId },
      { valorEmCentavos: 10.5, comprovanteId },
      { comprovanteId },
      { valorEmCentavos: 3000 },
      { valorEmCentavos: 3000, comprovanteId: 'abc' },
      'nao-e-objeto',
    ]) {
      const response = await json(api, '/enviar-comprovante', doParticipante, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'pedido-invalido' });
    }
    const alheio = await json(api, '/enviar-comprovante', doOutro, {
      valorEmCentavos: 3000,
      comprovanteId,
    });
    expect(alheio.status).toBe(404);
    expect(await alheio.json()).toEqual({ error: 'comprovante-nao-encontrado' });
  });

  it('is edited and cancelled by the participante while a confirmar', async () => {
    const { api, id } = await enviado();
    const outroArquivo = await guardar(api);
    const editado = await json(api, `/comprovante-enviado/${id}/editar`, doParticipante, {
      valorEmCentavos: 2500,
      comprovanteId: outroArquivo,
    });
    expect(editado.status).toBe(204);
    expect(await ler(api, '/comprovante-enviado/eu', doParticipante)).toMatchObject([
      { valorEmCentavos: 2500, comprovanteId: outroArquivo },
    ]);
    const doOutroParticipante = await json(api, `/comprovante-enviado/${id}/cancelar`, doOutro);
    expect(doOutroParticipante.status).toBe(404);

    const cancelar = () =>
      json(api, `/comprovante-enviado/${id.toUpperCase()}/cancelar`, doParticipante);
    expect((await cancelar()).status).toBe(204);
    expect(await ler(api, '/comprovante-enviado/eu', doParticipante)).toEqual([]);
    const repetido = await cancelar();
    expect(repetido.status).toBe(404);
    expect(await repetido.json()).toEqual({ error: 'comprovante-enviado-nao-encontrado' });
  });

  it('is confirmed by the gestor once, with the valor confirmado; then nobody changes it', async () => {
    const { api, id, comprovanteId } = await enviado();
    const confirmar = (headers: object, body?: unknown) =>
      json(api, `/comprovante-enviado/${id}/confirmar`, headers, body);
    const comValor = { valorEmCentavos: 2000, comprovanteId: comprovanteId.toUpperCase() };
    expect((await confirmar(doParticipante, comValor)).status).toBe(403);
    for (const body of [
      {},
      { valorEmCentavos: 0, comprovanteId },
      { valorEmCentavos: 2000 },
      { valorEmCentavos: 2000, comprovanteId: 'abc' },
      undefined,
    ]) {
      const invalido = await confirmar(gestor, body);
      expect(invalido.status).toBe(400);
    }

    const confirmado = await confirmar(gestor, comValor);
    expect(confirmado.status).toBe(201);
    expect(await confirmado.json()).toEqual({ id: expect.any(String) });
    expect(await ler(api, '/comprovante-enviado/eu', doParticipante)).toMatchObject([
      { situacao: 'confirmado', valorEmCentavos: 3000, valorConfirmadoEmCentavos: 2000 },
    ]);
    expect(await ler(api, '/comprovante-enviado', gestor)).toEqual([]);

    for (const tentativa of [
      confirmar(gestor, comValor),
      json(api, `/comprovante-enviado/${id}/recusar`, gestor, { motivo: 'Ilegível' }),
      json(api, `/comprovante-enviado/${id}/editar`, doParticipante, {
        valorEmCentavos: 2500,
        comprovanteId,
      }),
      json(api, `/comprovante-enviado/${id}/cancelar`, doParticipante),
    ]) {
      const response = await tentativa;
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: 'comprovante-ja-analisado' });
    }
  });

  it('409 when the participante changed the arquivo after the gestor saw it', async () => {
    const { api, id, comprovanteId } = await enviado();
    const outroArquivo = await guardar(api);
    await json(api, `/comprovante-enviado/${id}/editar`, doParticipante, {
      valorEmCentavos: 3000,
      comprovanteId: outroArquivo,
    });
    const response = await json(api, `/comprovante-enviado/${id}/confirmar`, gestor, {
      valorEmCentavos: 3000,
      comprovanteId,
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'comprovante-alterado' });
    expect(await ler(api, '/comprovante-enviado', gestor)).toMatchObject([
      { id, comprovanteId: outroArquivo, situacao: 'a-confirmar' },
    ]);
  });

  it('is recusado by the gestor only with a motivo, which the participante sees', async () => {
    const { api, id } = await enviado();
    const recusar = (headers: object, body: unknown) =>
      json(api, `/comprovante-enviado/${id}/recusar`, headers, body);
    expect((await recusar(doParticipante, { motivo: 'Ilegível' })).status).toBe(403);
    for (const [body, error] of [
      [{}, 'pedido-invalido'],
      [{ motivo: 'x'.repeat(501) }, 'pedido-invalido'],
      [{ motivo: '  ' }, 'recusa-sem-motivo'],
    ] as const) {
      const response = await recusar(gestor, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error });
    }

    expect((await recusar(gestor, { motivo: 'Valor diferente do PIX' })).status).toBe(204);
    expect(await ler(api, '/comprovante-enviado/eu', doParticipante)).toMatchObject([
      { situacao: 'recusado', motivo: 'Valor diferente do PIX' },
    ]);
  });

  it('404 for an unknown comprovante and 401 without the logged-in person', async () => {
    for (const id of [outro, 'abc']) {
      const response = await json(app(), `/comprovante-enviado/${id}/confirmar`, gestor, {
        valorEmCentavos: 3000,
        comprovanteId: outro,
      });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'comprovante-enviado-nao-encontrado' });
    }
    const api = app();
    expect((await json(api, '/enviar-comprovante', {}, {})).status).toBe(401);
    expect((await json(api, `/comprovante-enviado/${outro}/cancelar`, {})).status).toBe(401);
    expect((await api.request('/comprovante-enviado')).status).toBe(401);
    expect((await api.request('/comprovante-enviado/eu')).status).toBe(401);
  });
});

describe('POST /registrar-gasto', () => {
  const registrar = (api: ReturnType<typeof app>, headers: Record<string, string>, body: unknown) =>
    enviar(
      api,
      '/registrar-gasto',
      { ...headers, 'content-type': 'application/json' },
      JSON.stringify(body),
    );
  const comNota = async (api: ReturnType<typeof app>, headers = doParticipante) => {
    const nota = await enviar(api, '/guardar-nota', headers, formulario({ arquivo: PNG }));
    return ((await nota.json()) as { id: string }).id;
  };

  it.each(['caixinha', 'proprio-bolso'])(
    '201 with the id of a gasto pago pela %s, by any participante',
    async (origem) => {
      const api = app();
      const notaId = await comNota(api);
      const response = await registrar(api, doParticipante, {
        valorEmCentavos: 4590,
        origem,
        tipo: 'outros-itens',
        notaId: notaId.toUpperCase(),
      });
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ id: expect.any(String) });
    },
  );

  it('404 for a nota that was not guardada by who registers', async () => {
    const api = app();
    const notaDoOutro = await comNota(api, doOutro);
    for (const notaId of [outro, notaDoOutro]) {
      const body = { valorEmCentavos: 4590, origem: 'caixinha', tipo: 'cafe', notaId };
      const response = await registrar(api, doParticipante, body);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'nota-nao-encontrada' });
    }
  });

  it('400 for an invalid pedido and 401 without the logged-in person', async () => {
    const valido = { valorEmCentavos: 4590, origem: 'caixinha', tipo: 'cafe', notaId: outro };
    for (const body of [
      { ...valido, valorEmCentavos: 0 },
      { ...valido, valorEmCentavos: 10.5 },
      { ...valido, origem: 'cartao' },
      { ...valido, tipo: 'bolacha' },
      { valorEmCentavos: 4590, origem: 'caixinha', notaId: outro },
      { ...valido, notaId: 'abc' },
      { valorEmCentavos: 4590, origem: 'caixinha', tipo: 'cafe' },
      'nao-e-objeto',
      { ...valido, observacao: 'x'.repeat(5000) },
    ]) {
      const response = await registrar(app(), doParticipante, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'pedido-invalido' });
    }
    expect((await registrar(app(), {}, valido)).status).toBe(401);
  });
});

describe('POST /gasto/:id/reembolsar', () => {
  const reembolsar = (api: ReturnType<typeof app>, headers: Record<string, string>, id: string) =>
    api.request(`/gasto/${id}/reembolsar`, { method: 'POST', headers });

  it('201 with the id of the reembolso, then 409 for the same gasto', async () => {
    const api = app();
    const response = await reembolsar(api, gestor, gastoDoBolso.id.toUpperCase());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: expect.any(String) });

    const repetido = await reembolsar(api, gestor, gastoDoBolso.id);
    expect(repetido.status).toBe(409);
    expect(await repetido.json()).toEqual({ error: 'gasto-ja-reembolsado' });
  });

  it('409 for a gasto pago pela caixinha', async () => {
    const response = await reembolsar(app(), gestor, gastoDaCaixinha.id);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'gasto-pago-pela-caixinha' });
  });

  it('404 for an unknown gasto', async () => {
    for (const id of [outro, 'abc']) {
      const response = await reembolsar(app(), gestor, id);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'gasto-nao-encontrado' });
    }
  });

  it('403 when not the gestor and 401 without the logged-in person', async () => {
    expect((await reembolsar(app(), doParticipante, gastoDoBolso.id)).status).toBe(403);
    expect((await reembolsar(app(), {}, gastoDoBolso.id)).status).toBe(401);
  });
});

describe('GET /gasto', () => {
  it('gives the gestor the gastos, with whether each was reembolsado', async () => {
    const gastos = [{ ...gastoDoBolso, reembolsado: false }];
    const response = await app({ listarGastos: listarGastos(async () => gastos) }).request(
      '/gasto',
      { headers: gestor },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { ...gastoDoBolso, feitoEm: gastoDoBolso.feitoEm.toISOString(), reembolsado: false },
    ]);
  });

  it('403 when not the gestor and 401 without the logged-in person', async () => {
    const response = await app().request('/gasto', { headers: doParticipante });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'sem-permissao' });
    expect((await app().request('/gasto')).status).toBe(401);
  });
});

describe('POST /solicitar-complemento', () => {
  const solicitar = (headers: Record<string, string>, corpo: unknown) =>
    app().request('/solicitar-complemento', {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    });

  it('201 with the id of the complemento', async () => {
    const response = await solicitar(gestor, { valorEmCentavos: 1001 });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: expect.any(String) });
  });

  it('409 when the parte would be less than one centavo', async () => {
    const response = await solicitar(gestor, { valorEmCentavos: 1 });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'parte-menor-que-um-centavo' });
  });

  it('400 for an invalid pedido', async () => {
    for (const corpo of [{}, { valorEmCentavos: 0 }, { valorEmCentavos: 10.5 }, 'x']) {
      const response = await solicitar(gestor, corpo);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'pedido-invalido' });
    }
  });

  it('403 when not the gestor and 401 without the logged-in person', async () => {
    expect((await solicitar(doParticipante, { valorEmCentavos: 1001 })).status).toBe(403);
    expect((await solicitar({}, { valorEmCentavos: 1001 })).status).toBe(401);
  });
});

describe('GET /caixinha', () => {
  it('gives any participante the saldo and the gastos do ano anterior', async () => {
    const response = await app().request('/caixinha', { headers: doParticipante });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      saldoEmCentavos: -1500,
      gastosDoAnoAnteriorEmCentavos: 90000,
      gastosDoAnoAnteriorPorTipoEmCentavos: { cafe: 60000 },
    });
    expect((await app().request('/caixinha')).status).toBe(401);
  });
});

describe('GET /caixinha/:mes', () => {
  it('gives any participante the caixinha of the month', async () => {
    const response = await app().request('/caixinha/2026-10', { headers: doParticipante });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mes: '2026-10', saldoNoFimEmCentavos: 1200 });
  });

  it('404 for a month not in AAAA-MM and 401 without the logged-in person', async () => {
    for (const mes of ['2026-13', '2026-1', 'outubro']) {
      const response = await app().request(`/caixinha/${mes}`, { headers: doParticipante });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not-found' });
    }
    expect((await app().request('/caixinha/2026-10')).status).toBe(401);
  });
});

describe('Crédito e pendentes', () => {
  const situacao = {
    id: participante,
    ativo: true,
    creditoEmCentavos: 6000,
    pendenteEmCentavos: 0,
  };

  it('GET /participante gives the gestor every participante', async () => {
    const response = await app().request('/participante', { headers: gestor });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([situacao]);
  });

  it('GET /participante is 403 for a participante', async () => {
    const response = await app().request('/participante', { headers: doParticipante });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'sem-permissao' });
  });

  it('GET /participante/eu gives the participante only their own situação, cotas and complementos', async () => {
    const response = await app().request('/participante/eu', { headers: doParticipante });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...situacao,
      cotas: devido.cotas,
      complementos: [
        { id: outro, solicitadoEm: '2026-11-20T15:00:00.000Z', parteEmCentavos: 1001 },
      ],
    });
    const desconhecido = await app().request('/participante/eu', { headers: doOutro });
    expect(desconhecido.status).toBe(404);
    expect(await desconhecido.json()).toEqual({ error: 'participante-nao-encontrado' });
  });

  it('401 without the logged-in person', async () => {
    expect((await app().request('/participante')).status).toBe(401);
    expect((await app().request('/participante/eu')).status).toBe(401);
  });

  it('GET /pendente is internal: gives Notificação the pendentes, without identity', async () => {
    const pendentes = [{ id: participante, pendenteEmCentavos: 3000, cota: devido.cotas[0] }];
    const response = await app({ listarPendentes: async () => pendentes }).request('/pendente');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(pendentes);
  });

  it('GET /pendente is 404 with the identity the gateway always sends', async () => {
    const response = await app().request('/pendente', { headers: gestor });
    expect(response.status).toBe(404);
  });
});
