import { describe, expect, it } from 'vitest';
import { citacoesDe, matriz, requisitosDe, verificar } from './check-requisitos.ts';

const lines = (...source: string[]) => source.join('\n');

const entrar = requisitosDe(
  'docs/requisitos/participacao/entrar-na-copa.md',
  lines(
    '# RF-PAR-01 Entrar na copa',
    '',
    '### RN-PAR-01 Quem entra escolhe um tipo de cota',
    '',
    '### RN-PAR-02 O gestor é um papel',
    '',
    '- Verificação: revisão. Vem do perfil.',
  ),
);
const rnf = requisitosDe('docs/requisitos/nao-funcionais.md', '### RNF-01 Mobile first');
const indice = (...linhas: string[]) => ({
  arquivo: 'docs/requisitos/README.md',
  texto: lines('| ID | Funcionalidade |', '|---|---|', ...linhas),
});
const indiceCerto = indice(
  '| [RF-PAR-01](participacao/entrar-na-copa.md) | Entrar | RN-PAR-01, RN-PAR-02 |',
);
const teste = citacoesDe('a.test.ts', lines('describe(...)', "it('RN-PAR-01: enters', ...)"));

describe('requisitosDe', () => {
  it('reads the ID and title of each heading, marking the ones verified by review', () => {
    expect(entrar).toEqual([
      {
        id: 'RF-PAR-01',
        titulo: 'Entrar na copa',
        arquivo: entrar[0]?.arquivo,
        linha: 1,
        revisao: false,
      },
      {
        id: 'RN-PAR-01',
        titulo: 'Quem entra escolhe um tipo de cota',
        arquivo: entrar[0]?.arquivo,
        linha: 3,
        revisao: false,
      },
      {
        id: 'RN-PAR-02',
        titulo: 'O gestor é um papel',
        arquivo: entrar[0]?.arquivo,
        linha: 5,
        revisao: true,
      },
    ]);
  });

  it('ignores IDs outside headings', () => {
    expect(requisitosDe('x.md', lines('Ver RN-FIN-18.', '#### RN-FIN-99 too deep'))).toEqual([]);
  });
});

describe('citacoesDe', () => {
  it('finds every ID in a test file, with the line', () => {
    expect(citacoesDe('t.ts', "it('RN-FIN-07, RNF-03: x')\nit('RF-FIN-01: y')")).toEqual([
      { id: 'RN-FIN-07', arquivo: 't.ts', linha: 1 },
      { id: 'RNF-03', arquivo: 't.ts', linha: 1 },
      { id: 'RF-FIN-01', arquivo: 't.ts', linha: 2 },
    ]);
  });
});

describe('verificar', () => {
  it('accepts unique IDs, an index in sync and every RN tested or under review', () => {
    expect(verificar(entrar, indiceCerto, teste)).toEqual([]);
  });

  it('reports a duplicated ID', () => {
    const outro = requisitosDe('docs/requisitos/financeiro/x.md', '### RN-PAR-01 De novo');
    expect(verificar([...entrar, ...outro], indiceCerto, teste)).toEqual([
      'docs/requisitos/financeiro/x.md:1 RN-PAR-01 duplicado (já definido em docs/requisitos/participacao/entrar-na-copa.md:3)',
    ]);
  });

  it('reports an ID cited in a test that does not exist', () => {
    const citacoes = [...teste, ...citacoesDe('b.test.ts', "it('RN-FIN-99: ghost')")];
    expect(verificar(entrar, indiceCerto, citacoes)).toEqual([
      'b.test.ts:1 RN-FIN-99 não existe em docs/requisitos/',
    ]);
  });

  it('reports an RN without a test, unless marked for review', () => {
    expect(verificar([...entrar, ...rnf], indiceCerto, [])).toEqual([
      'docs/requisitos/participacao/entrar-na-copa.md:3 RN-PAR-01 sem teste que o cite (ou marque "- Verificação: revisão")',
      'docs/requisitos/nao-funcionais.md:1 RNF-01 sem teste que o cite (ou marque "- Verificação: revisão")',
    ]);
  });

  it('reports an index row with the wrong rules, a row to no funcionalidade and a file out of the index', () => {
    const errado = indice(
      '| [RF-PAR-01](participacao/entrar-na-copa.md) | Entrar | RN-PAR-01 |',
      '| [RF-FIN-01](financeiro/pagar.md) | Pagar | |',
    );
    expect(verificar(entrar, errado, teste)).toEqual([
      'docs/requisitos/README.md:3 RF-PAR-01 deveria listar RF-PAR-01, RN-PAR-01, RN-PAR-02',
      'docs/requisitos/README.md:4 financeiro/pagar.md não define funcionalidade',
    ]);
    expect(verificar(entrar, indice(), teste)).toEqual([
      'docs/requisitos/participacao/entrar-na-copa.md fora do índice docs/requisitos/README.md',
    ]);
  });
});

describe('matriz', () => {
  it('lists each rule under its funcionalidade with the tests that cite it', () => {
    expect(matriz([...entrar, ...rnf], teste)).toBe(
      lines(
        '| Funcionalidade | Regra | Testes |',
        '|---|---|---|',
        '| RF-PAR-01 Entrar na copa | RN-PAR-01 Quem entra escolhe um tipo de cota | a.test.ts:2 |',
        '| RF-PAR-01 Entrar na copa | RN-PAR-02 O gestor é um papel | revisão |',
        '| — | RNF-01 Mobile first | **nenhum** |',
      ),
    );
  });
});
