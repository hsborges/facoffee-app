import { describe, expect, it } from 'vitest';
import type { Event } from '../domain/event.js';
import type { Participante } from '../domain/participante.js';
import {
  type Clock,
  consultarParticipante,
  encerrarAoDesativarAcesso,
  pedirEntrada,
  pedirSaida,
  type Repository,
  trocarTipo,
} from './participantes.js';

const now = new Date('2026-11-10T15:00:00Z');
const p1 = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';

const inMemory = () => {
  const participantes = new Map<string, Participante>();
  const events: Event[] = [];
  const participando = (id: string) => participantes.get(id)?.participando ?? false;
  const repository: Repository = {
    buscar: async (id) => participantes.get(id),
    salvarEntrada: async (participante, newEvents) => {
      if (participando(participante.id)) return false;
      participantes.set(participante.id, participante);
      events.push(...newEvents);
      return true;
    },
    salvarTroca: async (participante) => {
      if (!participando(participante.id)) return false;
      participantes.set(participante.id, participante);
      return true;
    },
    salvarSaida: async (participante, newEvents) => {
      if (!participando(participante.id)) return false;
      participantes.set(participante.id, participante);
      events.push(...newEvents);
      return true;
    },
  };
  let n = 0;
  const clock: Clock = { now: () => now, newId: () => `id-${++n}` };
  return {
    participantes,
    events,
    pedirEntrada: pedirEntrada(repository, clock),
    trocarTipo: trocarTipo(repository, clock),
    pedirSaida: pedirSaida(repository, clock),
    consultar: consultarParticipante(repository, clock),
    encerrar: encerrarAoDesativarAcesso(repository, clock),
  };
};

const usuarioDesativado = (userId: unknown): Event => ({
  id: 'e-1',
  type: 'user.user-deactivated',
  version: 1,
  occurredAt: now.toISOString(),
  payload: { userId },
});

describe('pedirEntrada', () => {
  it('saves the participante together with Participante entrou', async () => {
    const { participantes, events, pedirEntrada } = inMemory();

    expect(await pedirEntrada('p-1', 'completa')).toEqual({ ok: true, value: undefined });
    expect(participantes.get('p-1')).toEqual({
      id: 'p-1',
      tipoDeCota: 'completa',
      participando: true,
      troca: null,
    });
    expect(events).toMatchObject([
      { id: 'id-1', type: 'participation.participant-joined', payload: { participantId: 'p-1' } },
    ]);
  });

  it('publishes again when the participante returns', async () => {
    const { participantes, events, pedirEntrada } = inMemory();
    participantes.set('p-1', {
      id: 'p-1',
      tipoDeCota: 'completa',
      participando: false,
      troca: null,
    });

    expect(await pedirEntrada('p-1', 'so-cafe')).toEqual({ ok: true, value: undefined });
    expect(participantes.get('p-1')).toMatchObject({ tipoDeCota: 'so-cafe', participando: true });
    expect(events).toHaveLength(1);
  });

  it('refuses and publishes nothing when already participando', async () => {
    const { participantes, events, pedirEntrada } = inMemory();

    await pedirEntrada('p-1', 'completa');
    expect(await pedirEntrada('p-1', 'so-cafe')).toEqual({ ok: false, error: 'ja-participando' });
    expect(participantes.get('p-1')).toMatchObject({ tipoDeCota: 'completa' });
    expect(events).toHaveLength(1);
  });

  it('refuses when a concurrent entrada was saved first', async () => {
    const repository = {
      buscar: async () => undefined,
      salvarEntrada: async () => false,
    } as unknown as Repository;

    expect(
      await pedirEntrada(repository, { now: () => now, newId: () => 'id-1' })('p-1', 'completa'),
    ).toEqual({ ok: false, error: 'ja-participando' });
  });
});

