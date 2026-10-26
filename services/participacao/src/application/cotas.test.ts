import { describe, expect, it } from 'vitest';
import type { Cota } from '../domain/cota.js';
import type { Event } from '../domain/event.js';
import type { Participante } from '../domain/participante.js';
import type { ValorDaCota } from '../domain/tipo-de-cota.js';
import { type Cotas, iniciarMes } from './cotas.js';
import type { ValoresDaCota } from './tipos-de-cota.js';

// 2026-11-01 00:30 in Campo Grande.
const clock = { now: () => new Date('2026-11-01T04:30:00Z'), newId: () => 'id-1' };
const p1 = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const p2 = '11111111-1111-4111-8111-111111111111';

const inMemory = (valoresDoAno: readonly ValorDaCota[]) => {
  const participantes: Participante[] = [];
  const devidas: Cota[] = [];
  const events: Event[] = [];
  const devida = (id: string, mes: string) =>
    devidas.some((c) => c.participanteId === id && c.mes === mes);
  const cotas: Cotas = {
    participandoSemCota: async (mes) =>
      participantes.filter((p) => p.participando && !devida(p.id, mes)),
    salvar: async (cota, newEvents) => {
      if (devida(cota.participanteId, cota.mes)) return false;
      devidas.push(cota);
      events.push(...newEvents);
      return true;
    },
  };
  const valores: ValoresDaCota = {
    buscar: async (tipoDeCota, ano) =>
      valoresDoAno.find((v) => v.tipoDeCota === tipoDeCota && v.ano === ano),
    salvar: async () => false,
  };
  return { participantes, devidas, events, iniciar: iniciarMes(cotas, valores, clock) };
};

const participante = (id: string, tipoDeCota: Participante['tipoDeCota']): Participante => ({
  id,
  tipoDeCota,
  participando: true,
  troca: null,
});

describe('iniciarMes', () => {
  it('RN-PAR-12, RNF-05: each participante ativo owes the cota of the month once, even when triggered twice', async () => {
    const { participantes, devidas, events, iniciar } = inMemory([
      { tipoDeCota: 'so-cafe', ano: 2026, valorEmCentavos: 2500 },
      { tipoDeCota: 'completa', ano: 2026, valorEmCentavos: 3000 },
    ]);
    participantes.push(participante(p1, 'so-cafe'), participante(p2, 'completa'), {
      ...participante('saiu', 'completa'),
      participando: false,
    });

    expect(await iniciar()).toEqual({ cotasDevidas: 2, semValorDaCota: 0 });
    expect(await iniciar()).toEqual({ cotasDevidas: 0, semValorDaCota: 0 });
    expect(devidas).toEqual([
      { participanteId: p1, mes: '2026-11', tipoDeCota: 'so-cafe', valorEmCentavos: 2500 },
      { participanteId: p2, mes: '2026-11', tipoDeCota: 'completa', valorEmCentavos: 3000 },
    ]);
    expect(events).toMatchObject([
      { type: 'participation.contribution-due', payload: { participantId: p1 } },
      { type: 'participation.contribution-due', payload: { participantId: p2 } },
    ]);
  });

  it('RN-PAR-10: whoever enters during the month owes it on the next trigger', async () => {
    const valores = [{ tipoDeCota: 'so-cafe', ano: 2026, valorEmCentavos: 2500 }] as const;
    const { participantes, iniciar } = inMemory(valores);
    participantes.push(participante(p1, 'so-cafe'));
    await iniciar();
    participantes.push(participante(p2, 'so-cafe'));

    expect(await iniciar()).toEqual({ cotasDevidas: 1, semValorDaCota: 0 });
  });

  it('RN-PAR-11: a tipo de cota without a valor for the year leaves its participantes for a later trigger', async () => {
    const { participantes, devidas, iniciar } = inMemory([
      { tipoDeCota: 'so-cafe', ano: 2026, valorEmCentavos: 2500 },
    ]);
    participantes.push(participante(p1, 'so-cafe'), participante(p2, 'completa'));

    expect(await iniciar()).toEqual({ cotasDevidas: 1, semValorDaCota: 1 });
    expect(devidas.map((c) => c.participanteId)).toEqual([p1]);
  });
});
