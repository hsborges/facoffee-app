import { describe, expect, it } from 'vitest';
import type { Event } from '../domain/event.js';
import type { ValorDaCota } from '../domain/tipo-de-cota.js';
import { definirValor, type ValoresDaCota } from './tipos-de-cota.js';

const clock = { now: () => new Date('2027-01-02T12:00:00Z'), newId: () => 'id-1' };
const gestor = { perfis: ['gestor'] };
const valor: ValorDaCota = { tipoDeCota: 'completa', ano: 2027, valorEmCentavos: 3000 };

const inMemory = () => {
  const salvos: ValorDaCota[] = [];
  const events: Event[] = [];
  const buscar: ValoresDaCota['buscar'] = async (tipoDeCota, ano) =>
    salvos.find((v) => v.tipoDeCota === tipoDeCota && v.ano === ano);
  const valores: ValoresDaCota = {
    buscar,
    salvar: async (v, newEvents) => {
      if (await buscar(v.tipoDeCota, v.ano)) return false;
      salvos.push(v);
      events.push(...newEvents);
      return true;
    },
  };
  return { salvos, events, definir: definirValor(valores, clock) };
};

describe('definirValor', () => {
  it('saves the valor together with Valor da cota definido', async () => {
    const { salvos, events, definir } = inMemory();

    expect(await definir(gestor, valor)).toEqual({ ok: true, value: undefined });
    expect(salvos).toEqual([valor]);
    expect(events).toMatchObject([{ id: 'id-1', type: 'participation.contribution-amount-set' }]);
  });

  it('refuses a second definition for the same tipo de cota and year, but not another tipo', async () => {
    const { events, definir } = inMemory();
    await definir(gestor, valor);

    expect(await definir(gestor, { ...valor, valorEmCentavos: 3500 })).toEqual({
      ok: false,
      error: 'valor-ja-definido',
    });
    expect(await definir(gestor, { ...valor, tipoDeCota: 'so-cafe' })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(events).toHaveLength(2);
  });

  it('refuses when a concurrent definition was saved first', async () => {
    const valores: ValoresDaCota = { buscar: async () => undefined, salvar: async () => false };
    expect(await definirValor(valores, clock)(gestor, valor)).toEqual({
      ok: false,
      error: 'valor-ja-definido',
    });
  });

  it('refuses and saves nothing for a participante who is not the gestor', async () => {
    const { salvos, definir } = inMemory();
    expect(await definir({ perfis: ['participante'] }, valor)).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
    expect(salvos).toEqual([]);
  });
});
