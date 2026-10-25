import { describe, expect, it } from 'vitest';
import { dataEmCampoGrande, emCentavos, emReais, mesPorExtenso } from './formato';

describe('emReais', () => {
  it('shows centavos as reais', () => {
    expect(emReais(3000)).toBe('R$\u00a030,00');
    expect(emReais(123456)).toBe('R$\u00a01.234,56');
    expect(emReais(-1500)).toBe('-R$\u00a015,00');
  });
});

describe('emCentavos', () => {
  it('reads reais typed in a number input as centavos, without float residue', () => {
    expect(emCentavos('30')).toBe(3000);
    expect(emCentavos('45.9')).toBe(4590);
    expect(emCentavos('0.29')).toBe(29);
    expect(emCentavos('1234.56')).toBe(123456);
  });
});

describe('mesPorExtenso', () => {
  it('shows an AAAA-MM month by name, whatever the browser time zone', () => {
    expect(mesPorExtenso('2026-01')).toBe('janeiro de 2026');
    expect(mesPorExtenso('2026-12')).toBe('dezembro de 2026');
  });
});

describe('dataEmCampoGrande', () => {
  it('shows the day in Campo Grande, where the copa is', () => {
    expect(dataEmCampoGrande('2026-11-21T02:00:00.000Z')).toBe('20/11/2026');
  });
});
