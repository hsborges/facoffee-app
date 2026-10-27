import { type ReactNode, useEffect, useState } from 'react';
import { hasAuthParams, useAuth } from 'react-oidc-context';
import { Link, matchPath, Route, Routes, useLocation, useNavigate } from 'react-router';
import { obterUsuarioLogado, type UsuarioLogado } from './api';
import { iniciais } from './formato';
import {
  ConferirComprovante,
  Gastos,
  Participantes,
  ReceberPagamento,
  RegistrarGasto,
  SolicitarComplemento,
  ValorDaCota,
} from './gestor';
import { Icone, Marca } from './icones';
import { PaginaInicial } from './inicial';
import {
  navegacao,
  type Pagina as PaginaDaVisao,
  paginas,
  type Visao,
  visaoAtual,
  visaoGuardada,
} from './navegacao';
import { Caixinha, EnviarComprovante, MinhaSituacao } from './participante';

// Names the page in its data-testid by the last part of its path: `/` is Minha situação.
const idDaPagina = (caminho: string) =>
  caminho === '/' ? 'minha-situacao' : (caminho.split('/').at(-1) ?? '');

const Pagina = ({
  id,
  titulo,
  voltar,
  children,
}: {
  id: string;
  titulo: string;
  voltar?: PaginaDaVisao | undefined;
  children: ReactNode;
}) => {
  useEffect(() => {
    document.title = `${titulo} · FACOFFEE`;
  }, [titulo]);
  return (
    <>
      {voltar && (
        <Link className="voltar" to={voltar.caminho}>
          <Icone nome="voltar" />
          {voltar.titulo}
        </Link>
      )}
      <h1 data-testid={`pagina-${id}`}>{titulo}</h1>
      {children}
    </>
  );
};

const Aviso = ({ children }: { children: ReactNode }) => (
  <main className="aviso">
    <h1>
      <Marca />
    </h1>
    {children}
  </main>
);

const VISAO = 'facoffee.visao';

const inicio = (visao: Visao) => navegacao(visao)[0]?.caminho ?? '/';

// After the login, the gestor chooses the visão (ADR 0029).
const EscolhaDaVisao = ({
  nome,
  escolher,
  sair,
}: {
  nome: string;
  escolher: (visao: Visao) => void;
  sair: () => void;
}) => (
  <div className="escolha">
    <header className="escolha-topo">
      <Marca />
      <button type="button" className="fantasma" onClick={sair}>
        <Icone nome="sair" />
        Sair
      </button>
    </header>
    <main>
      <h1>Olá, {nome.split(' ')[0]}. Como quer entrar?</h1>
      <p className="apoio">Você é participante e gestor. Escolha a tarefa de agora.</p>
      <div className="visoes">
        <button
          type="button"
          className="visao escura"
          data-testid="visao-gestor"
          onClick={() => escolher('gestor')}
        >
          <span className="icone-fundo">
            <Icone nome="pessoas" />
          </span>
          <strong>Como gestor</strong>
          <span>Participantes, gastos e valor da cota</span>
          <span className="visao-acao">
            Cuidar da copa <Icone nome="direita" />
          </span>
        </button>
        <button
          type="button"
          className="visao"
          data-testid="visao-participante"
          onClick={() => escolher('participante')}
        >
          <span className="icone-fundo">
            <Icone nome="usuario" />
          </span>
          <strong>Como participante</strong>
          <span>Minha situação e caixinha</span>
          <span className="visao-acao">
            Ver a minha situação <Icone nome="direita" />
          </span>
        </button>
      </div>
      <p className="nota">
        <Icone nome="trocar" /> Troque de visão a qualquer momento pelo menu da conta.
      </p>
    </main>
  </div>
);

