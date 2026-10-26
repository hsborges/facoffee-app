import { describe, expect, it } from 'vitest';
import { destinoDoLogin, navegacao, type Visao, visaoAtual } from './navegacao';

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

const caminhos = (visao: Visao) => navegacao(visao).map(({ caminho }) => caminho);

describe('navegacao', () => {
  it('the visão do participante has only the participante pages', () => {
    expect(caminhos('participante')).toEqual(['/', '/caixinha']);
  });

  it('the visão do gestor has only the gestor pages', () => {
    expect(caminhos('gestor')).toEqual(['/participantes', '/gastos', '/valor-da-cota']);
  });
});

describe('visaoAtual', () => {
  const GESTOR = ['gestor', 'participante'] as const;

  it('whoever is not gestor always sees the visão do participante, on any page', () => {
    for (const perfis of [['participante'], []] as const)
      for (const caminho of ['/', '/gastos', '/nada'])
        expect(visaoAtual(perfis, undefined, caminho)).toBe('participante');
  });

  it('the gestor chooses the visão first, on any page', () => {
    for (const caminho of ['/', '/gastos', '/nada'])
      expect(visaoAtual(GESTOR, undefined, caminho)).toBeUndefined();
  });

  it('a page of the other visão leads the gestor to it', () => {
    expect(visaoAtual(GESTOR, 'participante', '/gastos')).toBe('gestor');
    expect(visaoAtual(GESTOR, 'gestor', '/caixinha')).toBe('participante');
  });

  it('a page of no visão keeps the one chosen', () => {
    expect(visaoAtual(GESTOR, 'gestor', '/nada')).toBe('gestor');
    expect(visaoAtual(GESTOR, 'participante', '/nada')).toBe('participante');
  });
});
