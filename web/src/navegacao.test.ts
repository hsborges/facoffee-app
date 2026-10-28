import { describe, expect, it } from 'vitest';
import {
  destinoDoLogin,
  navegacao,
  paginas,
  type Visao,
  visaoAtual,
  visaoGuardada,
} from './navegacao';

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

describe('paginas', () => {
  it('each subpágina comes after the page it leaves from, which the menu marks', () => {
    expect(paginas('participante').map(({ caminho, menu }) => [caminho, menu])).toEqual([
      ['/', '/'],
      ['/enviar-comprovante', '/'],
      ['/desativar-meu-acesso', '/'],
      ['/caixinha', '/caixinha'],
      ['/caixinha/registrar-gasto', '/caixinha'],
    ]);
    expect(paginas('gestor').map(({ caminho }) => caminho)).toEqual([
      '/participantes',
      '/participantes/conferir-comprovante',
      '/participantes/receber-pagamento',
      '/gastos',
      '/gastos/registrar-gasto',
      '/gastos/solicitar-complemento',
      '/valor-da-cota',
    ]);
  });
});

describe('visaoAtual', () => {
  const GESTOR = ['gestor'] as const;

  it('whoever is not gestor always sees the visão do participante, on any page', () => {
    for (const perfis of [[]] as const)
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

  it('matches the page as the router does: trailing slash and any case', () => {
    expect(visaoAtual(GESTOR, 'participante', '/gastos/')).toBe('gestor');
    expect(visaoAtual(GESTOR, 'participante', '/Valor-da-Cota')).toBe('gestor');
    expect(visaoAtual(GESTOR, 'gestor', '/caixinha/')).toBe('participante');
  });

  it('a subpágina belongs to the visão of its page', () => {
    expect(visaoAtual(GESTOR, 'participante', '/participantes/receber-pagamento')).toBe('gestor');
    expect(visaoAtual(GESTOR, 'gestor', '/enviar-comprovante')).toBe('participante');
    expect(visaoAtual(GESTOR, 'participante', '/gastos/registrar-gasto')).toBe('gestor');
    expect(visaoAtual(GESTOR, 'gestor', '/caixinha/registrar-gasto')).toBe('participante');
  });

  it('a page of no visão keeps the one chosen', () => {
    expect(visaoAtual(GESTOR, 'gestor', '/nada')).toBe('gestor');
    expect(visaoAtual(GESTOR, 'participante', '/nada')).toBe('participante');
  });
});

describe('visaoGuardada', () => {
  it('keeps the visão chosen in the tab', () => {
    expect(visaoGuardada(false, 'gestor')).toBe('gestor');
    expect(visaoGuardada(false, 'participante')).toBe('participante');
  });

  it('a new login chooses again', () => {
    expect(visaoGuardada(true, 'gestor')).toBeUndefined();
  });

  it('nothing or anything else is no visão', () => {
    expect(visaoGuardada(false, null)).toBeUndefined();
    expect(visaoGuardada(false, 'admin')).toBeUndefined();
  });
});
