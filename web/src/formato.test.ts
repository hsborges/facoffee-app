import { describe, expect, it } from 'vitest';
import {
  dataEmCampoGrande,
  emCentavos,
  emReais,
  iniciais,
  mesEmCampoGrande,
  mesPorExtenso,
} from './formato';

describe('iniciais', () => {
  it('takes the first and the last name', () => {
    expect(iniciais('ana maria de souza')).toBe('AS');
    expect(iniciais('  Bruno  ')).toBe('B');
    expect(iniciais('')).toBe('');
  });
});

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

describe('mesEmCampoGrande', () => {
  it('RNF-03: turns the month at midnight in Campo Grande, not in UTC', () => {
    expect(mesEmCampoGrande(new Date('2026-11-01T03:59:59Z'))).toBe('2026-10');
    expect(mesEmCampoGrande(new Date('2026-11-01T04:00:00Z'))).toBe('2026-11');
  });
});
