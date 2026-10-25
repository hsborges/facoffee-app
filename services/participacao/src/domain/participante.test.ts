import { describe, expect, it } from 'vitest';
import {
  entrar,
  type Participante,
  participanteNoMes,
  sair,
  tipoDeCotaNoMes,
  trocarTipoDeCota,
} from './participante.js';

const agora = new Date('2026-11-01T03:00:00Z');
const contexto = { eventId: '0b6f2f0e-6a1c-4c55-9a43-6f1f1b0c9e11', agora };
const id = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const participando: Participante = { id, tipoDeCota: 'so-cafe', participando: true, troca: null };

describe('entrar', () => {
  it('the person enters for the first time with the chosen tipo de cota and Participante entrou is published', () => {
    expect(entrar(undefined, { id, tipoDeCota: 'so-cafe' }, contexto)).toEqual({
      ok: true,
      value: {
        participante: { id, tipoDeCota: 'so-cafe', participando: true, troca: null },
        evento: {
          id: contexto.eventId,
          type: 'participation.participant-joined',
          version: 1,
          occurredAt: '2026-11-01T03:00:00.000Z',
          payload: { participantId: id },
        },
      },
    });
  });

  it('returning is entering again, even with another tipo de cota, dropping an old troca', () => {
    const saiu: Participante = {
      ...participando,
      participando: false,
      troca: { tipoDeCota: 'completa', aPartirDe: '2026-03' },
    };
    const resultado = entrar(saiu, { id, tipoDeCota: 'completa' }, contexto);
    expect(resultado).toMatchObject({
      ok: true,
      value: {
        participante: { id, tipoDeCota: 'completa', participando: true, troca: null },
        evento: { type: 'participation.participant-joined', payload: { participantId: id } },
      },
    });
  });

  it('cannot enter while already participando', () => {
    expect(entrar(participando, { id, tipoDeCota: 'completa' }, contexto)).toEqual({
      ok: false,
      error: 'ja-participando',
    });
  });
});

describe('trocarTipoDeCota', () => {
  // 2026-10-15 in Campo Grande: the troca takes effect in 2026-11.
  const emOutubro = new Date('2026-10-15T15:00:00Z');

  const trocar = (atual: Participante | undefined, agora = emOutubro) => {
    const resultado = trocarTipoDeCota(atual, 'completa', agora);
    if (!resultado.ok) throw new Error(resultado.error);
    return resultado.value;
  };

  it('the cota of the current month keeps the tipo; the next month uses the new one', () => {
    const trocado = trocar(participando);

    expect(trocado.troca).toEqual({ tipoDeCota: 'completa', aPartirDe: '2026-11' });
    expect(tipoDeCotaNoMes(trocado, '2026-10')).toBe('so-cafe');
    expect(tipoDeCotaNoMes(trocado, '2026-11')).toBe('completa');
    expect(tipoDeCotaNoMes(trocado, '2027-01')).toBe('completa');
  });

  it('turns months in Campo Grande time and from December to January', () => {
    // Still October 31 in Campo Grande (UTC-4).
    expect(trocar(participando, new Date('2026-11-01T03:59:59Z')).troca?.aPartirDe).toBe('2026-11');
    expect(trocar(participando, new Date('2026-11-01T04:00:00Z')).troca?.aPartirDe).toBe('2026-12');
    expect(trocar(participando, new Date('2026-12-20T12:00:00Z')).troca?.aPartirDe).toBe('2027-01');
  });

  it('asking for the current tipo cancels a pending troca', () => {
    const cancelado = trocarTipoDeCota(trocar(participando), 'so-cafe', emOutubro);
    expect(cancelado).toEqual({ ok: true, value: participando });
  });

  it('a troca already in effect becomes the tipo de cota before the next one', () => {
    const trocado = trocar(participando);
    const emDezembro = new Date('2026-12-10T12:00:00Z');

    expect(trocarTipoDeCota(trocado, 'so-cafe', emDezembro)).toEqual({
      ok: true,
      value: {
        ...participando,
        tipoDeCota: 'completa',
        troca: { tipoDeCota: 'so-cafe', aPartirDe: '2027-01' },
      },
    });
  });

  it('only who is participando can trocar', () => {
    for (const atual of [undefined, { ...participando, participando: false }]) {
      expect(trocarTipoDeCota(atual, 'completa', emOutubro)).toEqual({
        ok: false,
        error: 'nao-participando',
      });
    }
  });
});

describe('sair', () => {
  it('ends the participação and produces Participante saiu', () => {
    expect(sair(participando, contexto)).toEqual({
      ok: true,
      value: {
        participante: { ...participando, participando: false },
        evento: {
          id: contexto.eventId,
          type: 'participation.participant-left',
          version: 1,
          occurredAt: '2026-11-01T03:00:00.000Z',
          payload: { participantId: id },
        },
      },
    });
  });

  it('who is not participando cannot leave', () => {
    for (const atual of [undefined, { ...participando, participando: false }]) {
      expect(sair(atual, contexto)).toEqual({ ok: false, error: 'nao-participando' });
    }
  });
});

describe('participanteNoMes', () => {
  const trocado: Participante = {
    ...participando,
    troca: { tipoDeCota: 'completa', aPartirDe: '2026-11' },
  };

  it('keeps the troca while it waits for its month', () => {
    expect(participanteNoMes(trocado, '2026-10')).toEqual(trocado);
  });

  it('drops the troca of whoever left, since entering again drops it too', () => {
    expect(participanteNoMes({ ...trocado, participando: false }, '2026-10')).toEqual({
      ...participando,
      participando: false,
    });
  });

  it('shows the tipo de cota of the troca once it takes effect, without the troca', () => {
    for (const mes of ['2026-11', '2027-01']) {
      expect(participanteNoMes(trocado, mes)).toEqual({
        ...participando,
        tipoDeCota: 'completa',
        troca: null,
      });
    }
  });
});
