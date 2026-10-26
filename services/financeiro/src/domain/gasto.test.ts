import { describe, expect, it } from 'vitest';
import { type Gasto, saidaDaCaixinha } from './gasto.js';

const gasto: Gasto = {
  id: '3f1c2a9e-8b7d-4e6f-9a10-2b3c4d5e6f70',
  participanteId: '2b3c4d5e-6f70-4a81-9b2c-3d4e5f6a7b8c',
  valorEmCentavos: 4590,
  origem: 'caixinha',
  tipo: 'cafe',
  notaId: '11111111-1111-4111-8111-111111111111',
  feitoEm: new Date('2026-11-01T03:00:00Z'),
};

describe('saidaDaCaixinha', () => {
  it('RN-FIN-24: takes the valor of a gasto pago pela caixinha out of the caixinha', () => {
    expect(saidaDaCaixinha(gasto)).toBe(4590);
  });

  it('RN-FIN-24: takes nothing out for a gasto pago do próprio bolso; only the reembolso does', () => {
    expect(saidaDaCaixinha({ ...gasto, origem: 'proprio-bolso' })).toBe(0);
  });
});
