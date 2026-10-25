import { describe, expect, it } from 'vitest';
import { perfisDos } from './usuario.js';

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
