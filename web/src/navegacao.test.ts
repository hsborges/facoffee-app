import { describe, expect, it } from 'vitest';
import { destinoDoLogin, navegacao } from './navegacao';

describe('destinoDoLogin', () => {
  it('returns to the page asked before the login', () => {
    expect(destinoDoLogin('/gastos?ano=2026')).toBe('/gastos?ano=2026');
  });

  it('goes to the start without a page or with anything outside the FACOFFEE', () => {
    for (const estado of [
      undefined,
      null,
      42,
      '',
      'gastos',
      '//exemplo.com',
      '/\\exemplo.com',
      'https://exemplo.com',
    ]) {
      expect(destinoDoLogin(estado)).toBe('/');
    }
  });
});

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
