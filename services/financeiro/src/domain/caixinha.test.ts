import { describe, expect, it } from 'vitest';
import { anoAnterior, saldoDaCaixinha } from './caixinha.js';

describe('saldoDaCaixinha', () => {
  it('takes out gastos pagos pela caixinha and reembolsos, but not gastos do próprio bolso', () => {
    expect(
      saldoDaCaixinha({
        recebidoEmCentavos: 10000,
        gastos: [
          { origem: 'caixinha', valorEmCentavos: 3000 },
          { origem: 'proprio-bolso', valorEmCentavos: 2500 },
        ],
        reembolsadoEmCentavos: 1500,
      }),
    ).toBe(5500);
  });

  it('goes negative when the gastos pela caixinha pass what was received', () => {
    expect(
      saldoDaCaixinha({
        recebidoEmCentavos: 1000,
        gastos: [{ origem: 'caixinha', valorEmCentavos: 4000 }],
        reembolsadoEmCentavos: 0,
      }),
    ).toBe(-3000);
  });
});

describe('anoAnterior', () => {
  it('turns the year at midnight in Campo Grande, not in UTC', () => {
    expect(anoAnterior(new Date('2027-01-01T03:59:59Z'))).toBe(2025);
    expect(anoAnterior(new Date('2027-01-01T04:00:00Z'))).toBe(2026);
  });
});