describe('trocarTipo', () => {
  it('saves the troca for the next month and publishes nothing', async () => {
    const { participantes, events, pedirEntrada, trocarTipo } = inMemory();
    await pedirEntrada('p-1', 'so-cafe');

    expect(await trocarTipo('p-1', 'completa')).toEqual({ ok: true, value: undefined });
    expect(participantes.get('p-1')).toMatchObject({
      tipoDeCota: 'so-cafe',
      troca: { tipoDeCota: 'completa', aPartirDe: '2026-12' },
    });
    expect(events).toHaveLength(1);
  });

  it('refuses whoever is not participando', async () => {
    const { trocarTipo } = inMemory();
    expect(await trocarTipo('p-1', 'completa')).toEqual({ ok: false, error: 'nao-participando' });
  });
});

describe('pedirSaida', () => {
  it('saves the saída together with Participante saiu', async () => {
    const { participantes, events, pedirEntrada, pedirSaida } = inMemory();
    await pedirEntrada('p-1', 'so-cafe');

    expect(await pedirSaida('p-1')).toEqual({ ok: true, value: undefined });
    expect(participantes.get('p-1')).toMatchObject({ participando: false });
    expect(events.map((e) => e.type)).toEqual([
      'participation.participant-joined',
      'participation.participant-left',
    ]);
  });

  it('refuses and publishes nothing when not participando', async () => {
    const { events, pedirSaida } = inMemory();
    expect(await pedirSaida('p-1')).toEqual({ ok: false, error: 'nao-participando' });
    expect(events).toEqual([]);
  });
});

describe('consultarParticipante', () => {
  it('gives the participante with the tipo de cota of now and the troca still waiting', async () => {
    const { participantes, consultar } = inMemory();
    participantes.set('p-1', {
      id: 'p-1',
      tipoDeCota: 'so-cafe',
      participando: true,
      troca: { tipoDeCota: 'completa', aPartirDe: '2026-11' },
    });
    participantes.set('p-2', {
      id: 'p-2',
      tipoDeCota: 'so-cafe',
      participando: false,
      troca: { tipoDeCota: 'completa', aPartirDe: '2026-12' },
    });

    expect(await consultar('p-1')).toEqual({
      ok: true,
      value: { id: 'p-1', tipoDeCota: 'completa', participando: true, troca: null },
    });
    expect(await consultar('p-2')).toEqual({
      ok: true,
      value: { id: 'p-2', tipoDeCota: 'so-cafe', participando: false, troca: null },
    });
  });

  it('does not find someone who never participated', async () => {
    const { consultar } = inMemory();
    expect(await consultar('p-1')).toEqual({ ok: false, error: 'participante-nao-encontrado' });
  });
});

describe('encerrarAoDesativarAcesso', () => {
  it('turns Usuário desativado into Participante saiu', async () => {
    const { participantes, events, pedirEntrada, encerrar } = inMemory();
    await pedirEntrada(p1, 'completa');

    expect(await encerrar(usuarioDesativado(p1))).toEqual({ ok: true, value: undefined });
    expect(participantes.get(p1)).toMatchObject({ participando: false });
    expect(events.at(-1)).toMatchObject({
      type: 'participation.participant-left',
      payload: { participantId: p1 },
    });
  });

  it('publishes Participante saiu only once after a saída already asked for', async () => {
    const { events, pedirEntrada, pedirSaida, encerrar } = inMemory();
    await pedirEntrada(p1, 'completa');
    await pedirSaida(p1);

    expect(await encerrar(usuarioDesativado(p1))).toEqual({ ok: true, value: undefined });
    expect(events.filter((e) => e.type === 'participation.participant-left')).toHaveLength(1);
  });

  it('ignores a person who never participated', async () => {
    const { events, encerrar } = inMemory();
    expect(await encerrar(usuarioDesativado(p1))).toEqual({ ok: true, value: undefined });
    expect(events).toEqual([]);
  });

  it('refuses a payload without a uuid userId', async () => {
    const { encerrar } = inMemory();
    for (const userId of [undefined, 'user-1']) {
      expect(await encerrar(usuarioDesativado(userId))).toEqual({
        ok: false,
        error: 'payload-invalido',
      });
    }
  });
});
