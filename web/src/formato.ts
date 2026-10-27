import type { TipoDeCota, TipoDeGasto } from './api';

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Centavos as reais: `R$ 30,00`. */
export const emReais = (centavos: number) => reais.format(centavos / 100);

/** A valor field read as centavos: its digits, the last two the centavos (`R$ 45,90` is `4590`). */
export const emCentavos = (campo: string) => Number(campo.replace(/\D/g, ''));

// The most a valor takes: the API keeps centavos in a 32-bit integer.
const MAXIMO_EM_CENTAVOS = 2_147_483_647;

/**
 * Input mask of a valor in reais: the digits fill it from the centavos, as in bank apps (`4`,
 * `45`, `459`, `4590` show `R$ 45,90`), and erasing takes them back. Without a valor it is empty,
 * so a required field asks for one; past the most the API takes, it stays at the most.
 */
export const mascaraDeReais = (campo: string) => {
  const centavos = Math.min(emCentavos(campo), MAXIMO_EM_CENTAVOS);
  return centavos > 0 ? emReais(centavos) : '';
};

// The day 1 at UTC, formatted at UTC: the month does not move with the browser time zone.
const meses = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** A month `AAAA-MM` by name: `novembro de 2026`. */
export const mesPorExtenso = (mes: string) => meses.format(new Date(`${mes}-01T00:00:00Z`));

const nomesDosMeses = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });

/** Only the name of a month `AAAA-MM`: `novembro`. */
export const nomeDoMes = (mes: string) => nomesDosMeses.format(new Date(`${mes}-01T00:00:00Z`));

/** The month `AAAA-MM` that many months after (or, if negative, before) `mes`. */
export const outroMes = (mes: string, meses: number) => {
  const dia = new Date(`${mes}-01T00:00:00Z`);
  dia.setUTCMonth(dia.getUTCMonth() + meses);
  return dia.toISOString().slice(0, 7);
};

const mesesEmCampoGrande = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Campo_Grande',
  year: 'numeric',
  month: '2-digit',
});

/** The month `AAAA-MM` of an instant in Campo Grande, where the copa is (ADR 0015). */
export const mesEmCampoGrande = (instante: Date) => mesesEmCampoGrande.format(instante);

// Days turn at midnight in Campo Grande, where the copa is (ADR 0015).
const datas = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Campo_Grande' });

/** The day of an instant (ISO 8601) in Campo Grande: `20/11/2026`. */
export const dataEmCampoGrande = (instante: string) => datas.format(new Date(instante));

/** Initials of the first and the last name, for the avatar: `Ana Maria Souza` is `AS`. */
export const iniciais = (nome: string) => {
  const nomes = nome.trim().split(/\s+/);
  return [nomes[0], nomes.length > 1 ? nomes.at(-1) : '']
    .map((parte) => parte?.[0] ?? '')
    .join('')
    .toUpperCase();
};

/** Name of each tipo de cota. */
export const NOME_DO_TIPO_DE_COTA: Readonly<Record<TipoDeCota, string>> = {
  'so-cafe': 'Só café',
  completa: 'Completa',
};

/** What each tipo de cota includes. */
export const ITENS_DO_TIPO_DE_COTA: Readonly<Record<TipoDeCota, string>> = {
  'so-cafe': 'Café.',
  completa: 'Café, bolachas, chás e os demais itens da copa.',
};

/** Name of each tipo de gasto, with what it covers. */
export const NOME_DO_TIPO_DE_GASTO: Readonly<Record<TipoDeGasto, string>> = {
  cafe: 'Café',
  'outros-itens': 'Outros itens da copa',
  'conserto-e-manutencao': 'Conserto e manutenção',
  reposicao: 'Reposição de itens quebrados',
};
