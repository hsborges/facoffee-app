/** A month, as `AAAA-MM`; months compare correctly as strings. */
export type Mes = string;

// Months and years turn at midnight in Campo Grande, where the copa is (ADR 0015).
const formatoDoMes = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Campo_Grande',
  year: 'numeric',
  month: '2-digit',
});

/** The month of an instant in Campo Grande time. */
export const mesDe = (instante: Date): Mes => formatoDoMes.format(instante);

/** The year of an instant in Campo Grande time. */
export const anoDe = (instante: Date): number => Number(mesDe(instante).slice(0, 4));

/** The month after `mes`. */
export const mesSeguinte = (mes: Mes): Mes => {
  const [ano, numero] = mes.split('-').map(Number) as [number, number];
  return numero === 12 ? `${ano + 1}-01` : `${ano}-${String(numero + 1).padStart(2, '0')}`;
};
