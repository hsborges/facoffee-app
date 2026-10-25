import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { expect, it } from 'vitest';
import { entrar, sair } from './participante.js';
import { definirValorDaCota } from './tipo-de-cota.js';

const ler = (arquivo: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../../contracts/events/${arquivo}`, import.meta.url), 'utf8'),
  );
const ajv = new Ajv({ strict: false });
addFormats(ajv);
ajv.addSchema(ler('envelope.v1.json'));

const contexto = {
  eventId: '0b6f2f0e-6a1c-4c55-9a43-6f1f1b0c9e11',
  agora: new Date('2026-11-01T03:00:00Z'),
};
const id = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const evento = <T>(
  resultado: { ok: true; value: { evento: T } } | { ok: false; error: string },
) => {
  if (!resultado.ok) throw new Error(resultado.error);
  return resultado.value.evento;
};

it.each([
  [
    'participation.participant-joined.v1.json',
    evento(entrar(undefined, { id, tipoDeCota: 'completa' }, contexto)),
  ],
  [
    'participation.participant-left.v1.json',
    evento(sair({ id, tipoDeCota: 'completa', participando: true, troca: null }, contexto)),
  ],
  [
    'participation.contribution-amount-set.v1.json',
    evento(
      definirValorDaCota(
        undefined,
        { perfis: ['gestor'] },
        { tipoDeCota: 'completa', ano: 2026, valorEmCentavos: 3000 },
        contexto,
      ),
    ),
  ],
])('the event follows %s', (contrato, evento) => {
  const validar = ajv.compile(ler(contrato));
  expect(validar(evento), ajv.errorsText(validar.errors)).toBe(true);
});
