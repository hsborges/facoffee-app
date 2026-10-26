import { matchPath } from 'react-router';
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

/** The two visões of the web (ADR 0029): the gestor pages or the participante pages. */
export type Visao = 'gestor' | 'participante';

/** Main navigation of a visão; its first item is where the visão starts. */
export const navegacao = (visao: Visao): readonly Item[] =>
  visao === 'gestor' ? DO_GESTOR : DO_PARTICIPANTE;

// Same match as the <Route>s: trailing slash and any case.
const daVisao = (visao: Visao, caminho: string) =>
  navegacao(visao).some((item) => matchPath(item.caminho, caminho));

/**
 * Visão to show, or `undefined` while the gestor has not chosen one. Whoever is not gestor always
 * sees the participante pages, where whoever does not participate yet asks to join. The gestor
 * sees the visão of the page opened, else the one chosen. The API still checks the perfil.
 */
export const visaoAtual = (
  perfis: readonly Perfil[],
  escolhida: Visao | undefined,
  caminho: string,
): Visao | undefined => {
  if (!perfis.includes('gestor')) return 'participante';
  if (!escolhida) return undefined;
  if (daVisao('gestor', caminho)) return 'gestor';
  if (daVisao('participante', caminho)) return 'participante';
  return escolhida;
};

/**
 * Visão kept in the tab (`sessionStorage`), or `undefined` on a new login, when the gestor chooses
 * again, and for anything that is not a visão.
 */
export const visaoGuardada = (novoLogin: boolean, guardada: string | null): Visao | undefined =>
  !novoLogin && (guardada === 'gestor' || guardada === 'participante') ? guardada : undefined;

/**
 * Page to open after the login: the path kept in the OIDC `state` when the login started.
 * Anything but a path of this origin (`//host`, `/\host`, a URL) goes to the start.
 */
export const destinoDoLogin = (estado: unknown): string =>
  typeof estado === 'string' && /^\/(?![/\\])/.test(estado) ? estado : '/';
