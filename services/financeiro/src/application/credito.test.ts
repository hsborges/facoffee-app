import { describe, expect, it } from 'vitest';
import type { Devido, Totais } from '../domain/credito.js';
import { consultarCreditoEPendente, listarCreditoEPendentes } from './credito.js';

const adiantado: Totais = { id: 'p-1', ativo: true, devidoEmCentavos: 3000, pagoEmCentavos: 9000 };
const saiuDevendo: Totais = { id: 'p-2', ativo: false, devidoEmCentavos: 6000, pagoEmCentavos: 0 };
const todos = [adiantado, saiuDevendo];
const buscarTotais = async (id?: string) => todos.filter((t) => id === undefined || t.id === id);
const devido: Devido = {
  cotas: [{ mes: '2026-11', tipoDeCota: 'completa', valorEmCentavos: 3000 }],
  complementos: [
    { id: 'c-1', solicitadoEm: new Date('2026-11-20T15:00:00Z'), parteEmCentavos: 3000 },
  ],
};
const buscarDevido = async (id: string) =>
  id === 'p-2' ? devido : { cotas: [], complementos: [] };

describe('listarCreditoEPendentes', () => {
  it('gives the gestor every participante, including who left', async () => {
    expect(await listarCreditoEPendentes(buscarTotais)({ perfis: ['gestor'] })).toEqual({
      ok: true,
      value: [
        { id: 'p-1', ativo: true, creditoEmCentavos: 6000, pendenteEmCentavos: 0 },
        { id: 'p-2', ativo: false, creditoEmCentavos: 0, pendenteEmCentavos: 6000 },
      ],
    });
  });

  it('refuses whoever is not the gestor', async () => {
    expect(await listarCreditoEPendentes(buscarTotais)({ perfis: ['participante'] })).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
  });
});

describe('consultarCreditoEPendente', () => {
  it('gives the participante only their own situação, with the cotas and complementos devidos', async () => {
    expect(await consultarCreditoEPendente(buscarTotais, buscarDevido)({ id: 'p-2' })).toEqual({
      ok: true,
      value: {
        id: 'p-2',
        ativo: false,
        creditoEmCentavos: 0,
        pendenteEmCentavos: 6000,
        ...devido,
      },
    });
  });

  it('does not find someone Financeiro does not know', async () => {
    expect(await consultarCreditoEPendente(buscarTotais, buscarDevido)({ id: 'p-3' })).toEqual({
      ok: false,
      error: 'participante-nao-encontrado',
    });
  });
});
