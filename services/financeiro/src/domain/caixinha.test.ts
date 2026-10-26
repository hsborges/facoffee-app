import { describe, expect, it } from 'vitest';
import { anoAnterior, caixinha, caixinhaDoMes, saldoDaCaixinha } from './caixinha.js';

describe('saldoDaCaixinha', () => {
  it('RN-FIN-30: takes out gastos pagos pela caixinha and reembolsos, but not gastos do próprio bolso', () => {
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

  it('RN-FIN-30: goes negative when the gastos pela caixinha pass what was received', () => {
    expect(
      saldoDaCaixinha({
        recebidoEmCentavos: 1000,
        gastos: [{ origem: 'caixinha', valorEmCentavos: 4000 }],
        reembolsadoEmCentavos: 0,
      }),
    ).toBe(-3000);
  });
});

describe('caixinha', () => {
  it('RN-FIN-33: sums the gastos do ano anterior in total and per tipo de gasto, besides the saldo', () => {
    expect(
      caixinha({ recebidoEmCentavos: 5000, gastos: [], reembolsadoEmCentavos: 0 }, [
        { tipo: 'cafe', valorEmCentavos: 60000 },
        { tipo: 'reposicao', valorEmCentavos: 4000 },
        { tipo: 'cafe', valorEmCentavos: 500 },
      ]),
    ).toEqual({
      saldoEmCentavos: 5000,
      gastosDoAnoAnteriorEmCentavos: 64500,
      gastosDoAnoAnteriorPorTipoEmCentavos: {
        cafe: 60500,
        'outros-itens': 0,
        'conserto-e-manutencao': 0,
        reposicao: 4000,
      },
    });
  });
});

describe('caixinhaDoMes', () => {
  it('RN-FIN-31, RN-FIN-32: sums what left the caixinha per tipo de gasto, and the saldo no fim matches it', () => {
    expect(
      caixinhaDoMes(
        '2026-10',
        { recebidoEmCentavos: 10000, saidas: [{ tipo: 'cafe', valorEmCentavos: 4000 }] },
        {
          recebidoEmCentavos: 7500,
          saidas: [
            { tipo: 'cafe', valorEmCentavos: 2000 },
            { tipo: 'conserto-e-manutencao', valorEmCentavos: 3000 },
            { tipo: 'cafe', valorEmCentavos: 500 },
          ],
        },
      ),
    ).toEqual({
      mes: '2026-10',
      saldoNoInicioEmCentavos: 6000,
      recebidoEmCentavos: 7500,
      gastosPorTipoEmCentavos: {
        cafe: 2500,
        'outros-itens': 0,
        'conserto-e-manutencao': 3000,
        reposicao: 0,
      },
      saldoNoFimEmCentavos: 8000,
    });
  });
});

describe('anoAnterior', () => {
  it('RNF-03: turns the year at midnight in Campo Grande, not in UTC', () => {
    expect(anoAnterior(new Date('2027-01-01T03:59:59Z'))).toBe(2025);
    expect(anoAnterior(new Date('2027-01-01T04:00:00Z'))).toBe(2026);
  });
});
