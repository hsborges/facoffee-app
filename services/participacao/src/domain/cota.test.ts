import { describe, expect, it } from 'vitest';
import { deverCota } from './cota.js';
import type { Participante } from './participante.js';
import type { ValorDaCota } from './tipo-de-cota.js';

const agora = new Date('2026-11-01T04:00:00Z');
const contexto = { eventId: '0b6f2f0e-6a1c-4c55-9a43-6f1f1b0c9e13', agora };
const id = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const participando: Participante = { id, tipoDeCota: 'so-cafe', participando: true, troca: null };
const valores: readonly ValorDaCota[] = [
  { tipoDeCota: 'so-cafe', ano: 2026, valorEmCentavos: 2500 },
  { tipoDeCota: 'completa', ano: 2026, valorEmCentavos: 3000 },
  { tipoDeCota: 'completa', ano: 2027, valorEmCentavos: 3500 },
];

describe('deverCota', () => {
  it('the participante owes the cota of the month with the valor of their tipo and Cota devida is published', () => {
    expect(deverCota(participando, '2026-11', valores, contexto)).toEqual({
      ok: true,
      value: {
        cota: { participanteId: id, mes: '2026-11', tipoDeCota: 'so-cafe', valorEmCentavos: 2500 },
        evento: {
          id: contexto.eventId,
          type: 'participation.contribution-due',
          version: 1,
          occurredAt: '2026-11-01T04:00:00.000Z',
          payload: {
            participantId: id,
            month: '2026-11',
            contributionType: 'coffee-only',
            amountInCents: 2500,
          },
        },
      },
    });
  });

  it('uses the tipo de cota in that month, counting a troca, and the valor of that year', () => {
    const trocou: Participante = {
      ...participando,
      troca: { tipoDeCota: 'completa', aPartirDe: '2026-12' },
    };
    expect(deverCota(trocou, '2026-11', valores, contexto)).toMatchObject({
      value: { cota: { tipoDeCota: 'so-cafe', valorEmCentavos: 2500 } },
    });
    expect(deverCota(trocou, '2026-12', valores, contexto)).toMatchObject({
      value: { cota: { tipoDeCota: 'completa', valorEmCentavos: 3000 } },
    });
    expect(deverCota(trocou, '2027-01', valores, contexto)).toMatchObject({
      value: {
        cota: { tipoDeCota: 'completa', valorEmCentavos: 3500 },
        evento: { payload: { contributionType: 'full', amountInCents: 3500 } },
      },
    });
  });

  it('is not devida without a valor for the tipo de cota in that year', () => {
    expect(deverCota(participando, '2027-01', valores, contexto)).toEqual({
      ok: false,
      error: 'valor-nao-definido',
    });
  });

  it('whoever is not participando owes no cota', () => {
    expect(
      deverCota({ ...participando, participando: false }, '2026-11', valores, contexto),
    ).toEqual({ ok: false, error: 'nao-participando' });
  });
});
