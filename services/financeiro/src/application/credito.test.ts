import { describe, expect, it } from 'vitest';
import type { Devido, Totais } from '../domain/credito.js';
import { consultarCreditoEPendente, listarCreditoEPendentes, listarPendentes } from './credito.js';

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
  it('RN-FIN-19: gives the gestor every participante, including who left', async () => {
    expect(await listarCreditoEPendentes(buscarTotais)({ perfis: ['gestor'] })).toEqual({
      ok: true,
      value: [
        { id: 'p-1', participando: true, creditoEmCentavos: 6000, pendenciaEmCentavos: 0 },
        { id: 'p-2', participando: false, creditoEmCentavos: 0, pendenciaEmCentavos: 6000 },
      ],
    });
  });

  it('RN-FIN-19: refuses whoever is not the gestor', async () => {
    expect(await listarCreditoEPendentes(buscarTotais)({ perfis: ['participante'] })).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
  });
});

describe('listarPendentes', () => {
  const comCota: Totais = { id: 'p-3', ativo: true, devidoEmCentavos: 9000, pagoEmCentavos: 1000 };
  const semCota: Totais = { id: 'p-4', ativo: true, devidoEmCentavos: 500, pagoEmCentavos: 0 };
  const buscar = async () => [adiantado, saiuDevendo, comCota, semCota];
  const cotas = async (id: string) =>
    id === 'p-3'
      ? {
          cotas: [
            { mes: '2026-11', tipoDeCota: 'completa' as const, valorEmCentavos: 3000 },
            { mes: '2026-10', tipoDeCota: 'completa' as const, valorEmCentavos: 3000 },
          ],
          complementos: [],
        }
      : { cotas: [], complementos: [] };

  it('RN-FIN-16, RN-NOT-07, RN-NOT-09: lists only the ativos pendentes, with their most recent cota; crédito and who left are out', async () => {
    expect(await listarPendentes(buscar, cotas)()).toEqual([
      {
        id: 'p-3',
        pendenciaEmCentavos: 8000,
        cota: { mes: '2026-11', tipoDeCota: 'completa', valorEmCentavos: 3000 },
      },
      { id: 'p-4', pendenciaEmCentavos: 500, cota: null },
    ]);
  });
});

describe('consultarCreditoEPendente', () => {
  it('RN-FIN-20: gives the participante only their own situação, with the cotas and complementos devidos', async () => {
    expect(await consultarCreditoEPendente(buscarTotais, buscarDevido)({ id: 'p-2' })).toEqual({
      ok: true,
      value: {
        id: 'p-2',
        participando: false,
        creditoEmCentavos: 0,
        pendenciaEmCentavos: 6000,
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
