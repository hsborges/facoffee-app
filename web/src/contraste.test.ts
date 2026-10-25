import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('estilos.css', import.meta.url), 'utf8');
const cores = Object.fromEntries(
  [...css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map(([, nome, hex]) => [nome, hex]),
);

// WCAG 2.2 relative luminance and contrast ratio.
const luminancia = (hex: string) => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (escuro + 0.05);
};

// Pairs the layout uses: 4.5:1 for text (WCAG 1.4.3), 3:1 for contours and focus (1.4.11).
const pares = [
  ['espresso-dark', 'pure-white', 4.5],
  ['espresso-dark', 'cream-off-white', 4.5],
  ['muted-mocha', 'pure-white', 4.5],
  ['pure-white', 'espresso-dark', 4.5],
  ['pure-white', 'espresso-hover', 4.5],
  ['espresso-dark', 'light-sand', 4.5],
  ['espresso-dark', 'warm-latte', 4.5],
  ['espresso-dark', 'warm-latte-hover', 4.5],
  ['sucesso', 'pure-white', 4.5],
  ['erro', 'pure-white', 4.5],
  ['contorno', 'pure-white', 3],
] as const;

describe('design tokens', () => {
  it.each(pares)('%s on %s reaches %s:1', (frente, fundo, minimo) => {
    const [a, b] = [cores[frente], cores[fundo]];
    if (!a || !b) throw new Error(`token not found: ${a ? fundo : frente}`);
    expect(contraste(a, b)).toBeGreaterThanOrEqual(minimo);
  });
});
