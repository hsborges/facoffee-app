import { describe, expect, it } from 'vitest';
import { situacao } from './credito.js';

const totais = { id: 'p-1', ativo: true, devidoEmCentavos: 6000, pagoEmCentavos: 6000 };

describe('situacao', () => {
  it('is neither crédito nor pendente when the pagamentos cover the cotas exactly', () => {
    expect(situacao(totais)).toEqual({
      id: 'p-1',
      ativo: true,
      creditoEmCentavos: 0,
      pendenteEmCentavos: 0,
    });
  });

  it('turns a pagamento adiantado into crédito', () => {
    expect(situacao({ ...totais, pagoEmCentavos: 18000 })).toMatchObject({
      creditoEmCentavos: 12000,
      pendenteEmCentavos: 0,
    });
  });

  it('is pendente by exactly what is missing, without multa or juros', () => {
    expect(situacao({ ...totais, pagoEmCentavos: 1000 })).toMatchObject({
      creditoEmCentavos: 0,
      pendenteEmCentavos: 5000,
    });
  });

  it('keeps crédito and pendência of whoever left', () => {
    expect(situacao({ ...totais, ativo: false, pagoEmCentavos: 9000 })).toEqual({
      id: 'p-1',
      ativo: false,
      creditoEmCentavos: 3000,
      pendenteEmCentavos: 0,
    });
  });
});
