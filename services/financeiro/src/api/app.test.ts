import { describe, expect, it } from 'vitest';
import {
  type Armazem,
  type Arquivo,
  baixarComprovante,
  baixarNota,
  comprovanteDoParticipante,
  guardarComprovante,
  guardarNota,
  notaGuardada,
} from '../application/arquivos.js';
import { consultarCreditoEPendente, listarCreditoEPendentes } from '../application/credito.js';
import { registrarGasto } from '../application/gastos.js';
import { receberPagamento } from '../application/pagamentos.js';
import { TAMANHO_MAXIMO } from '../domain/arquivo.js';
import { ok } from '../domain/result.js';
import { createLogger } from '../infra/logger.js';
import { type ApiDependencies, createApp } from './app.js';

const participante = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const outro = '11111111-1111-4111-8111-111111111111';
const gestor = { 'x-user-id': '22222222-2222-4222-8222-222222222222', 'x-user-roles': 'gestor' };
const doParticipante = { 'x-user-id': participante, 'x-user-roles': 'participante' };
const doOutro = { 'x-user-id': outro, 'x-user-roles': 'participante' };

const totais = [{ id: participante, ativo: true, devidoEmCentavos: 3000, pagoEmCentavos: 9000 }];
const buscarTotais = async (id?: string) => totais.filter((t) => id === undefined || t.id === id);

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
    registrarGasto: registrarGasto({ salvar: async () => ok(undefined) }, notaGuardada(armazem), {
      now: () => new Date(),
      newId,
    }),
    listarCreditoEPendentes: listarCreditoEPendentes(buscarTotais),
    consultarCreditoEPendente: consultarCreditoEPendente(buscarTotais),
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

  it('403 when not the gestor', async () => {
    const form = formulario({ arquivo: PNG, participanteId: participante });
    const response = await enviar(app(), '/guardar-comprovante', doParticipante, form);
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

describe('POST /registrar-gasto', () => {
  const registrar = (api: ReturnType<typeof app>, headers: Record<string, string>, body: unknown) =>
    enviar(
      api,
      '/registrar-gasto',
      { ...headers, 'content-type': 'application/json' },
      JSON.stringify(body),
    );
  const comNota = async (api: ReturnType<typeof app>) => {
    const nota = await enviar(api, '/guardar-nota', doParticipante, formulario({ arquivo: PNG }));
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
        notaId: notaId.toUpperCase(),
      });
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ id: expect.any(String) });
    },
  );

  it('404 for a nota that was not guardada', async () => {
    const body = { valorEmCentavos: 4590, origem: 'caixinha', notaId: outro };
    const response = await registrar(app(), doParticipante, body);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'nota-nao-encontrada' });
  });

  it('400 for an invalid pedido and 401 without the logged-in person', async () => {
    const valido = { valorEmCentavos: 4590, origem: 'caixinha', notaId: outro };
    for (const body of [
      { ...valido, valorEmCentavos: 0 },
      { ...valido, valorEmCentavos: 10.5 },
      { ...valido, origem: 'cartao' },
      { ...valido, notaId: 'abc' },
      { valorEmCentavos: 4590, origem: 'caixinha' },
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

  it('GET /participante/eu gives the participante only their own situação', async () => {
    const response = await app().request('/participante/eu', { headers: doParticipante });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(situacao);
    const desconhecido = await app().request('/participante/eu', { headers: doOutro });
    expect(desconhecido.status).toBe(404);
    expect(await desconhecido.json()).toEqual({ error: 'participante-nao-encontrado' });
  });

  it('401 without the logged-in person', async () => {
    expect((await app().request('/participante')).status).toBe(401);
    expect((await app().request('/participante/eu')).status).toBe(401);
  });
});
