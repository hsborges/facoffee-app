import { describe, expect, it } from 'vitest';
import type { Event } from '../domain/event.js';
import { desativarAcesso, type Repository } from './usuarios.js';

const now = new Date('2026-11-01T03:00:00Z');
const gestor = { id: 'gestor-1', perfis: ['gestor'] as const };

const inMemory = () => {
  const desativados = new Map<string, Date>();
  const events: Event[] = [];
  const repository: Repository = {
    estaDesativado: async (id) => desativados.has(id),
    salvar: async (desativacao, newEvents) => {
      desativados.set(desativacao.id, desativacao.desativadoEm);
      events.push(...newEvents);
    },
  };
  let n = 0;
  const clock = { now: () => now, newId: () => `id-${++n}` };
  return { desativados, events, desativar: desativarAcesso(repository, clock) };
};

describe('desativarAcesso', () => {
  it('saves the desativação together with Usuário desativado', async () => {
    const { desativados, events, desativar } = inMemory();

    expect(await desativar(gestor, 'user-1')).toEqual({ ok: true, value: undefined });
    expect(desativados.get('user-1')).toEqual(now);
    expect(events).toMatchObject([
      { type: 'user.user-deactivated', payload: { userId: 'user-1' } },
    ]);
  });

  it('does not publish again for an usuário already desativado', async () => {
    const { events, desativar } = inMemory();

    await desativar(gestor, 'user-1');
    expect(await desativar(gestor, 'user-1')).toEqual({ ok: true, value: undefined });
    expect(events).toHaveLength(1);
  });

  it('saves nothing when the domain rejects the command', async () => {
    const { desativados, desativar } = inMemory();

    expect(await desativar({ id: 'user-2', perfis: ['participante'] }, 'user-1')).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
    expect(desativados.size).toBe(0);
  });
});
