import { type ReactNode, useEffect, useState } from 'react';
import { useAuth, useAutoSignin } from 'react-oidc-context';
import { NavLink, Route, Routes } from 'react-router';
import logo from '../../infra/keycloak/themes/facoffee/login/resources/img/facoffee-logo.svg';
import { obterUsuarioLogado, type UsuarioLogado } from './api';
import { navegacao } from './navegacao';

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
  const { isAuthenticated, error } = useAutoSignin();
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

  if (error)
    return (
      <Aviso>
        <p role="alert">Não foi possível entrar no FACOFFEE.</p>
        <button type="button" onClick={() => auth.signinRedirect()}>
          Tentar de novo
        </button>
      </Aviso>
    );
  if (!isAuthenticated || !eu)
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
        <button type="button" onClick={() => location.reload()}>
          Tentar de novo
        </button>
      </Aviso>
    );

  const itens = navegacao(eu.usuario.perfis);
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
          {/* ponytail: placeholder pages, the screens come in #29 (participante) and #30 (gestor) */}
          {itens.map(({ caminho, titulo }) => (
            <Route
              key={caminho}
              path={caminho}
              element={
                <Pagina titulo={titulo}>
                  <p>Em construção.</p>
                </Pagina>
              }
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
