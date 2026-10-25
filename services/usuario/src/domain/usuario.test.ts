import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { desativar, perfisDos, somenteGestor } from './usuario.js';

describe('perfisDos', () => {
  it('keeps only the FACOFFEE perfis', () => {
    expect(
      perfisDos(['default-roles-facoffee', 'participante', 'offline_access', 'gestor']),
    ).toEqual(['gestor', 'participante']);
  });

  it('no perfil when the usuário has none of them', () => {
    expect(perfisDos([''])).toEqual([]);
  });
});

describe('somenteGestor', () => {
  it('accepts the gestor and refuses everyone else', () => {
    expect(somenteGestor({ perfis: ['gestor', 'participante'] })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(somenteGestor({ perfis: ['participante'] })).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
  });
});

describe('desativar', () => {
  const agora = new Date('2026-11-01T03:00:00Z');
  const contexto = { eventId: '0b6f2f0e-6a1c-4c55-9a43-6f1f1b0c9e10', agora };
  const participante = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
  const gestor = '11111111-1111-4111-8111-111111111111';

  it('the gestor deactivates another usuário and Usuário desativado is published', () => {
    expect(desativar({ id: gestor, perfis: ['gestor'] }, participante, contexto)).toEqual({
      ok: true,
      value: {
        desativacao: { id: participante, desativadoEm: agora },
        evento: {
          id: contexto.eventId,
          type: 'user.user-deactivated',
          version: 1,
          occurredAt: '2026-11-01T03:00:00.000Z',
          payload: { userId: participante },
        },
      },
    });
  });

  it('the participante deactivates their own access', () => {
    const solicitante = { id: participante, perfis: ['participante'] as const };
    expect(desativar(solicitante, participante, contexto).ok).toBe(true);
  });

  it('only the gestor deactivates someone else', () => {
    const solicitante = { id: gestor, perfis: ['participante'] as const };
    expect(desativar(solicitante, participante, contexto)).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
  });

  it('Usuário desativado follows the contract', () => {
    const ler = (arquivo: string) =>
      JSON.parse(
        readFileSync(new URL(`../../../../contracts/events/${arquivo}`, import.meta.url), 'utf8'),
      );
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);
    ajv.addSchema(ler('envelope.v1.json'));
    const validar = ajv.compile(ler('user.user-deactivated.v1.json'));
    const resultado = desativar({ id: gestor, perfis: ['gestor'] }, participante, contexto);
    if (!resultado.ok) throw new Error(resultado.error);

    expect(validar(resultado.value.evento), ajv.errorsText(validar.errors)).toBe(true);
  });
});
