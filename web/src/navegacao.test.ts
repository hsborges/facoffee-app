import { describe, expect, it } from 'vitest';
import { navegacao } from './navegacao';

const caminhos = (perfis: Parameters<typeof navegacao>[0]) =>
  navegacao(perfis).map(({ caminho }) => caminho);

describe('navegacao', () => {
  it('the participante sees only their pages', () => {
    expect(caminhos(['participante'])).toEqual(['/', '/caixinha']);
  });

  it('the gestor also sees the gestor pages', () => {
    expect(caminhos(['gestor', 'participante'])).toEqual([
      '/',
      '/caixinha',
      '/participantes',
      '/gastos',
      '/valor-da-cota',
    ]);
  });

  it('whoever does not participate yet sees the participante pages, to ask to join', () => {
    expect(caminhos([])).toEqual(['/', '/caixinha']);
  });
});
