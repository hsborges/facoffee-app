import { readdirSync, readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

// biome-ignore lint/suspicious/noExplicitAny: JSON lido dos arquivos; a forma é o que os testes conferem
type Json = Record<string, any>;

const pasta = new URL('../events/', import.meta.url);
const ler = (arquivo: string | URL): string => readFileSync(new URL(arquivo, pasta), 'utf8');
const lerJson = (arquivo: string): Json => JSON.parse(ler(arquivo));

const envelope = lerJson('envelope.v1.json');
const eventos = readdirSync(pasta)
  .filter((arquivo) => /\.v\d+\.json$/.test(arquivo) && arquivo !== 'envelope.v1.json')
  .map((arquivo) => ({ arquivo, schema: lerJson(arquivo) }));

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);
ajv.addSchema([envelope, ...eventos.map((e) => e.schema)]);
const validador = (schema: Json) => {
  const validar = ajv.getSchema(schema.$id);
  if (!validar) throw new Error(`schema não registrado: ${schema.$id}`);
  return validar;
};

// Lê as linhas de dados de uma tabela Markdown que começam por `inicio`.
const linhasDaTabela = (texto: string, inicio: string): string[][] =>
  texto
    .split('\n')
    .filter((linha) => linha.startsWith(inicio))
    .map((linha) =>
      linha
        .split('|')
        .slice(1, -1)
        .map((celula) => celula.trim().replaceAll('*', '').replaceAll('`', '')),
    );
const lista = (celula: string): string[] => (celula === '—' ? [] : celula.split(', ').sort());

const modeloDeDominio = ler('../../docs/MODELOS_DOMINIO.md')
  .split('### Eventos entre contextos')[1]
  ?.split('\n### ')[0];
if (!modeloDeDominio) throw new Error('seção "Eventos entre contextos" não encontrada');
const tabelaDoModelo = Object.fromEntries(
  linhasDaTabela(modeloDeDominio, '| **').map(([contexto = '', publica = '', consome = '']) => [
    contexto,
    { publica: lista(publica), consome: lista(consome) },
  ]),
);
const eventosPublicados = Object.values(tabelaDoModelo).flatMap((c) => c.publica);

const asyncapi = lerJson('asyncapi.json');
const resolver = (ref: string): Json =>
  ref
    .slice(2)
    .split('/')
    .reduce((no, chave) => no[chave.replaceAll('~1', '/').replaceAll('~0', '~')], asyncapi);
const mensagensDoCanal = (operacao: Json): Json[] =>
  Object.values(resolver(operacao.channel.$ref).messages as Json).map((m) => resolver(m.$ref));
const operacoes = Object.values(asyncapi.operations as Json).map((operacao) => ({
  acao: operacao.action as 'send' | 'receive',
  contexto: operacao.tags[0].name as string,
  canal: resolver(operacao.channel.$ref),
  mensagens: mensagensDoCanal(operacao),
}));

describe('schemas dos eventos', () => {
  it('há um schema por evento publicado no modelo de domínio', () => {
    expect(eventos.map((e) => e.schema.title).sort()).toEqual([...eventosPublicados].sort());
  });

  describe.each(eventos)('$arquivo', ({ arquivo, schema }) => {
    const validar = validador(schema);
    const [exemplo] = schema.examples as Json[];

    it('tem o nome do arquivo igual a <tipo>.v<versao>.json', () => {
      expect(exemplo).toBeDefined();
      expect(arquivo).toBe(`${exemplo?.tipo}.v${exemplo?.versao}.json`);
    });

    it.each(schema.examples as Json[])('aceita o exemplo %#', (evento) => {
      expect(validar(evento), JSON.stringify(validar.errors)).toBe(true);
    });

    it('rejeita payload sem os campos obrigatórios', () => {
      expect(validar({ ...exemplo, payload: {} })).toBe(false);
    });

    it('rejeita outro tipo ou outra versão', () => {
      expect(validar({ ...exemplo, tipo: 'outro.evento' })).toBe(false);
      expect(validar({ ...exemplo, versao: (exemplo?.versao ?? 0) + 1 })).toBe(false);
    });

    it('aceita campos desconhecidos no payload (leitor tolerante)', () => {
      expect(validar({ ...exemplo, payload: { ...exemplo?.payload, campoNovo: 1 } })).toBe(true);
    });
  });
});

