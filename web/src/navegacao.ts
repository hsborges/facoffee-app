import { matchPath } from 'react-router';
import type { Perfil } from './api';
import type { NomeDoIcone } from './icones';

/** A route, with its title. */
export type Rota = { readonly caminho: string; readonly titulo: string };

/** A link of the main navigation, with the subpáginas that leave from it (ADR 0034). */
export type Item = Rota & { readonly icone: NomeDoIcone; readonly subpaginas: readonly Rota[] };

const DO_PARTICIPANTE: readonly Item[] = [
  {
    caminho: '/',
    titulo: 'Minha situação',
    icone: 'usuario',
    // Desativar meu acesso opens from the menu da conta, and goes back to Minha situação.
    subpaginas: [
      { caminho: '/enviar-comprovante', titulo: 'Enviar comprovante' },
      { caminho: '/desativar-meu-acesso', titulo: 'Desativar meu acesso' },
    ],
  },
  {
    caminho: '/caixinha',
    titulo: 'Caixinha',
    icone: 'carteira',
    subpaginas: [{ caminho: '/caixinha/registrar-gasto', titulo: 'Registrar gasto' }],
  },
];

const DO_GESTOR: readonly Item[] = [
  {
    caminho: '/participantes',
    titulo: 'Participantes',
    icone: 'pessoas',
    subpaginas: [
      { caminho: '/participantes/conferir-comprovante', titulo: 'Conferir comprovante' },
      { caminho: '/participantes/receber-pagamento', titulo: 'Receber pagamento' },
    ],
  },
  {
    caminho: '/gastos',
    titulo: 'Gastos',
    icone: 'recibo',
    subpaginas: [
      { caminho: '/gastos/registrar-gasto', titulo: 'Registrar gasto' },
      { caminho: '/gastos/solicitar-complemento', titulo: 'Solicitar complemento' },
    ],
  },
  { caminho: '/valor-da-cota', titulo: 'Valor da cota', icone: 'etiqueta', subpaginas: [] },
];

/** The two visões of the web (ADR 0029): the gestor pages or the participante pages. */
export type Visao = 'gestor' | 'participante';

/** Main navigation of a visão; its first item is where the visão starts. */
export const navegacao = (visao: Visao): readonly Item[] =>
  visao === 'gestor' ? DO_GESTOR : DO_PARTICIPANTE;

/** A page of a visão, and the item of the menu it is under (its own, for a page of the menu). */
export type Pagina = Rota & { readonly menu: string };

/** Every page of a visão, each subpágina right after the page it leaves from. */
export const paginas = (visao: Visao): readonly Pagina[] =>
  navegacao(visao).flatMap(({ caminho, titulo, subpaginas }) => [
    { caminho, titulo, menu: caminho },
    ...subpaginas.map((subpagina) => ({ ...subpagina, menu: caminho })),
  ]);

// Same match as the <Route>s: trailing slash and any case.
const daVisao = (visao: Visao, caminho: string) =>
  paginas(visao).some((pagina) => matchPath(pagina.caminho, caminho));

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