/**
 * Shows the start page to whoever is not logged in (ADR 0025); after the login through the
 * Keycloak (OIDC, ADR 0019), reads the logged-in usuário from the gateway and shows the layout
 * in the visão of their perfis, with the menu at the foot of the phone and at the side of the
 * computer (ADR 0034); the gestor chooses the visão after the login (ADR 0029).
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
          <button type="button" className="contorno" onClick={sair}>
            Sair
          </button>
        </div>
      </Aviso>
    );

  const { usuario } = eu;
  const gestor = usuario.perfis.includes('gestor');
  const visao = visaoAtual(usuario.perfis, escolhida, pathname);
  if (!visao)
    return (
      <EscolhaDaVisao
        nome={usuario.nome}
        sair={sair}
        escolher={(nova) => {
          guardar(nova);
          if (visaoAtual(usuario.perfis, nova, pathname) !== nova) navigate(inicio(nova));
        }}
      />
    );

  const itens = navegacao(visao);
  const daVisao = paginas(visao);
  const atual = daVisao.find((pagina) => matchPath(pagina.caminho, pathname));
  const outra = visao === 'gestor' ? 'participante' : 'gestor';
  const conteudo: Readonly<Record<string, ReactNode>> = {
    '/': <MinhaSituacao token={token} usuarioId={usuario.id} sair={sair} />,
    '/enviar-comprovante': <EnviarComprovante token={token} participanteId={usuario.id} />,
    '/caixinha': <Caixinha token={token} />,
    '/caixinha/registrar-gasto': (
      <RegistrarGasto token={token} voltar="/caixinha" origem="proprio-bolso" />
    ),
    '/participantes': <Participantes token={token} usuarioId={usuario.id} />,
    '/participantes/conferir-comprovante': <ConferirComprovante token={token} />,
    '/participantes/receber-pagamento': <ReceberPagamento token={token} />,
    '/gastos': <Gastos token={token} />,
    '/gastos/registrar-gasto': <RegistrarGasto token={token} voltar="/gastos" origem="caixinha" />,
    '/gastos/solicitar-complemento': <SolicitarComplemento token={token} />,
    '/valor-da-cota': <ValorDaCota token={token} />,
  };
  const perfil = gestor ? `Gestor · na visão do ${visao}` : 'Participante';
  return (
    <div className="layout">
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="topo">
        <Marca />
        {visao === 'gestor' && <span className="selo-gestor">Gestor</span>}
        <nav aria-label="Principal">
          <ul>
            {itens.map(({ caminho, titulo, icone }) => (
              <li key={caminho}>
                <Link
                  to={caminho}
                  data-testid={`menu-${idDaPagina(caminho)}`}
                  aria-current={atual?.menu === caminho ? 'page' : undefined}
                >
                  <Icone nome={icone} />
                  {titulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          className="abrir-conta"
          data-testid="abrir-conta"
          popoverTarget="conta"
        >
          <span className={gestor ? 'avatar escuro' : 'avatar'} aria-hidden="true">
            {iniciais(usuario.nome)}
          </span>
          <span className="quem">
            <strong>{usuario.nome}</strong>
            <small>{gestor ? 'Gestor' : 'Participante'}</small>
          </span>
        </button>
        <div id="conta" className="conta" popover="auto" data-testid="conta">
          <p>
            <strong>{usuario.nome}</strong>
            <small>{perfil}</small>
          </p>
          {gestor && (
            <Link
              to={inicio(outra)}
              data-testid="trocar-visao"
              onClick={() => {
                guardar(outra);
                document.getElementById('conta')?.hidePopover();
              }}
            >
              <Icone nome="trocar" />
              Ir para a visão do {outra}
            </Link>
          )}
          <button type="button" className="fantasma" data-testid="sair" onClick={sair}>
            <Icone nome="sair" />
            Sair
          </button>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1} data-testid="conteudo">
        <Routes>
          {daVisao.map((pagina) => (
            <Route
              key={pagina.caminho}
              path={pagina.caminho}
              element={
                <Pagina
                  id={idDaPagina(pagina.caminho)}
                  titulo={pagina.titulo}
                  voltar={daVisao.find(
                    (de) => de.caminho === pagina.menu && de.caminho !== pagina.caminho,
                  )}
                >
                  {conteudo[pagina.caminho]}
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
    </div>
  );
};
