import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { entrar } from './participante.js';

describe('entrar', () => {
  const agora = new Date('2026-11-01T03:00:00Z');
  const contexto = { eventId: '0b6f2f0e-6a1c-4c55-9a43-6f1f1b0c9e11', agora };
  const id = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';

  it('the person enters for the first time with the chosen tipo de cota and Participante entrou is published', () => {
    expect(entrar(undefined, { id, tipoDeCota: 'so-cafe' }, contexto)).toEqual({
      ok: true,
      value: {
        participante: { id, tipoDeCota: 'so-cafe', participando: true },
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

  it('returning is entering again, even with another tipo de cota', () => {
    const saiu = { id, tipoDeCota: 'so-cafe', participando: false } as const;
    const resultado = entrar(saiu, { id, tipoDeCota: 'completa' }, contexto);
    expect(resultado).toMatchObject({
      ok: true,
      value: {
        participante: { id, tipoDeCota: 'completa', participando: true },
        evento: { type: 'participation.participant-joined', payload: { participantId: id } },
      },
    });
  });

  it('cannot enter while already participando', () => {
    const participando = { id, tipoDeCota: 'completa', participando: true } as const;
    expect(entrar(participando, { id, tipoDeCota: 'completa' }, contexto)).toEqual({
      ok: false,
      error: 'ja-participando',
    });
  });

  it('Participante entrou follows the contract', () => {
    const ler = (arquivo: string) =>
      JSON.parse(
        readFileSync(new URL(`../../../../contracts/events/${arquivo}`, import.meta.url), 'utf8'),
      );
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);
    ajv.addSchema(ler('envelope.v1.json'));
    const validar = ajv.compile(ler('participation.participant-joined.v1.json'));
    const resultado = entrar(undefined, { id, tipoDeCota: 'completa' }, contexto);
    if (!resultado.ok) throw new Error(resultado.error);

    expect(validar(resultado.value.evento), ajv.errorsText(validar.errors)).toBe(true);
  });
});
