import { describe, expect, it } from 'vitest';
import { citacoesDe, matriz, requisitosDe, verificar } from './check-requisitos.ts';

const lines = (...source: string[]) => source.join('\n');
const comCenario = (heading: string) => `${heading}\n  Cenário: x`;

const entrar = requisitosDe(
  'docs/requisitos/participacao/entrar-na-copa.md',
  lines(
    '# RF-PAR-01 Entrar na copa',
    '',
    '### RN-PAR-01 Quem entra escolhe um tipo de cota',
    '',
    '  Cenário: entrada pela primeira vez',
    '### RN-PAR-02 O gestor é um papel',
    '',
    '- Verificação: revisão. Vem do perfil.',
    '  Cenário: o gestor também entra',
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
  it('reads the ID and title of each heading, marking review and Cenário', () => {
    expect(entrar).toEqual([
      {
        id: 'RF-PAR-01',
        titulo: 'Entrar na copa',
        arquivo: entrar[0]?.arquivo,
        linha: 1,
        revisao: false,
        comCenario: false,
      },
      {
        id: 'RN-PAR-01',
        titulo: 'Quem entra escolhe um tipo de cota',
        arquivo: entrar[0]?.arquivo,
        linha: 3,
        revisao: false,
        comCenario: true,
      },
      {
        id: 'RN-PAR-02',
        titulo: 'O gestor é um papel',
        arquivo: entrar[0]?.arquivo,
        linha: 6,
        revisao: true,
        comCenario: true,
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

  it('also finds malformed IDs, so they are reported as not existing', () => {
    expect(citacoesDe('t.ts', "it('RN-FIN-7, RN-FIN-100: x')").map((c) => c.id)).toEqual([
      'RN-FIN-7',
      'RN-FIN-100',
    ]);
  });
});

describe('verificar', () => {
  it('accepts unique IDs, an index in sync and every RN tested or under review', () => {
    expect(
      verificar([...entrar, ...rnf], indiceCerto, [...teste, ...citacoesDe('b', 'RNF-01')]),
    ).toEqual([]);
  });

  it('reports a duplicated ID', () => {
    const outro = requisitosDe(
      'docs/requisitos/participacao/x.md',
      comCenario('### RN-PAR-01 De novo'),
    );
    expect(verificar([...entrar, ...outro], indiceCerto, teste)).toEqual([
      'docs/requisitos/participacao/x.md:1 RN-PAR-01 duplicado (já definido em docs/requisitos/participacao/entrar-na-copa.md:3)',
      'docs/requisitos/participacao/x.md regras sem funcionalidade (falta o # RF-)',
    ]);
  });

  it('reports an ID cited in a test that does not exist', () => {
    const citacoes = [...teste, ...citacoesDe('b.test.ts', "it('RN-FIN-99: ghost')")];
    expect(verificar(entrar, indiceCerto, citacoes)).toEqual([
      'b.test.ts:1 RN-FIN-99 não existe em docs/requisitos/',
    ]);
  });

  it('reports IDs out of the format RF-<CTX>-NN, RN-<CTX>-NN or RNF-NN', () => {
    const errados = requisitosDe(
      'docs/requisitos/nao-funcionais.md',
      lines(
        '### RN-01 Sem contexto',
        '  Cenário: x',
        '### RNF-PAR-02 Com contexto',
        '### RN-XYZ-03 Outro contexto',
        '  Cenário: x',
      ),
    );
    expect(verificar(errados, indice(), citacoesDe('t', 'RN-01 RNF-PAR-02 RN-XYZ-03'))).toEqual([
      'docs/requisitos/nao-funcionais.md:1 RN-01 fora do formato RF-<CTX>-NN, RN-<CTX>-NN ou RNF-NN',
      'docs/requisitos/nao-funcionais.md:3 RNF-PAR-02 fora do formato RF-<CTX>-NN, RN-<CTX>-NN ou RNF-NN',
      'docs/requisitos/nao-funcionais.md:4 RN-XYZ-03 fora do formato RF-<CTX>-NN, RN-<CTX>-NN ou RNF-NN',
      'docs/requisitos/nao-funcionais.md regras sem funcionalidade (falta o # RF-)',
    ]);
  });

  it('reports an RN without a test, unless marked for review', () => {
    expect(verificar([...entrar, ...rnf], indiceCerto, [])).toEqual([
      'docs/requisitos/participacao/entrar-na-copa.md:3 RN-PAR-01 sem teste que o cite (ou marque "- Verificação: revisão")',
      'docs/requisitos/nao-funcionais.md:1 RNF-01 sem teste que o cite (ou marque "- Verificação: revisão")',
    ]);
  });

  it('reports an RN without Cenário; RNF may have none', () => {
    const semCenario = requisitosDe(
      'docs/requisitos/participacao/entrar-na-copa.md',
      lines('# RF-PAR-01 Entrar', '### RN-PAR-01 Sem cenário', '- Verificação: revisão. x'),
    );
    const linha = '| [RF-PAR-01](participacao/entrar-na-copa.md) | Entrar | RN-PAR-01 |';
    expect(verificar([...semCenario, ...rnf], indice(linha), citacoesDe('b', 'RNF-01'))).toEqual([
      'docs/requisitos/participacao/entrar-na-copa.md:2 RN-PAR-01 sem Cenário',
    ]);
  });

  it('reports a file with more than one funcionalidade', () => {
    const dois = requisitosDe(
      'docs/requisitos/participacao/entrar-na-copa.md',
      lines('# RF-PAR-01 Entrar', '# RF-PAR-02 Trocar'),
    );
    const linha = '| [RF-PAR-01](participacao/entrar-na-copa.md) | Entrar | RF-PAR-02 |';
    expect(verificar(dois, indice(linha), [])).toEqual([
      'docs/requisitos/participacao/entrar-na-copa.md define mais de uma funcionalidade',
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