describe('envelope', () => {
  const validar = validador(envelope);
  const evento = {
    id: '0b6f2f0e-6a1c-4c55-9a43-6f1f1b0c9e10',
    tipo: 'participacao.participante-entrou',
    versao: 1,
    ocorridoEm: '2026-11-01T03:00:00Z',
    payload: {},
  };

  it('aceita um evento completo', () => {
    expect(validar(evento)).toBe(true);
  });

  it.each(['id', 'tipo', 'versao', 'ocorridoEm', 'payload'])('exige %s', (campo) => {
    const { [campo as keyof typeof evento]: _, ...semCampo } = evento;
    expect(validar(semCampo)).toBe(false);
  });

  it('rejeita id que não é UUID e data sem fuso', () => {
    expect(validar({ ...evento, id: '42' })).toBe(false);
    expect(validar({ ...evento, ocorridoEm: '2026-11-01T03:00:00' })).toBe(false);
  });
});

describe('asyncapi.json', () => {
  it('tem publicadores e consumidores iguais aos do modelo de domínio', () => {
    const contextos = Object.fromEntries(
      Object.keys(tabelaDoModelo).map((c) => [
        c,
        { publica: [] as string[], consome: [] as string[] },
      ]),
    );
    for (const { acao, contexto, mensagens } of operacoes) {
      const entrada = contextos[contexto];
      if (!entrada) throw new Error(`contexto desconhecido: ${contexto}`);
      entrada[acao === 'send' ? 'publica' : 'consome'].push(...mensagens.map((m) => m.title));
    }
    for (const c of Object.values(contextos)) {
      c.publica.sort();
      c.consome.sort();
    }
    expect(contextos).toEqual(tabelaDoModelo);
  });

  it('publica cada evento no exchange de eventos com a routing key igual ao nome do schema', () => {
    const publicacoes = operacoes.filter((o) => o.acao === 'send');
    expect(publicacoes.map((o) => `${o.canal.address}.json`).sort()).toEqual(
      eventos.map((e) => e.arquivo).sort(),
    );
    for (const { canal, mensagens } of publicacoes) {
      expect(canal.bindings.amqp).toMatchObject({
        is: 'routingKey',
        exchange: { name: 'facoffee.eventos', type: 'topic', durable: true },
      });
      expect(mensagens.map((m) => m.payload.$ref)).toEqual([`./${canal.address}.json`]);
      expect(mensagens[0]?.title).toBe(lerJson(`${canal.address}.json`).title);
    }
  });

  it('tem uma fila durável por consumidor', () => {
    const consumos = operacoes.filter((o) => o.acao === 'receive');
    expect(consumos.map((o) => o.canal.address)).toEqual(
      consumos.map(
        (o) => `${o.contexto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()}.eventos`,
      ),
    );
    expect(new Set(consumos.map((o) => o.contexto)).size).toBe(consumos.length);
    for (const { canal } of consumos) {
      expect(canal.bindings.amqp).toMatchObject({
        is: 'queue',
        queue: { name: canal.address, durable: true, exclusive: false, autoDelete: false },
      });
    }
  });
});

describe('README', () => {
  it('tem a tabela de eventos igual ao asyncapi.json', () => {
    const tabela = linhasDaTabela(ler('README.md'), '| ').filter(([evento]) => evento !== 'Evento');
    const esperado = operacoes
      .filter((o) => o.acao === 'send')
      .map(({ canal, contexto, mensagens }) => [
        mensagens[0]?.title,
        canal.address,
        contexto,
        operacoes
          .filter(
            (c) => c.acao === 'receive' && c.mensagens.some((m) => m.title === mensagens[0]?.title),
          )
          .map((c) => c.canal.address)
          .sort()
          .join(', '),
      ]);
    expect(tabela).toEqual(esperado);
  });
});
