import { describe, expect, it } from 'vitest';
import { consultarCaixinha, consultarCaixinhaDoAno } from './caixinha.js';

describe('consultarCaixinha', () => {
  it('gives the saldo and the gastos of the year before the current one in Campo Grande', async () => {
    const anos: number[] = [];
    const consultar = consultarCaixinha(
      {
        totais: async () => ({
          recebidoEmCentavos: 9000,
          gastos: [
            { origem: 'caixinha', valorEmCentavos: 2000 },
            { origem: 'proprio-bolso', valorEmCentavos: 4590 },
          ],
          reembolsadoEmCentavos: 4590,
        }),
        gastosDoAno: async (ano) => {
          anos.push(ano);
          return [
            { tipo: 'cafe', valorEmCentavos: 100000 },
            { tipo: 'outros-itens', valorEmCentavos: 23456 },
          ];
        },
        movimento: async () => ({ recebidoEmCentavos: 0, saidas: [] }),
      },
      { now: () => new Date('2027-01-01T03:00:00Z') },
    );
    expect(await consultar()).toEqual({
      saldoEmCentavos: 2410,
      gastosDoAnoAnteriorEmCentavos: 123456,
      gastosDoAnoAnteriorPorTipoEmCentavos: {
        cafe: 100000,
        'outros-itens': 23456,
        'conserto-e-manutencao': 0,
        reposicao: 0,
      },
    });
    expect(anos).toEqual([2025]);
  });
});

describe('consultarCaixinhaDoAno', () => {
  it('RN-FIN-31: gives the caixinha of the year from the movimento before it and in it', async () => {
    const consultar = consultarCaixinhaDoAno({
      totais: async () => ({ recebidoEmCentavos: 0, gastos: [], reembolsadoEmCentavos: 0 }),
      gastosDoAno: async () => [],
      movimento: async (ano, periodo) =>
        ano !== 2026
          ? { recebidoEmCentavos: 0, saidas: [] }
          : periodo === 'antes'
            ? { recebidoEmCentavos: 5000, saidas: [] }
            : { recebidoEmCentavos: 1000, saidas: [{ tipo: 'reposicao', valorEmCentavos: 700 }] },
    });
    expect(await consultar(2026)).toMatchObject({
      saldoNoInicioEmCentavos: 5000,
      recebidoEmCentavos: 1000,
      saldoNoFimEmCentavos: 5300,
    });
  });
});
