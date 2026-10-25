import { globSync, readFileSync } from 'node:fs';

// Re-exports and `export {}` are documented where they are declared.
const EXPORT = /^export (?!(type )?[{*])/;

const hasTsdocAbove = (lines: readonly string[], index: number): boolean => {
  if (!lines[index - 1]?.trimEnd().endsWith('*/')) return false;
  const start = lines.findLastIndex((line, i) => i < index && line.includes('/*'));
  return lines[start]?.trimStart().startsWith('/**') ?? false;
};

/**
 * Lines (1-based) of top-level exports without a TSDoc comment right above them (ADR 0010).
 *
 * shortcut: line-based, not a parser; switch to the TypeScript API if exports get exotic.
 */
export const undocumentedExports = (source: string): readonly number[] => {
  const lines = source.split('\n');
  return lines.flatMap((line, i) => (EXPORT.test(line) && !hasTsdocAbove(lines, i) ? [i + 1] : []));
};

if (import.meta.main) {
  const files = globSync('**/src/**/*.ts', {
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts'],
  });
  const problems = files.flatMap((file) =>
    undocumentedExports(readFileSync(file, 'utf8')).map((line) => `${file}:${line}`),
  );
  for (const problem of problems) console.error(`${problem} export without TSDoc`);
  process.exitCode = problems.length > 0 ? 1 : 0;
}
