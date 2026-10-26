import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dividir, solicitar } from './complemento.js';

const contrato = JSON.parse(
  readFileSync(
    new URL('../../../../contracts/events/finance.top-up-requested.v1.json', import.meta.url),
    'utf8',
  ),
).examples[0];

const gestor = { perfis: ['participante', 'gestor'] };
const contexto = {
  complementoId: contrato.payload.topUpId,
  eventId: contrato.id,
  agora: new Date(contrato.occurredAt),
};
const ativos: string[] = contrato.payload.shares.map(
  (s: { participantId: string }) => s.participantId,
);

describe('dividir', () => {
  it('RN-FIN-28: splits in partes iguais and the centavos left over go one each, so none is lost', () => {
    const partes = dividir(1000, ['a', 'b', 'c']);
    expect(partes.map((p) => p.valorEmCentavos)).toEqual([334, 333, 333]);
    expect(partes.reduce((total, p) => total + p.valorEmCentavos, 0)).toBe(1000);
  });

  it('never loses a centavo, whatever the valor and the number of participantes', () => {
    for (let n = 1; n <= 13; n++) {
      for (const valor of [n, n + 1, 1001, 99_999, 2_147_483_647]) {
        const partes = dividir(
          valor,
          Array.from({ length: n }, (_, i) => `p-${i}`),
        );
        const valores = partes.map((p) => p.valorEmCentavos);
        expect(valores.reduce((total, v) => total + v, 0)).toBe(valor);
        expect(Math.max(...valores) - Math.min(...valores)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('solicitar', () => {
  it('RN-FIN-28, RN-FIN-29: divides among the participantes ativos and produces Complemento solicitado as in the contract', () => {
    expect(solicitar(gestor, contrato.payload.totalAmountInCents, ativos, contexto)).toEqual({
      ok: true,
      value: {
        complemento: {
          id: contexto.complementoId,
          valorTotalEmCentavos: 1001,
          partes: [
            { participanteId: ativos[0], valorEmCentavos: 501 },
            { participanteId: ativos[1], valorEmCentavos: 500 },
          ],
          solicitadoEm: contexto.agora,
        },
        evento: { ...contrato, occurredAt: contexto.agora.toISOString() },
      },
    });
  });

  it('RN-FIN-27: only the gestor solicita', () => {
    expect(solicitar({ perfis: ['participante'] }, 1001, ativos, contexto)).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
  });

  it('RN-FIN-28: needs someone ativo and at least one centavo per parte', () => {
    expect(solicitar(gestor, 1001, [], contexto)).toEqual({
      ok: false,
      error: 'sem-participantes-ativos',
    });
    expect(solicitar(gestor, 1, ativos, contexto)).toEqual({
      ok: false,
      error: 'parte-menor-que-um-centavo',
    });
  });
});
