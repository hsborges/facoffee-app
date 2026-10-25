import { type ReactNode, useEffect, useState } from 'react';
import { useAuth, useAutoSignin } from 'react-oidc-context';
import { NavLink, Route, Routes } from 'react-router';
import logo from '../../infra/keycloak/themes/facoffee/login/resources/img/facoffee-logo.svg';
import { obterUsuarioLogado, type UsuarioLogado } from './api';
import { Gastos, Participantes, SolicitarComplemento, ValorDaCota } from './gestor';
import { navegacao } from './navegacao';
import { Caixinha, MinhaSituacao } from './participante';

const Pagina = ({ titulo, children }: { titulo: string; children: ReactNode }) => {
  useEffect(() => {
    document.title = `${titulo} · FACOFFEE`;
  }, [titulo]);
  return (
    <>
      <h1>{titulo}</h1>
      {children}
    </>
  );
};

const Aviso = ({ children }: { children: ReactNode }) => (
  <main className="aviso">
    <img src={logo} alt="FACOFFEE" width={240} />
    {children}
  </main>
);

/**
 * Signs in through the Keycloak (OIDC, ADR 0019), reads the logged-in usuário from the gateway
 * and shows the layout with the navigation of their perfis.
 */
export const App = () => {
  const auth = useAuth();
  // Keeps the page asked for, to return to it after the login (destinoDoLogin).
  const entrar = { state: location.pathname + location.search };
  const { isAuthenticated, error } = useAutoSignin({ signinArgs: entrar });
  const token = auth.user?.access_token;
  const [eu, setEu] = useState<UsuarioLogado>();

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
  if (!isAuthenticated || !token || !eu)
    return (
      <Aviso>
        <p role="status">Carregando…</p>
      </Aviso>
    );
  if (eu.situacao === 'desativado')
    return (
      <Aviso>
        <p role="alert">Seu acesso ao FACOFFEE foi desativado.</p>
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

  const itens = navegacao(eu.usuario.perfis);
  const paginas: Readonly<Record<string, ReactNode>> = {
    '/': <MinhaSituacao token={token} usuarioId={eu.usuario.id} sair={sair} />,
    '/caixinha': (
      <>
        <Caixinha token={token} />
        {eu.usuario.perfis.includes('gestor') && <SolicitarComplemento token={token} />}
      </>
    ),
    '/participantes': <Participantes token={token} usuarioId={eu.usuario.id} />,
    '/gastos': <Gastos token={token} />,
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
                <NavLink to={caminho} end>
                  {titulo}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="conta">
          <span>{eu.usuario.nome}</span>
          <button type="button" className="fantasma" onClick={sair}>
            Sair
          </button>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1}>
        <Routes>
          {itens.map(({ caminho, titulo }) => (
            <Route
              key={caminho}
              path={caminho}
              element={<Pagina titulo={titulo}>{paginas[caminho]}</Pagina>}
            />
          ))}
          <Route
            path="*"
            element={
              <Pagina titulo="Página não encontrada">
                <p>Esta página não existe ou não é do seu perfil.</p>
              </Pagina>
            }
          />
        </Routes>
      </main>
    </>
  );
};
