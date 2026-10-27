import { globSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Loose on purpose, so a malformed ID (`RN-FIN-7`, `RN-01`) is read and then reported, not skipped.
const ID = /\bR(?:F|N|NF)-(?:[A-Z]+-)?\d+\b/g;
const FORMATO = /^(?:R[FN]-(?:PAR|FIN|USU|NOT|AGE|WEB)|RNF)-\d{2,}$/;
const HEADING = /^#{1,3} (R(?:F|N|NF)-(?:[A-Z]+-)?\d+) (.+)$/;
const REVISAO = /^- Verificação: revisão\b/;
const CENARIO = /^\s*Cenário:/;
const LINHA_DO_INDICE = /^\| \[(RF-[A-Z]+-\d+)\]\(([^)]+)\) \|/;
// The acceptance test of each funcionalidade (ADR 0033).
const SPEC_E2E = /^e2e\/.+\.spec\.ts$/;

/** A requisito (RF, RN or RNF) defined by a heading `# ID Título` in docs/requisitos/ (ADR 0032). */
export type Requisito = {
  readonly id: string;
  readonly titulo: string;
  readonly arquivo: string;
  readonly linha: number;
  /** Marked `- Verificação: revisão`: verified by review, no test required. */
  readonly revisao: boolean;
  /** Has at least one Gherkin `Cenário:` under its heading. */
  readonly comCenario: boolean;
};

/** An ID cited in a test file. */
export type Citacao = { readonly id: string; readonly arquivo: string; readonly linha: number };

/** Requisitos defined in a Markdown file, in order. */
export const requisitosDe = (arquivo: string, texto: string): readonly Requisito[] => {
  const linhas = texto.split('\n');
  const headings = linhas.flatMap((line, i) => {
    const heading = HEADING.exec(line);
    return heading?.[1] && heading[2]
      ? [{ id: heading[1], titulo: heading[2], arquivo, linha: i + 1 }]
      : [];
  });
  return headings.map((heading, n) => {
    const secao = linhas.slice(heading.linha, (headings[n + 1]?.linha ?? linhas.length + 1) - 1);
    return {
      ...heading,
      revisao: secao.some((line) => REVISAO.test(line)),
      comCenario: secao.some((line) => CENARIO.test(line)),
    };
  });
};

/** IDs cited anywhere in a test file, with their line. */
export const citacoesDe = (arquivo: string, texto: string): readonly Citacao[] =>
  texto
    .split('\n')
    .flatMap((line, i) => (line.match(ID) ?? []).map((id) => ({ id, arquivo, linha: i + 1 })));

const onde = (r: { arquivo: string; linha: number }) => `${r.arquivo}:${r.linha}`;
const mesmoConjunto = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/**
 * Problems in the requisitos: IDs out of format or duplicated, cited IDs that do not exist, files
 * with RN but not exactly one RF, an index out of sync with the files, RF without an e2e spec,
 * RN/RNF without a test nor `Verificação: revisão`, and RN without Cenário.
 */
