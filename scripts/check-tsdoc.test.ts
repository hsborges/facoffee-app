import { describe, expect, it } from 'vitest';
import { undocumentedExports } from './check-tsdoc.ts';

const lines = (...source: string[]) => source.join('\n');

describe('undocumentedExports', () => {
  it('accepts exports with a TSDoc comment right above', () => {
    const source = lines(
      '/** One line. */',
      'export const a = 1;',
      '/**',
      ' * Many lines.',
      ' */',
      'export type B = string;',
    );
    expect(undocumentedExports(source)).toEqual([]);
  });

  it('reports the line of exports without a comment', () => {
    const source = lines('/** Documented. */', 'export const a = 1;', 'export function b() {}');
    expect(undocumentedExports(source)).toEqual([3]);
  });

  it('rejects line comments, plain block comments and a blank line before the export', () => {
    const source = lines(
      '// Line comment.',
      'export const a = 1;',
      '/* Plain block. */',
      'export const b = 2;',
      '/** Detached. */',
      '',
      'export const c = 3;',
    );
    expect(undocumentedExports(source)).toEqual([2, 4, 7]);
  });

  it('ignores re-exports and empty exports', () => {
    const source = lines(
      'export {};',
      "export { a } from './a.js';",
      "export type { B } from './b.js';",
      "export * from './c.js';",
    );
    expect(undocumentedExports(source)).toEqual([]);
  });
});
