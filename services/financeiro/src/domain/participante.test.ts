import { describe, expect, it } from 'vitest';
import { type Cota, deverCota, entrar, sair } from './participante.js';

const novembro: Cota = { mes: '2026-11', tipoDeCota: 'completa', valorEmCentavos: 3000 };

describe('entrar and sair', () => {
  it('make a new person ativo, then not ativo, keeping the cotas', () => {
    const entrou = deverCota(entrar(undefined, 'p-1'), 'p-1', novembro);
    expect(entrou).toEqual({ id: 'p-1', ativo: true, cotas: [novembro] });
    expect(sair(entrou, 'p-1')).toEqual({ id: 'p-1', ativo: false, cotas: [novembro] });
    expect(entrar(sair(entrou, 'p-1'), 'p-1')).toEqual(entrou);
  });

  it('are idempotent', () => {
    const entrou = entrar(undefined, 'p-1');
    expect(entrar(entrou, 'p-1')).toEqual(entrou);
    expect(sair(sair(entrou, 'p-1'), 'p-1')).toEqual(sair(entrou, 'p-1'));
  });
});

describe('deverCota', () => {
  it('adds the cota of each month', () => {
    const dezembro: Cota = { ...novembro, mes: '2026-12', tipoDeCota: 'so-cafe' };
    const participante = deverCota(deverCota(undefined, 'p-1', novembro), 'p-1', dezembro);
    expect(participante.cotas).toEqual([novembro, dezembro]);
  });

  it('ignores a repeated cota for the same month, keeping its valor', () => {
    const participante = deverCota(undefined, 'p-1', novembro);
    expect(deverCota(participante, 'p-1', { ...novembro, valorEmCentavos: 9999 })).toBe(
      participante,
    );
  });
});
