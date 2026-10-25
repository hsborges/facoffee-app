import { describe, expect, it } from 'vitest';
import type { Event } from '../domain/event.js';
import type { Participante } from '../domain/participante.js';
import { pedirEntrada, type Repository } from './participantes.js';

const now = new Date('2026-11-01T03:00:00Z');

const inMemory = () => {
  const participantes = new Map<string, Participante>();
  const events: Event[] = [];
  const repository: Repository = {
    buscar: async (id) => participantes.get(id),
    salvarEntrada: async (participante, newEvents) => {
      if (participantes.get(participante.id)?.participando) return false;
      participantes.set(participante.id, participante);
      events.push(...newEvents);
      return true;
    },
  };
  let n = 0;
  const clock = { now: () => now, newId: () => `id-${++n}` };
  return { participantes, events, pedirEntrada: pedirEntrada(repository, clock) };
};

describe('pedirEntrada', () => {
  it('saves the participante together with Participante entrou', async () => {
    const { participantes, events, pedirEntrada } = inMemory();

    expect(await pedirEntrada('p-1', 'completa')).toEqual({ ok: true, value: undefined });
    expect(participantes.get('p-1')).toEqual({
      id: 'p-1',
      tipoDeCota: 'completa',
      participando: true,
    });
    expect(events).toMatchObject([
      { id: 'id-1', type: 'participation.participant-joined', payload: { participantId: 'p-1' } },
    ]);
  });

  it('publishes again when the participante returns', async () => {
    const { participantes, events, pedirEntrada } = inMemory();
    participantes.set('p-1', { id: 'p-1', tipoDeCota: 'completa', participando: false });

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
    const entrada = pedirEntrada(
      { buscar: async () => undefined, salvarEntrada: async () => false },
      { now: () => now, newId: () => 'id-1' },
    );

    expect(await entrada('p-1', 'completa')).toEqual({ ok: false, error: 'ja-participando' });
  });
});
