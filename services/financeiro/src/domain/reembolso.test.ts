import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Gasto } from './gasto.js';
import { reembolsar } from './reembolso.js';

const contrato = JSON.parse(
  readFileSync(
    new URL('../../../../contracts/events/finance.reimbursement-made.v1.json', import.meta.url),
    'utf8',
  ),
).examples[0];

const gestor = { perfis: ['participante', 'gestor'] };
const contexto = {
  reembolsoId: contrato.payload.reimbursementId,
  eventId: contrato.id,
  agora: new Date(contrato.occurredAt),
};
const doBolso: Gasto = {
  id: contrato.payload.expenseId,
  participanteId: contrato.payload.participantId,
  valorEmCentavos: contrato.payload.amountInCents,
  origem: 'proprio-bolso',
  tipo: 'conserto-e-manutencao',
  notaId: '11111111-1111-4111-8111-111111111111',
  feitoEm: new Date('2026-10-30T12:00:00Z'),
};

describe('reembolsar', () => {
  it('RN-FIN-24: reembolsa who paid the gasto do próprio bolso and produces Reembolso feito as in the contract', () => {
    expect(reembolsar(gestor, doBolso, contexto)).toEqual({
      ok: true,
      value: {
        reembolso: { id: contexto.reembolsoId, gastoId: doBolso.id, feitoEm: contexto.agora },
        evento: { ...contrato, occurredAt: contexto.agora.toISOString() },
      },
    });
  });

  it('RN-FIN-24: refuses a gasto pago pela caixinha: its money already left the caixinha', () => {
    expect(reembolsar(gestor, { ...doBolso, origem: 'caixinha' }, contexto)).toEqual({
      ok: false,
      error: 'gasto-pago-pela-caixinha',
    });
  });

  it('RN-FIN-25: only the gestor reembolsa', () => {
    expect(reembolsar({ perfis: ['participante'] }, doBolso, contexto)).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
  });
});
