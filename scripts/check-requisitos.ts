import { globSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ID = /\bR(?:F|N|NF)-(?:[A-Z]{3}-)?\d{2}\b/g;
const HEADING = /^#{1,3} (R(?:F|N|NF)-(?:[A-Z]{3}-)?\d{2}) (.+)$/;
const REVISAO = /^- Verificação: revisão\b/;
const LINHA_DO_INDICE = /^\| \[(RF-[A-Z]{3}-\d{2})\]\(([^)]+)\) \|/;

/** A requisito (RF, RN or RNF) defined by a heading `# ID Título` in docs/requisitos/ (ADR 0032). */
export type Requisito = {
  readonly id: string;
  readonly titulo: string;
  readonly arquivo: string;
  readonly linha: number;
  /** Marked `- Verificação: revisão`: verified by review, no test required. */
  readonly revisao: boolean;
};

/** An ID cited in a test file. */
export type Citacao = { readonly id: string; readonly arquivo: string; readonly linha: number };

/** Requisitos defined in a Markdown file, in order. */
export const requisitosDe = (arquivo: string, texto: string): readonly Requisito[] => {
  const requisitos: Requisito[] = [];
  texto.split('\n').forEach((line, i) => {
    const heading = HEADING.exec(line);
    const ultimo = requisitos.at(-1);
    if (heading?.[1] && heading[2]) {
      requisitos.push({
        id: heading[1],
        titulo: heading[2],
        arquivo,
        linha: i + 1,
        revisao: false,
      });
    } else if (REVISAO.test(line) && ultimo) {
      requisitos[requisitos.length - 1] = { ...ultimo, revisao: true };
    }
  });
  return requisitos;
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
 * Problems in the requisitos: duplicated IDs, cited IDs that do not exist, an index out of sync with
 * the files, and RN/RNF without a test nor `Verificação: revisão`.
 */
export const verificar = (
  requisitos: readonly Requisito[],
  indice: { readonly arquivo: string; readonly texto: string },
  citacoes: readonly Citacao[],
): readonly string[] => {
  const definidos = new Map<string, Requisito>();
  const duplicados = requisitos.flatMap((r) => {
    const primeiro = definidos.get(r.id);
    if (!primeiro) definidos.set(r.id, r);
    return primeiro ? [`${onde(r)} ${r.id} duplicado (já definido em ${onde(primeiro)})`] : [];
  });

  const inexistentes = citacoes
    .filter((c) => !definidos.has(c.id))
    .map((c) => `${onde(c)} ${c.id} não existe em docs/requisitos/`);

  const porArquivo = Map.groupBy(requisitos, (r) => r.arquivo);
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

  const citados = new Set(citacoes.map((c) => c.id));
  const semTeste = requisitos
    .filter((r) => !r.id.startsWith('RF-') && !r.revisao && !citados.has(r.id))
    .map((r) => `${onde(r)} ${r.id} sem teste que o cite (ou marque "- Verificação: revisão")`);

  return [...duplicados, ...inexistentes, ...indiceErrado, ...foraDoIndice, ...semTeste];
};

/** Traceability matrix (RF → RN → tests) in Markdown. */
export const matriz = (requisitos: readonly Requisito[], citacoes: readonly Citacao[]): string => {
  const testesDe = (id: string) =>
    citacoes
      .filter((c) => c.id === id)
      .map(onde)
      .join(', ');
  const linhas = requisitos
    .filter((r) => !r.id.startsWith('RF-'))
    .map((r) => {
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