export const verificar = (
  requisitos: readonly Requisito[],
  indice: { readonly arquivo: string; readonly texto: string },
  citacoes: readonly Citacao[],
): readonly string[] => {
  const foraDoFormato = requisitos
    .filter((r) => !FORMATO.test(r.id))
    .map((r) => `${onde(r)} ${r.id} fora do formato RF-<CTX>-NN, RN-<CTX>-NN ou RNF-NN`);

  const definidos = new Map(requisitos.toReversed().map((r) => [r.id, r]));
  const duplicados = requisitos
    .filter((r) => definidos.get(r.id) !== r)
    .map((r) => `${onde(r)} ${r.id} duplicado (já definido em ${onde(definidos.get(r.id) ?? r)})`);

  const inexistentes = citacoes
    .filter((c) => !definidos.has(c.id))
    .map((c) => `${onde(c)} ${c.id} não existe em docs/requisitos/`);

  const porArquivo = Map.groupBy(requisitos, (r) => r.arquivo);
  const semUmaFuncionalidade = [...porArquivo].flatMap(([arquivo, rs]) => {
    const rfs = rs.filter((r) => r.id.startsWith('RF-')).length;
    if (rfs > 1) return [`${arquivo} define mais de uma funcionalidade`];
    return rfs === 0 && rs.some((r) => r.id.startsWith('RN-'))
      ? [`${arquivo} regras sem funcionalidade (falta o # RF-)`]
      : [];
  });

  const funcionalidades = new Map(
    [...porArquivo].flatMap(([arquivo, rs]) =>
      rs.some((r) => r.id.startsWith('RF-')) ? [[arquivo, rs.map((r) => r.id)]] : [],
    ),
  );
  const listados = new Set<string>();
  const indiceErrado = indice.texto.split('\n').flatMap((line, i) => {
    const linha = LINHA_DO_INDICE.exec(line);
    if (!linha?.[2]) return [];
    const arquivo = join(dirname(indice.arquivo), linha[2]);
    listados.add(arquivo);
    const esperados = funcionalidades.get(arquivo);
    if (!esperados) return [`${indice.arquivo}:${i + 1} ${linha[2]} não define funcionalidade`];
    const ids = line.match(ID) ?? [];
    return mesmoConjunto(ids, esperados)
      ? []
      : [`${indice.arquivo}:${i + 1} ${linha[1]} deveria listar ${esperados.join(', ')}`];
  });
  const foraDoIndice = [...funcionalidades.keys()]
    .filter((arquivo) => !listados.has(arquivo))
    .map((arquivo) => `${arquivo} fora do índice ${indice.arquivo}`);

  const noE2e = new Set(citacoes.filter((c) => SPEC_E2E.test(c.arquivo)).map((c) => c.id));
  const semSpec = requisitos
    .filter((r) => r.id.startsWith('RF-') && !noE2e.has(r.id))
    .map((r) => `${onde(r)} ${r.id} sem spec em e2e/ que o cite`);

  const citados = new Set(citacoes.map((c) => c.id));
  const semTeste = requisitos
    .filter((r) => !r.id.startsWith('RF-') && !r.revisao && !citados.has(r.id))
    .map((r) => `${onde(r)} ${r.id} sem teste que o cite (ou marque "- Verificação: revisão")`);

  const semCenario = requisitos
    .filter((r) => r.id.startsWith('RN-') && !r.comCenario)
    .map((r) => `${onde(r)} ${r.id} sem Cenário`);

  return [
    ...foraDoFormato,
    ...duplicados,
    ...inexistentes,
    ...semUmaFuncionalidade,
    ...indiceErrado,
    ...foraDoIndice,
    ...semSpec,
    ...semTeste,
    ...semCenario,
  ];
};

/** Traceability matrix (RF → e2e specs, RN → tests) in Markdown. */
export const matriz = (requisitos: readonly Requisito[], citacoes: readonly Citacao[]): string => {
  const testesDe = (id: string, so: (c: Citacao) => boolean = () => true) =>
    citacoes
      .filter((c) => c.id === id && so(c))
      .map(onde)
      .join(', ');
  const linhas = requisitos.map((r) => {
    if (r.id.startsWith('RF-')) {
      const specs = testesDe(r.id, (c) => SPEC_E2E.test(c.arquivo)) || '**nenhum**';
      return `| ${r.id} ${r.titulo} | — | ${specs} |`;
    }
    const rf = requisitos.find((f) => f.arquivo === r.arquivo && f.id.startsWith('RF-'));
    const funcionalidade = rf ? `${rf.id} ${rf.titulo}` : '—';
    const testes = r.revisao ? 'revisão' : testesDe(r.id) || '**nenhum**';
    return `| ${funcionalidade} | ${r.id} ${r.titulo} | ${testes} |`;
  });
  return ['| Funcionalidade | Regra | Testes |', '|---|---|---|', ...linhas].join('\n');
};

if (import.meta.main) {
  const pasta = 'docs/requisitos';
  const arquivos = globSync(`${pasta}/**/*.md`)
    .filter((f) => !f.endsWith('README.md'))
    .sort();
  if (arquivos.length === 0) throw new Error(`no files found in ${pasta}`);
  const requisitos = arquivos.flatMap((f) => requisitosDe(f, readFileSync(f, 'utf8')));
  const testes = globSync('**/*.{test,spec}.{ts,tsx}', {
    exclude: ['**/node_modules/**', '**/dist/**', 'scripts/**'],
  }).sort();
  const citacoes = testes.flatMap((f) => citacoesDe(f, readFileSync(f, 'utf8')));

  if (process.argv.includes('--matriz')) {
    console.log(matriz(requisitos, citacoes));
  } else {
    const indice = `${pasta}/README.md`;
    const problemas = verificar(
      requisitos,
      { arquivo: indice, texto: readFileSync(indice, 'utf8') },
      citacoes,
    );
    for (const problema of problemas) console.error(problema);
    process.exitCode = problemas.length > 0 ? 1 : 0;
  }
}
