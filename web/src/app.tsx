import { type ReactNode, useEffect, useState } from 'react';
import { hasAuthParams, useAuth } from 'react-oidc-context';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router';
import logo from '../../infra/keycloak/themes/facoffee/login/resources/img/facoffee-logo.svg';
import { obterUsuarioLogado, type UsuarioLogado } from './api';
import { iniciais } from './formato';
import { Gastos, Participantes, SolicitarComplemento, ValorDaCota } from './gestor';
import { PaginaInicial } from './inicial';
import { navegacao, type Visao, visaoAtual, visaoGuardada } from './navegacao';
import { Caixinha, MinhaSituacao } from './participante';

const Pagina = ({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) => {
  useEffect(() => {
    document.title = `${titulo} · FACOFFEE`;
  }, [titulo]);
  return (
    <>
      <h1 data-testid={`pagina-${id}`}>{titulo}</h1>
      {children}
    </>
  );
};

const Aviso = ({ children }: { children: ReactNode }) => (
  <main className="aviso">
    <h1>
      <img src={logo} alt="FACOFFEE" width={240} />
    </h1>
    {children}
  </main>
);

const VISAO = 'facoffee.visao';

const inicio = (visao: Visao) => navegacao(visao)[0]?.caminho ?? '/';

// Names the page in its data-testid: `/` is Minha situação.
const idDaPagina = (caminho: string) => (caminho === '/' ? 'minha-situacao' : caminho.slice(1));

/**
 * Shows the start page to whoever is not logged in (ADR 0025); after the login through the
 * Keycloak (OIDC, ADR 0019), reads the logged-in usuário from the gateway and shows the layout
 * in the visão of their perfis; the gestor chooses it after the login (ADR 0029).
 */
export const App = () => {
  const auth = useAuth();
  // Keeps the page asked for, to return to it after the login (destinoDoLogin).
  const entrar = { state: location.pathname + location.search };
  const { isAuthenticated, isLoading, error } = auth;
  const token = auth.user?.access_token;
  const [eu, setEu] = useState<UsuarioLogado>();
  // Kept across reloads of the tab; a new login chooses again.
  const [escolhida, setEscolhida] = useState(() => {
    const guardada = visaoGuardada(hasAuthParams(), sessionStorage.getItem(VISAO));
    if (!guardada) sessionStorage.removeItem(VISAO);
    return guardada;
  });
  const guardar = (visao: Visao) => {
    sessionStorage.setItem(VISAO, visao);
    setEscolhida(visao);
  };
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;
    let atual = true;
    obterUsuarioLogado(token).then((resultado) => atual && setEu(resultado));
    return () => {
      atual = false;
    };
  }, [token]);

  const sair = () => auth.signoutRedirect();

  // A failed silent renew keeps the page while the current token is still valid.
  if (error && !isAuthenticated)
    return (
      <Aviso>
        <p role="alert">Não foi possível entrar no FACOFFEE.</p>
        <button type="button" onClick={() => auth.signinRedirect(entrar)}>
          Tentar de novo
        </button>
      </Aviso>
    );
  if (!isAuthenticated && !isLoading)
    return <PaginaInicial entrar={() => auth.signinRedirect(entrar)} />;
  if (!isAuthenticated || !token || !eu)
    return (
      <Aviso>
        <p role="status" data-testid="carregando">
          Carregando…
        </p>
      </Aviso>
    );
  if (eu.situacao === 'desativado')
    return (
      <Aviso>
        <p role="alert" data-testid="acesso-desativado">
          Seu acesso ao FACOFFEE foi desativado.
        </p>
        <button type="button" onClick={sair}>
          Sair
        </button>
      </Aviso>
    );
  if (eu.situacao === 'erro')
    return (
      <Aviso>
        <p role="alert">Não foi possível carregar o FACOFFEE.</p>
        <div className="acoes">
          <button type="button" onClick={() => location.reload()}>
            Tentar de novo
          </button>
          <button type="button" className="fantasma" onClick={sair}>
            Sair
          </button>
        </div>
      </Aviso>
    );

  const visao = visaoAtual(eu.usuario.perfis, escolhida, pathname);
  if (!visao) {
    const escolher = (nova: Visao) => {
      guardar(nova);
      if (visaoAtual(eu.usuario.perfis, nova, pathname) !== nova) navigate(inicio(nova));
    };
    return (
      <Aviso>
        <p>Como você quer usar o FACOFFEE agora? Dá para trocar a qualquer momento no menu.</p>
        <div className="acoes">
          <button type="button" data-testid="visao-gestor" onClick={() => escolher('gestor')}>
            Visão do gestor
          </button>
          <button
            type="button"
            data-testid="visao-participante"
            onClick={() => escolher('participante')}
          >
            Visão do participante
          </button>
          <button type="button" className="fantasma" onClick={sair}>
            Sair
          </button>
        </div>
      </Aviso>
    );
  }

  const itens = navegacao(visao);
  const outra = visao === 'gestor' ? 'participante' : 'gestor';
  const paginas: Readonly<Record<string, ReactNode>> = {
    '/': <MinhaSituacao token={token} usuarioId={eu.usuario.id} sair={sair} />,
    '/caixinha': <Caixinha token={token} />,
    '/participantes': <Participantes token={token} usuarioId={eu.usuario.id} />,
    '/gastos': (
      <>
        <Gastos token={token} />
        <SolicitarComplemento token={token} />
      </>
    ),
    '/valor-da-cota': <ValorDaCota token={token} />,
  };
  return (
    <>
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="topo">
        <img src={logo} alt="FACOFFEE" />
        <nav aria-label="Principal">
          <ul>
            {itens.map(({ caminho, titulo }) => (
              <li key={caminho}>
                <NavLink to={caminho} end data-testid={`menu-${idDaPagina(caminho)}`}>
                  {titulo}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          className="secundario avatar"
          data-testid="abrir-conta"
          popoverTarget="conta"
          aria-label={`${iniciais(eu.usuario.nome)}, conta de ${eu.usuario.nome}`}
        >
          {iniciais(eu.usuario.nome)}
        </button>
        <div id="conta" className="conta" popover="auto" data-testid="conta">
          <p>{eu.usuario.nome}</p>
          {eu.usuario.perfis.includes('gestor') && (
            <Link
              to={inicio(outra)}
              data-testid="trocar-visao"
              onClick={() => {
                guardar(outra);
                document.getElementById('conta')?.hidePopover();
              }}
            >
              Trocar para <strong>{outra === 'gestor' ? 'Gestor' : 'Participante'}</strong>
            </Link>
          )}
          <button type="button" className="fantasma" data-testid="sair" onClick={sair}>
            Sair
          </button>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1} data-testid="conteudo">
        <Routes>
          {itens.map(({ caminho, titulo }) => (
            <Route
              key={caminho}
              path={caminho}
              element={
                <Pagina id={idDaPagina(caminho)} titulo={titulo}>
                  {paginas[caminho]}
                </Pagina>
              }
            />
          ))}
          <Route
            path="*"
            element={
              <Pagina id="nao-encontrada" titulo="Página não encontrada">
                <p>Esta página não existe ou não é do seu perfil.</p>
              </Pagina>
            }
          />
        </Routes>
      </main>
    </>
  );
};
