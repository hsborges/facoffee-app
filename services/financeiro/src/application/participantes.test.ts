import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Event } from '../domain/event.js';
import type { Participante } from '../domain/participante.js';
import {
  type Repository,
  registrarCotaDevida,
  registrarEntrada,
  registrarSaida,
} from './participantes.js';

// The examples of the contracts, so the handlers accept what Participação publishes.
const exemplo = (contrato: string): Event =>
  JSON.parse(
    readFileSync(new URL(`../../../../contracts/events/${contrato}`, import.meta.url), 'utf8'),
  ).examples[0];
const entrou = exemplo('participation.participant-joined.v1.json');
const saiu = exemplo('participation.participant-left.v1.json');
const cotaDevida = exemplo('participation.contribution-due.v1.json');
const p1 = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const comPayload = (event: Event, payload: Record<string, unknown>): Event => ({
  ...event,
  payload: { ...(event.payload as object), ...payload },
});

const inMemory = () => {
  const participantes = new Map<string, Participante>();
  const repository: Repository = {
    buscar: async (id) => participantes.get(id),
    salvar: async (participante) => {
      participantes.set(participante.id, participante);
    },
    ativos: async () => [...participantes.values()].filter((p) => p.ativo).map((p) => p.id),
  };
  return {
    participantes,
    ativos: repository.ativos,
    entrada: registrarEntrada(repository),
    saida: registrarSaida(repository),
    cota: registrarCotaDevida(repository),
  };
};

describe('Participante entrou and Participante saiu', () => {
  it('make the participante ativo until they leave, also when repeated', async () => {
    const { ativos, entrada, saida } = inMemory();

    expect(await entrada(entrou)).toEqual({ ok: true, value: undefined });
    await entrada(entrou);
    expect(await ativos()).toEqual([p1]);

    expect(await saida(saiu)).toEqual({ ok: true, value: undefined });
    await saida(saiu);
    expect(await ativos()).toEqual([]);

    await entrada(entrou);
    expect(await ativos()).toEqual([p1]);
  });

  it('refuse a payload without a uuid participantId', async () => {
    const { participantes, entrada, saida } = inMemory();
    for (const participantId of [undefined, 'p-1']) {
      const erro = { ok: false, error: 'payload-invalido' };
      expect(await entrada(comPayload(entrou, { participantId }))).toEqual(erro);
      expect(await saida(comPayload(saiu, { participantId }))).toEqual(erro);
    }
    expect(participantes.size).toBe(0);
  });
});

describe('Cota devida', () => {
  it('records the cota once per month, in the ubiquitous language', async () => {
    const { participantes, entrada, cota } = inMemory();
    await entrada(entrou);

    expect(await cota(cotaDevida)).toEqual({ ok: true, value: undefined });
    await cota(cotaDevida);
    await cota(comPayload(cotaDevida, { amountInCents: 9999 }));
    await cota(comPayload(cotaDevida, { month: '2026-12', contributionType: 'coffee-only' }));

    expect(participantes.get(p1)).toEqual({
      id: p1,
      ativo: true,
      cotas: [
        { mes: '2026-11', tipoDeCota: 'completa', valorEmCentavos: 3000 },
        { mes: '2026-12', tipoDeCota: 'so-cafe', valorEmCentavos: 3000 },
      ],
    });
  });

  it.each([
    ['participantId', 'p-1'],
    ['month', '2026-13'],
    ['contributionType', 'constructor'],
    ['amountInCents', 0],
    ['amountInCents', 2_147_483_648],
  ])('refuses a payload with an invalid %s', async (campo, valor) => {
    const { participantes, cota } = inMemory();
    expect(await cota(comPayload(cotaDevida, { [campo]: valor }))).toEqual({
      ok: false,
      error: 'payload-invalido',
    });
    expect(participantes.size).toBe(0);
  });
});
