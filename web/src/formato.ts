import type { TipoDeCota } from './api';

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Centavos as reais: `R$ 30,00`. */
export const emReais = (centavos: number) => reais.format(centavos / 100);

/** Reais as typed in a number input (`45.9`) as centavos: `4590`. */
export const emCentavos = (reais: string) => Math.round(Number(reais) * 100);

// The day 1 at UTC, formatted at UTC: the month does not move with the browser time zone.
const meses = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** A month `AAAA-MM` by name: `novembro de 2026`. */
export const mesPorExtenso = (mes: string) => meses.format(new Date(`${mes}-01T00:00:00Z`));

// Days turn at midnight in Campo Grande, where the copa is (ADR 0015).
const datas = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Campo_Grande' });

/** The day of an instant (ISO 8601) in Campo Grande: `20/11/2026`. */
export const dataEmCampoGrande = (instante: string) => datas.format(new Date(instante));

/** Name of each tipo de cota. */
export const NOME_DO_TIPO_DE_COTA: Readonly<Record<TipoDeCota, string>> = {
  'so-cafe': 'Só café',
  completa: 'Completa',
};
