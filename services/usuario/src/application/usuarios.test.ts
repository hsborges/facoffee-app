import { describe, expect, it } from 'vitest';
import type { Event } from '../domain/event.js';
import type { Perfil, UsuarioRegistrado } from '../domain/usuario.js';
import {
  desativarAcesso,
  listarUsuarios,
  type Repository,
  reativarAcesso,
  registrarAcesso,
} from './usuarios.js';

const now = new Date('2026-11-01T03:00:00Z');
const gestor = { id: 'gestor-1', perfis: ['gestor'] as const };
const participante = { id: 'user-2', perfis: ['participante'] as const };

const inMemory = () => {
  const usuarios = new Map<string, Omit<UsuarioRegistrado, 'desativado'>>();
  const perfis = new Map<string, readonly Perfil[]>();
  const desativados = new Map<string, Date>();
  const events: Event[] = [];
  const repository: Repository = {
    estaDesativado: async (id) => desativados.has(id),
    salvar: async (desativacao, newEvents) => {
      desativados.set(desativacao.id, desativacao.desativadoEm);
      events.push(...newEvents);
    },
    registrar: async ({ perfis: doUsuario, ...usuario }) => {
      usuarios.set(usuario.id, usuario);
      perfis.set(usuario.id, doUsuario);
    },
    listar: async () =>
      [...usuarios.values()].map((u) => ({ ...u, desativado: desativados.has(u.id) })),
    buscar: async (id) => usuarios.get(id),
    reativar: async (id) => {
      desativados.delete(id);
    },
  };
  let n = 0;
  const clock = { now: () => now, newId: () => `id-${++n}` };
  return {
    desativados,
    events,
    perfis,
    desativar: desativarAcesso(repository, clock),
    registrar: registrarAcesso(repository),
    listar: listarUsuarios(repository),
    reativar: reativarAcesso(repository),
  };
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

    expect(await desativar(participante, 'user-1')).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
    expect(desativados.size).toBe(0);
  });
});

describe('registrarAcesso and listarUsuarios', () => {
  const joao = { id: 'user-1', nome: 'João', email: 'joao@ufms.br' };
  const comPerfis = { ...joao, perfis: ['participante'] as const };

  it('registers the usuário on the first access and lists them to the gestor', async () => {
    const { registrar, listar } = inMemory();

    expect(await registrar(comPerfis)).toBe('ativo');
    expect(await listar(gestor)).toEqual({ ok: true, value: [{ ...joao, desativado: false }] });
  });

  it('updates nome and email on the next access', async () => {
    const { registrar, listar } = inMemory();

    await registrar(comPerfis);
    await registrar({ ...comPerfis, nome: 'João Café', email: 'joao.cafe@ufms.br' });
    expect(await listar(gestor)).toEqual({
      ok: true,
      value: [{ id: 'user-1', nome: 'João Café', email: 'joao.cafe@ufms.br', desativado: false }],
    });
  });

  it('keeps the perfis of the latest access', async () => {
    const { registrar, perfis } = inMemory();

    await registrar(comPerfis);
    await registrar({ ...comPerfis, perfis: ['gestor', 'participante'] });
    expect(perfis.get(joao.id)).toEqual(['gestor', 'participante']);
  });

  it('tells a desativado access apart and shows it in the listing', async () => {
    const { registrar, listar, desativar } = inMemory();

    await desativar(gestor, joao.id);
    expect(await registrar(comPerfis)).toBe('desativado');
    expect(await listar(gestor)).toEqual({ ok: true, value: [{ ...joao, desativado: true }] });
  });

  it('only the gestor lists the usuários', async () => {
    expect(await inMemory().listar(participante)).toEqual({ ok: false, error: 'sem-permissao' });
  });
});

describe('reativarAcesso', () => {
  it('the gestor reactivates a desativado access', async () => {
    const { desativados, desativar, reativar } = inMemory();

    await desativar(gestor, 'user-1');
    expect(await reativar(gestor, 'user-1')).toEqual({ ok: true, value: undefined });
    expect(desativados.size).toBe(0);
  });

  it('only the gestor reactivates, even their own access', async () => {
    const { desativados, desativar, reativar } = inMemory();

    await desativar(participante, participante.id);
    expect(await reativar(participante, participante.id)).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
    expect(desativados.size).toBe(1);
  });
});
