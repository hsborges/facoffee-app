import type { Perfil } from './api';

/** A link of the main navigation; each one is also a route. */
export type Item = { readonly caminho: string; readonly titulo: string };

const DO_PARTICIPANTE: readonly Item[] = [
  { caminho: '/', titulo: 'Minha situação' },
  { caminho: '/caixinha', titulo: 'Caixinha' },
];

const DO_GESTOR: readonly Item[] = [
  { caminho: '/participantes', titulo: 'Participantes' },
  { caminho: '/gastos', titulo: 'Gastos' },
  { caminho: '/valor-da-cota', titulo: 'Valor da cota' },
];

/**
 * Main navigation by perfil. Everyone sees the participante pages, where whoever does not
 * participate yet asks to join; the gestor also sees theirs. The API still checks the perfil.
 */
export const navegacao = (perfis: readonly Perfil[]): readonly Item[] =>
  perfis.includes('gestor') ? [...DO_PARTICIPANTE, ...DO_GESTOR] : DO_PARTICIPANTE;
