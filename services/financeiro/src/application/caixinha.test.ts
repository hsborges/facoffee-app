import { describe, expect, it } from 'vitest';
import { consultarCaixinha } from './caixinha.js';

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
          return 123456;
        },
      },
      { now: () => new Date('2027-01-01T03:00:00Z') },
    );
    expect(await consultar()).toEqual({
      saldoEmCentavos: 2410,
      gastosDoAnoAnteriorEmCentavos: 123456,
    });
    expect(anos).toEqual([2025]);
  });
});
