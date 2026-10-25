import { describe, expect, it } from 'vitest';
import { definirValorDaCota, type ValorDaCota } from './tipo-de-cota.js';

const agora = new Date('2027-01-02T12:00:00Z');
const contexto = { eventId: '0b6f2f0e-6a1c-4c55-9a43-6f1f1b0c9e14', agora };
const gestor = { perfis: ['participante', 'gestor'] };
const valor: ValorDaCota = { tipoDeCota: 'so-cafe', ano: 2027, valorEmCentavos: 2500 };

describe('definirValorDaCota', () => {
  it('the gestor defines the valor of a tipo de cota for the year and Valor da cota definido is published', () => {
    expect(definirValorDaCota(undefined, gestor, valor, contexto)).toEqual({
      ok: true,
      value: {
        valor,
        evento: {
          id: contexto.eventId,
          type: 'participation.contribution-amount-set',
          version: 1,
          occurredAt: '2027-01-02T12:00:00.000Z',
          payload: { contributionType: 'coffee-only', year: 2027, amountInCents: 2500 },
        },
      },
    });
  });

  it('a second definition in the same year is refused', () => {
    expect(
      definirValorDaCota(valor, gestor, { ...valor, valorEmCentavos: 3000 }, contexto),
    ).toEqual({ ok: false, error: 'valor-ja-definido' });
  });

  it('a participante who is not the gestor cannot define it', () => {
    expect(definirValorDaCota(undefined, { perfis: ['participante'] }, valor, contexto)).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
  });

  it('may define the next year but not a past one', () => {
    expect(definirValorDaCota(undefined, gestor, { ...valor, ano: 2028 }, contexto).ok).toBe(true);
    expect(definirValorDaCota(undefined, gestor, { ...valor, ano: 2026 }, contexto)).toEqual({
      ok: false,
      error: 'ano-passado',
    });
  });
});
