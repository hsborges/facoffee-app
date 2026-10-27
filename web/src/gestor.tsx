import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  abrirArquivo,
  type Caixinha as CaixinhaLida,
  type Comando,
  type ComprovanteEnviado,
  type CreditoEPendente,
  chamarApi,
  comandar,
  type Gasto,
  guardarAntes,
  type TipoDeCota,
  type UsuarioRegistrado,
  type ValorDaCota as ValorDaCotaLido,
} from './api';
import {
  dataEmCampoGrande,
  emCentavos,
  emReais,
  iniciais,
  mesEmCampoGrande,
  mesPorExtenso,
  NOME_DO_TIPO_DE_COTA,
  NOME_DO_TIPO_DE_GASTO,
  nomeDoMes,
} from './formato';
import { Icone } from './icones';
import {
  anoAtual,
  aoEnviar,
  CampoArquivo,
  CampoValor,
  Carregando,
  depoisDoPagamento,
  emCampo,
  FalhaAoCarregar,
  GastosDoAnoAnterior,
  MesNavegavel,
  Selo,
  situacaoDe,
  useComando,
  useLeitura,
  ValoresDaCota,
} from './participante';

/**
 * Receber pagamento: por PIX, guarda the comprovante first, and refuses a PIX without it before
 * calling the API; em dinheiro, a file picked anyway is left out.
 */
export const receberPagamento = async (
  token: string,
  {
    comprovante,
    ...pagamento
  }: {
    readonly participanteId: string;
    readonly valorEmCentavos: number;
    readonly forma: 'pix' | 'dinheiro';
    readonly comprovante: File | null;
  },
): Promise<Comando> => {
  const receber = (comprovanteId?: string) =>
    comandar(token, '/api/financeiro/receber-pagamento', { ...pagamento, comprovanteId });
  if (pagamento.forma === 'dinheiro') return receber();
  if (!comprovante?.size) return { feito: false, erro: 'pix-sem-comprovante' };
  return guardarAntes(
    token,
    '/api/financeiro/guardar-comprovante',
    { participanteId: pagamento.participanteId, arquivo: comprovante },
    receber,
  );
};

/**
 * Confirmar comprovante, with the valor confirmado, for the arquivo the gestor saw: if the
 * participante changed it meanwhile, the API refuses it.
 */
export const confirmarComprovante = (
  token: string,
  { id, comprovanteId }: Pick<ComprovanteEnviado, 'id' | 'comprovanteId'>,
  valorEmCentavos: number,
) =>
  comandar(token, `/api/financeiro/comprovante-enviado/${id}/confirmar`, {
    valorEmCentavos,
    comprovanteId,
  });

/** Registrar gasto: guarda the nota first, then registers the gasto with it. */
export const registrarGasto = (
  token: string,
  {
    nota,
    ...gasto
  }: {
    readonly valorEmCentavos: number;
    readonly origem: Gasto['origem'];
    readonly tipo: Gasto['tipo'];
    readonly nota: File;
  },
) =>
  guardarAntes(token, '/api/financeiro/guardar-nota', { arquivo: nota }, (notaId) =>
    comandar(token, '/api/financeiro/registrar-gasto', { ...gasto, notaId }),
  );

/** The crédito or pendência of a participante, in one line. */
export const creditoOuPendencia = (situacao: CreditoEPendente) =>
  situacao.pendenteEmCentavos > 0
    ? `Pendente: ${emReais(situacao.pendenteEmCentavos)}`
    : situacao.creditoEmCentavos > 0
      ? `Crédito: ${emReais(situacao.creditoEmCentavos)}`
      : 'Em dia';

/** RN-FIN-36: what the gestor checks in the comprovante of `nome`, who owes `pendente`. */
export const listaDeConferencia = (
  nome: string,
  valorInformadoEmCentavos: number,
  pendenteEmCentavos: number,
) => [
  valorInformadoEmCentavos === pendenteEmCentavos
    ? `O valor informado, ${emReais(valorInformadoEmCentavos)}, é o que ${nome} deve.`
    : `O valor informado é ${emReais(valorInformadoEmCentavos)}; ${nome} deve ${emReais(pendenteEmCentavos)}.`,
  'A data é deste mês.',
  `O valor no comprovante bate com o informado. Pode ser de outra pessoa: o pagamento é de ${nome}.`,
];

/** RN-FIN-36: the motivos that fill the motivo da recusa. */
export const MOTIVOS_COMUNS = [
  'Comprovante de outro mês',
  'Valor diferente do informado',
  'Arquivo ilegível',
  'Não é um comprovante de PIX',
] as const;

/** The gastos pagos do próprio bolso not reembolsados yet. */
export const aReembolsar = (gastos: readonly Gasto[]) =>
  gastos.filter((gasto) => gasto.origem === 'proprio-bolso' && !gasto.reembolsado);

/** RN-FIN-37: the saldo da caixinha once every gasto a reembolsar is reembolsado. */
export const saldoDepoisDosReembolsos = (saldoEmCentavos: number, gastos: readonly Gasto[]) =>
  aReembolsar(gastos).reduce((saldo, gasto) => saldo - gasto.valorEmCentavos, saldoEmCentavos);

const nomeDe = (usuario: UsuarioRegistrado) => usuario.nome || usuario.email;

const listar = (nomes: readonly string[]) =>
  new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format([...new Set(nomes)]);

const Avatar = ({ nome }: { nome: string }) => (
  <span className="avatar" aria-hidden="true">
    {iniciais(nome)}
  </span>
);

type Filtro = 'todos' | 'pendentes' | 'com-credito' | 'sairam';

const FILTROS: Readonly<Record<Filtro, string>> = {
  todos: 'Todos',
  pendentes: 'Pendentes',
  'com-credito': 'Com crédito',
  sairam: 'Saíram',
};

const passa = (filtro: Filtro, situacao?: CreditoEPendente) =>
  filtro === 'todos' ||
  (!!situacao &&
    (filtro === 'pendentes'
      ? situacao.pendenteEmCentavos > 0
      : filtro === 'com-credito'
        ? situacao.creditoEmCentavos > 0
        : !situacao.ativo));

/**
 * *Participantes* (gestor): the comprovantes a confirmar, to conferir; how many are pendentes and
 * ativos; and each usuário with their crédito or pendência, filtered and searched by name, with
 * receber pagamento and desativar or reativar access. The gestor's own access is left out: once
 * desativado, nobody could reativá-lo.
 */
export const Participantes = ({ token, usuarioId }: { token: string; usuarioId: string }) => {
  const [usuarios, recarregarUsuarios] = useLeitura<readonly UsuarioRegistrado[]>(
    token,
    '/api/usuario',
  );
  const [situacoes, recarregarSituacoes] = useLeitura<readonly CreditoEPendente[]>(
    token,
    '/api/financeiro/participante',
  );
  const [comprovantes, recarregarComprovantes] = useLeitura<readonly ComprovanteEnviado[]>(
    token,
    '/api/financeiro/comprovante-enviado',
  );
  const recarregar = () => {
    recarregarUsuarios();
    recarregarSituacoes();
    recarregarComprovantes();
  };
  const { enviando, fazer, avisos } = useComando(recarregar);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');

  if (!usuarios || !situacoes || !comprovantes) return <Carregando />;
  if (usuarios.situacao !== 'ok' || situacoes.situacao !== 'ok' || comprovantes.situacao !== 'ok')
    return (
      <>
        {avisos}
        <FalhaAoCarregar tentarDeNovo={recarregar} />
      </>
    );

  const situacaoDoId = new Map(situacoes.valor.map((situacao) => [situacao.id, situacao]));
  const nomes = new Map(usuarios.valor.map((usuario) => [usuario.id, nomeDe(usuario)]));
  const aConfirmar = comprovantes.valor;
  const primeiroAConfirmar = new Map(
    [...aConfirmar].reverse().map((comprovante) => [comprovante.participanteId, comprovante.id]),
  );
  const pendentes = situacoes.valor.filter((situacao) => situacao.pendenteEmCentavos > 0);
  const termo = busca.trim().toLowerCase();
  const visiveis = usuarios.valor.filter(
    (usuario) =>
      passa(filtro, situacaoDoId.get(usuario.id)) && nomeDe(usuario).toLowerCase().includes(termo),
  );

  const mudarAcesso = (usuario: UsuarioRegistrado) => {
    const nome = nomeDe(usuario);
    if (usuario.desativado)
      return fazer(
        () => comandar(token, `/api/usuario/${usuario.id}/reativar`),
        `Acesso de ${nome} reativado.`,
        'Não foi possível reativar o acesso.',
      );
    if (!confirm(`Desativar o acesso de ${nome}? A participação termina, se houver.`)) return;
    return fazer(
      () => comandar(token, `/api/usuario/${usuario.id}/desativar`),
      `Acesso de ${nome} desativado.`,
      'Não foi possível desativar o acesso.',
    );
  };

  return (
    <>
      <div className="barra-de-acoes no-titulo">
        <Link className="botao" to="/participantes/receber-pagamento">
          <Icone nome="mais" />
          Receber pagamento
        </Link>
      </div>
      {avisos}
      <div className="painel">
        {aConfirmar.length > 0 && (
          <Link
            className="chamada"
            to="/participantes/conferir-comprovante"
            data-testid="ir-conferir"
          >
            <span className="contador">{aConfirmar.length}</span>
            <span>
              <strong>
                {aConfirmar.length === 1 ? 'Comprovante a confirmar' : 'Comprovantes a confirmar'}
              </strong>
              <small>
                {listar(aConfirmar.map((c) => nomes.get(c.participanteId) ?? 'Desconhecido'))} ·{' '}
                {emReais(aConfirmar.reduce((total, c) => total + c.valorEmCentavos, 0))} ao todo
              </small>
            </span>
            <span className="chamada-acao">
              Conferir <Icone nome="direita" />
            </span>
          </Link>
        )}
        <dl className="numeros">
          <div className="cartao">
            <dt>Pendentes</dt>
            <dd>
              <strong>{pendentes.length}</strong>{' '}
              <span className="texto-alerta">
                {emReais(pendentes.reduce((total, s) => total + s.pendenteEmCentavos, 0))}
              </span>
            </dd>
          </div>
          <div className="cartao">
            <dt>Ativos</dt>
            <dd>
              <strong>{situacoes.valor.filter((situacao) => situacao.ativo).length}</strong>
            </dd>
          </div>
        </dl>
      </div>
      <section aria-labelledby="credito-e-pendentes">
        <h2 id="credito-e-pendentes" className="visualmente-oculto">
          Crédito e pendentes
        </h2>
        <div className="filtrar">
          <fieldset className="filtros">
            <legend className="visualmente-oculto">Mostrar</legend>
            {Object.entries(FILTROS).map(([qual, rotulo]) => (
              <button
                key={qual}
                type="button"
                className="atalho"
                aria-pressed={filtro === qual}
                onClick={() => setFiltro(qual as Filtro)}
              >
                {rotulo}
              </button>
            ))}
          </fieldset>
          <label className="busca">
            <Icone nome="busca" />
            <span className="visualmente-oculto">Buscar pelo nome</span>
            <input
              type="search"
              placeholder="Buscar pelo nome"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </label>
        </div>
        {visiveis.length === 0 ? (
          <p className="cartao apoio">Ninguém por aqui.</p>
        ) : (
          <div className="cartao tabela">
            <table className="empilhada participantes">
              <thead>
                <tr>
                  <th scope="col">Participante</th>
                  <th scope="col">Situação</th>
                  <th scope="col" className="numero">
                    Valor
                  </th>
                  <th scope="col">Detalhe</th>
                  <th scope="col">Ação</th>
                  <th scope="col">Acesso</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((usuario) => {
                  const nome = nomeDe(usuario);
                  const situacao = situacaoDoId.get(usuario.id);
                  const qual = situacao && situacaoDe(situacao);
                  const comprovanteId = primeiroAConfirmar.get(usuario.id);
                  const acao = usuario.desativado ? 'Reativar acesso' : 'Desativar acesso';
                  return (
                    <tr
                      key={usuario.id}
                      data-testid="participante"
                      data-participacao={
                        !situacao ? 'nunca-participou' : situacao.ativo ? 'participa' : 'saiu'
                      }
                      data-acesso={usuario.desativado ? 'desativado' : 'ativo'}
                    >
                      <th scope="row">
                        <span className="pessoa">
                          <Avatar nome={nome} />
                          {nome}
                        </span>
                      </th>
                      <td data-rotulo="Situação">
                        {!situacao || !qual ? (
                          'Nunca participou'
                        ) : (
                          <span className="selos">
                            <Selo situacao={qual} />
                            {!situacao.ativo && <Selo situacao="saiu" />}
                          </span>
                        )}
                      </td>
                      <td data-rotulo="Valor" className="numero">
                        {qual === 'pendente'
                          ? emReais(situacao?.pendenteEmCentavos ?? 0)
                          : qual === 'credito'
                            ? emReais(situacao?.creditoEmCentavos ?? 0)
                            : '—'}
                      </td>
                      <td data-rotulo="Detalhe">
                        {comprovanteId && (
                          <Selo situacao="a-confirmar" rotulo="Comprovante a confirmar" />
                        )}
                      </td>
                      <td data-rotulo="Ação">
                        {comprovanteId ? (
                          <Link
                            className="botao secundario pequeno"
                            to={`/participantes/conferir-comprovante?id=${comprovanteId}`}
                            aria-label={`Conferir o comprovante de ${nome}`}
                          >
                            Conferir
                          </Link>
                        ) : situacao ? (
                          <Link
                            className="botao contorno pequeno"
                            to={`/participantes/receber-pagamento?participante=${usuario.id}`}
                            aria-label={`Receber pagamento de ${nome}`}
                          >
                            Receber
                          </Link>
                        ) : null}
                      </td>
                      <td data-rotulo="Acesso">
                        {usuario.desativado ? 'Desativado ' : 'Ativo '}
                        {usuario.id !== usuarioId && (
                          <button
                            type="button"
                            className="fantasma pequeno"
                            data-testid={
                              usuario.desativado ? 'reativar-acesso' : 'desativar-acesso'
                            }
                            disabled={enviando}
                            aria-label={`${acao} de ${nome}`}
                            onClick={() => mudarAcesso(usuario)}
                          >
                            {acao}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
};

// The arquivo of a comprovante, shown on the page: an image, or the PDF in a frame.
const Previa = ({ token, comprovanteId }: { token: string; comprovanteId: string }) => {
  const [arquivo, setArquivo] = useState<{ readonly url: string; readonly tipo: string }>();
  useEffect(() => {
    let atual = true;
    let url: string | undefined;
    chamarApi(token, `/api/financeiro/comprovante/${comprovanteId}`)
      .then((resposta) => (resposta.ok ? resposta.blob() : undefined))
      .catch(() => undefined)
      .then((blob) => {
        if (!blob || !atual) return;
        url = URL.createObjectURL(blob);
        setArquivo({ url, tipo: blob.type });
      });
    return () => {
      atual = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [token, comprovanteId]);
  if (!arquivo)
    return (
      <div className="previa vazia">
        <Icone nome="arquivo" />
        Prévia do comprovante enviado
      </div>
    );
  return arquivo.tipo === 'application/pdf' ? (
    <iframe className="previa" src={arquivo.url} title="Prévia do comprovante enviado" />
  ) : (
    <img className="previa" src={arquivo.url} alt="Prévia do comprovante enviado" />
  );
};

const Conferencia = ({
  token,
  comprovante,
  nome,
  situacao,
  enviando,
  fazer,
  abrir,
}: {
  token: string;
  comprovante: ComprovanteEnviado;
  nome: string;
  situacao?: CreditoEPendente | undefined;
  enviando: boolean;
  fazer: ReturnType<typeof useComando>['fazer'];
  abrir: () => void;
}) => {
  const [valor, setValor] = useState(emCampo(comprovante.valorEmCentavos));
  const [motivo, setMotivo] = useState('');
  const pendente = situacao?.pendenteEmCentavos ?? 0;
  const confirmar = aoEnviar(() =>
    fazer(
      () => confirmarComprovante(token, comprovante, emCentavos(valor)),
      'Comprovante confirmado: pagamento recebido.',
      'Não foi possível confirmar o comprovante.',
    ),
  );
  const recusar = aoEnviar(() =>
    fazer(
      () =>
        comandar(token, `/api/financeiro/comprovante-enviado/${comprovante.id}/recusar`, {
          motivo,
        }),
      'Comprovante recusado.',
      'Não foi possível recusar o comprovante.',
    ),
  );
  return (
    <div className="colunas conferencia" data-testid="conferencia">
      <div className="pilha">
        <Previa token={token} comprovanteId={comprovante.comprovanteId} />
        <p className="nota linha">
          Enviado em {dataEmCampoGrande(comprovante.enviadoEm)}
          <button type="button" className="link" data-testid="ver-comprovante" onClick={abrir}>
            Abrir em nova aba
          </button>
        </p>
      </div>
      <div className="pilha">
        <div className="cartao linha-com-icone">
          <Avatar nome={nome} />
          <p>
            <strong className="nome-grande">{nome}</strong>
            <small>
              {situacao ? creditoOuPendencia(situacao) : 'Nunca participou'} · informou{' '}
              {emReais(comprovante.valorEmCentavos)}
            </small>
          </p>
        </div>
        <fieldset className="cartao">
          <legend>Confira no comprovante</legend>
          {listaDeConferencia(nome, comprovante.valorEmCentavos, pendente).map((item) => (
            <label key={item} className="opcao">
              <input type="checkbox" data-testid="item-a-conferir" />
              <span>{item}</span>
            </label>
          ))}
        </fieldset>
        <form onSubmit={confirmar}>
          <CampoValor
            rotulo="Valor a confirmar (R$)"
            valor={valor}
            aoMudar={setValor}
            ajuda="Corrija se o comprovante mostrar outro valor."
          />
          <button type="submit" className="largo" data-testid="confirmar" disabled={enviando}>
            <Icone nome="check" />
            Confirmar {emReais(valor ? emCentavos(valor) : 0)}
          </button>
        </form>
        <details className="recusa">
          <summary className="botao contorno largo" data-testid="abrir-recusa">
            Recusar
          </summary>
          <form onSubmit={recusar}>
            <fieldset>
              <legend>Motivos comuns</legend>
              <div className="atalhos">
                {MOTIVOS_COMUNS.map((comum) => (
                  <button
                    key={comum}
                    type="button"
                    className="atalho"
                    data-testid="motivo-comum"
                    aria-pressed={motivo === comum}
                    onClick={() => setMotivo(comum)}
                  >
                    {comum}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="campo">
              <span className="rotulo">Motivo da recusa</span>
              <input
                name="motivo"
                data-testid="motivo"
                maxLength={500}
                required
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
              />
            </label>
            <button
              type="submit"
              className="secundario largo"
              data-testid="recusar"
              disabled={enviando}
            >
              Recusar comprovante
            </button>
          </form>
        </details>
      </div>
    </div>
  );
};

/**
 * *Conferir comprovante*, under *Participantes*: one comprovante a confirmar at a time, with its
 * arquivo, the lista to check (RN-FIN-36) and confirmar, with the valor corrected if needed, or
 * recusar with the motivo; then the next. Below, every comprovante a confirmar, to pick another.
 */
export const ConferirComprovante = ({ token }: { token: string }) => {
  const [comprovantes, recarregarComprovantes] = useLeitura<readonly ComprovanteEnviado[]>(
    token,
    '/api/financeiro/comprovante-enviado',
  );
  const [usuarios, recarregarUsuarios] = useLeitura<readonly UsuarioRegistrado[]>(
    token,
    '/api/usuario',
  );
  const [situacoes, recarregarSituacoes] = useLeitura<readonly CreditoEPendente[]>(
    token,
    '/api/financeiro/participante',
  );
  const recarregar = () => {
    recarregarComprovantes();
    recarregarUsuarios();
    recarregarSituacoes();
  };
  const { enviando, fazer, avisos } = useComando(recarregar);
  const [busca] = useSearchParams();
  const [falhaAoAbrir, setFalhaAoAbrir] = useState(false);

  if (!comprovantes || !usuarios || !situacoes) return <Carregando />;
  if (comprovantes.situacao !== 'ok' || usuarios.situacao !== 'ok' || situacoes.situacao !== 'ok')
    return (
      <>
        {avisos}
        <FalhaAoCarregar tentarDeNovo={recarregar} />
      </>
    );

  const fila = comprovantes.valor;
  const nomes = new Map(usuarios.valor.map((usuario) => [usuario.id, nomeDe(usuario)]));
  const situacaoDoId = new Map(situacoes.valor.map((situacao) => [situacao.id, situacao]));
  const nomeDoComprovante = (comprovante: ComprovanteEnviado) =>
    nomes.get(comprovante.participanteId) ?? 'Desconhecido';
  // The one asked for, or the first: once analisado, it leaves the fila, and the next comes.
  const indice = Math.max(
    0,
    fila.findIndex((comprovante) => comprovante.id === busca.get('id')),
  );
  const atual = fila[indice];
  const proximo = fila.length > 1 ? fila[(indice + 1) % fila.length] : undefined;

  return (
    <>
      {avisos}
      {falhaAoAbrir && <p role="alert">Não foi possível abrir o comprovante.</p>}
      {!atual ? (
        <p className="cartao apoio">Nenhum comprovante a confirmar.</p>
      ) : (
        <>
          <p className="posicao">
            {indice + 1} de {fila.length}
            {proximo && (
              <Link to={`?id=${proximo.id}`}>
                Próximo: {nomeDoComprovante(proximo)} <Icone nome="direita" />
              </Link>
            )}
          </p>
          <Conferencia
            key={atual.id}
            token={token}
            comprovante={atual}
            nome={nomeDoComprovante(atual)}
            situacao={situacaoDoId.get(atual.participanteId)}
            enviando={enviando}
            fazer={fazer}
            abrir={async () =>
              setFalhaAoAbrir(
                !(await abrirArquivo(token, `/api/financeiro/comprovante/${atual.comprovanteId}`)),
              )
            }
          />
        </>
      )}
      {fila.length > 0 && (
        <section aria-labelledby="comprovantes-a-confirmar">
          <h2 id="comprovantes-a-confirmar">Comprovantes a confirmar</h2>
          <ul className="cartao lista">
            {fila.map((comprovante) => (
              <li
                key={comprovante.id}
                data-testid="comprovante-a-confirmar"
                aria-current={comprovante === atual ? 'true' : undefined}
              >
                <Link className="linha" to={`?id=${comprovante.id}`} data-testid="conferir">
                  <span>
                    <strong>{nomeDoComprovante(comprovante)}</strong>
                    <small>Enviado em {dataEmCampoGrande(comprovante.enviadoEm)}</small>
                  </span>
                  <span className="valor">{emReais(comprovante.valorEmCentavos)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
};

/**
 * *Receber pagamento*, under *Participantes*: from a participante, por PIX with the comprovante or
 * em dinheiro; the valor starts at the pendente, and the page tells how the situação stands after
 * (RN-FIN-35).
 */
export const ReceberPagamento = ({ token }: { token: string }) => {
  const [usuarios, recarregarUsuarios] = useLeitura<readonly UsuarioRegistrado[]>(
    token,
    '/api/usuario',
  );
  const [situacoes, recarregarSituacoes] = useLeitura<readonly CreditoEPendente[]>(
    token,
    '/api/financeiro/participante',
  );
  const recarregar = () => {
    recarregarUsuarios();
    recarregarSituacoes();
  };
  const { enviando, fazer, avisos } = useComando(recarregar);
  const [busca] = useSearchParams();
  const [escolhido, setEscolhido] = useState<string>();
  const [valor, setValor] = useState<string>();
  const [pix, setPix] = useState(true);
  const navigate = useNavigate();

  if (!usuarios || !situacoes) return <Carregando />;
  if (usuarios.situacao !== 'ok' || situacoes.situacao !== 'ok')
    return <FalhaAoCarregar tentarDeNovo={recarregar} />;

  const situacaoDoId = new Map(situacoes.valor.map((situacao) => [situacao.id, situacao]));
  const participantes = usuarios.valor.filter((usuario) => situacaoDoId.has(usuario.id));
  if (participantes.length === 0)
    return <p className="cartao apoio">Ninguém pediu entrada ainda.</p>;

  const pedido = busca.get('participante') ?? '';
  const participanteId = escolhido ?? (situacaoDoId.has(pedido) ? pedido : '');
  const situacao = situacaoDoId.get(participanteId);
  const usuario = participantes.find((cada) => cada.id === participanteId);
  const campo =
    valor ??
    (situacao && situacao.pendenteEmCentavos > 0 ? emCampo(situacao.pendenteEmCentavos) : '');
  const centavos = campo ? emCentavos(campo) : 0;
  const depois = usuario && situacao && depoisDoPagamento(nomeDe(usuario), situacao, centavos);

  const receber = aoEnviar(async (dados) => {
    const feito = 'Pagamento recebido.';
    const recebido = await fazer(
      () =>
        receberPagamento(token, {
          participanteId,
          valorEmCentavos: centavos,
          forma: pix ? 'pix' : 'dinheiro',
          comprovante: dados.get('comprovante') as File | null,
        }),
      feito,
      'Não foi possível receber o pagamento.',
    );
    if (recebido) navigate('/participantes', { state: { feito } });
  });

  return (
    <form onSubmit={receber} data-testid="recebimento">
      {avisos}
      <div className="colunas">
        <div className="cartao pilha">
          <label className="campo">
            <span className="rotulo">De quem são as cotas</span>
            <select
              name="participanteId"
              data-testid="escolha-do-participante"
              required
              value={participanteId}
              onChange={(evento) => {
                setEscolhido(evento.target.value);
                setValor(undefined);
              }}
              aria-describedby="um-por-pessoa"
            >
              <option value="" disabled>
                Escolha o participante
              </option>
              {participantes.map((cada) => (
                <option key={cada.id} value={cada.id}>
                  {nomeDe(cada)}
                </option>
              ))}
            </select>
            <small id="um-por-pessoa" className="ajuda">
              Pagou por mais de uma pessoa? Registre um pagamento para cada.
            </small>
          </label>
          <fieldset className="segmentado">
            <legend>Forma</legend>
            <div>
              <label>
                <input
                  type="radio"
                  name="forma"
                  value="pix"
                  data-testid="forma-pix"
                  checked={pix}
                  onChange={() => setPix(true)}
                />
                PIX
              </label>
              <label>
                <input
                  type="radio"
                  name="forma"
                  value="dinheiro"
                  data-testid="forma-dinheiro"
                  checked={!pix}
                  onChange={() => setPix(false)}
                />
                Dinheiro
              </label>
            </div>
          </fieldset>
          {pix && (
            <CampoArquivo
              rotulo="Comprovante do PIX"
              ajuda="Obrigatório no PIX. Foto ou PDF, até 5 MB."
              nome="comprovante"
            />
          )}
          <CampoValor rotulo="Valor recebido (R$)" valor={campo} aoMudar={setValor} />
        </div>
        <div className="cartao resumo">
          {usuario && situacao && depois ? (
            <>
              <p className="linha-com-icone">
                <Avatar nome={nomeDe(usuario)} />
                <strong>{nomeDe(usuario)}</strong>
              </p>
              <dl>
                <div>
                  <dt>Antes</dt>
                  <dd>{creditoOuPendencia(situacao)}</dd>
                </div>
                <div>
                  <dt>Recebendo</dt>
                  <dd>{emReais(centavos)}</dd>
                </div>
              </dl>
              <p className="previa-da-situacao" data-situacao={depois.situacao} aria-live="polite">
                {depois.texto}
              </p>
            </>
          ) : (
            <p className="apoio">Escolha de quem são as cotas.</p>
          )}
          <button
            type="submit"
            className="largo"
            data-testid="receber-pagamento"
            disabled={enviando}
          >
            {usuario ? `Receber ${emReais(centavos)} de ${nomeDe(usuario)}` : 'Receber pagamento'}
          </button>
        </div>
      </div>
    </form>
  );
};

const NOME_DA_ORIGEM: Readonly<Record<Gasto['origem'], string>> = {
  caixinha: 'Pela caixinha',
  'proprio-bolso': 'Do próprio bolso',
};

/**
 * *Gastos* (gestor): the saldo da caixinha and what is left once the gastos a reembolsar are
 * reembolsados (RN-FIN-37); the gastos a reembolsar, to reembolsar; and the other gastos, month by
 * month, with their notas.
 */
export const Gastos = ({ token }: { token: string }) => {
  const [gastos, recarregarGastos] = useLeitura<readonly Gasto[]>(token, '/api/financeiro/gasto');
  const [usuarios, recarregarUsuarios] = useLeitura<readonly UsuarioRegistrado[]>(
    token,
    '/api/usuario',
  );
  const [caixinha, recarregarCaixinha] = useLeitura<CaixinhaLida>(
    token,
    '/api/financeiro/caixinha',
  );
  const recarregar = () => {
    recarregarGastos();
    recarregarUsuarios();
    recarregarCaixinha();
  };
  const { enviando, fazer, avisos } = useComando(recarregar);
  const [mes, setMes] = useState(() => mesEmCampoGrande(new Date()));
  const [falhaAoAbrir, setFalhaAoAbrir] = useState(false);

  if (!gastos || !usuarios || !caixinha) return <Carregando />;
  if (gastos.situacao !== 'ok' || usuarios.situacao !== 'ok' || caixinha.situacao !== 'ok')
    return (
      <>
        {avisos}
        <FalhaAoCarregar tentarDeNovo={recarregar} />
      </>
    );

  const nomes = new Map(usuarios.valor.map((usuario) => [usuario.id, nomeDe(usuario)]));
  const quemPagou = (gasto: Gasto) => nomes.get(gasto.participanteId) ?? 'Desconhecido';
  const pendentes = aReembolsar(gastos.valor);
  const doMes = gastos.valor.filter(
    (gasto) => !pendentes.includes(gasto) && mesEmCampoGrande(new Date(gasto.feitoEm)) === mes,
  );
  const verNota = async (gasto: Gasto) =>
    setFalhaAoAbrir(!(await abrirArquivo(token, `/api/financeiro/nota/${gasto.notaId}`)));
  const reembolsar = (gasto: Gasto) =>
    confirm(
      `Reembolsar ${emReais(gasto.valorEmCentavos)} a ${quemPagou(gasto)}? Sai da caixinha.`,
    ) &&
    fazer(
      () => comandar(token, `/api/financeiro/gasto/${gasto.id}/reembolsar`),
      'Reembolso feito.',
      'Não foi possível reembolsar.',
    );
  const dadosDe = (gasto: Gasto) => ({
    'data-testid': 'gasto',
    'data-tipo': gasto.tipo,
    'data-origem': gasto.origem,
    'data-reembolsado': gasto.reembolsado,
  });

  return (
    <>
      <div className="barra-de-acoes no-titulo">
        <Link className="botao contorno" to="/gastos/solicitar-complemento">
          Solicitar complemento
        </Link>
        <Link className="botao" to="/gastos/registrar-gasto">
          <Icone nome="mais" />
          Registrar gasto
        </Link>
      </div>
      {avisos}
      {falhaAoAbrir && <p role="alert">Não foi possível abrir a nota.</p>}
      <div className="colunas">
        <section className="cartao escuro" aria-labelledby="saldo-da-caixinha">
          <h2 id="saldo-da-caixinha" className="rotulo">
            Saldo da caixinha
          </h2>
          <p className="valor-grande" data-testid="saldo-da-caixinha">
            {emReais(caixinha.valor.saldoEmCentavos)}
          </p>
          {pendentes.length > 0 && (
            <p data-testid="saldo-depois-dos-reembolsos">
              Depois dos reembolsos:{' '}
              {emReais(saldoDepoisDosReembolsos(caixinha.valor.saldoEmCentavos, gastos.valor))}
            </p>
          )}
        </section>
        {pendentes.length > 0 && (
          <section className="cartao realce" aria-labelledby="a-reembolsar">
            <h2 id="a-reembolsar">A reembolsar</h2>
            <ul className="lista">
              {pendentes.map((gasto) => (
                <li key={gasto.id} {...dadosDe(gasto)}>
                  <p>
                    <strong>
                      {NOME_DO_TIPO_DE_GASTO[gasto.tipo]} · pago por {quemPagou(gasto)} ·{' '}
                      {emReais(gasto.valorEmCentavos)}
                    </strong>
                    <small>
                      Do próprio bolso · {dataEmCampoGrande(gasto.feitoEm)}. Sai da caixinha só
                      quando você reembolsar.
                    </small>
                  </p>
                  <div className="acoes">
                    <button type="button" className="fantasma" onClick={() => verNota(gasto)}>
                      <Icone nome="arquivo" />
                      Ver nota
                    </button>
                    <button
                      type="button"
                      className="secundario"
                      data-testid="reembolsar"
                      disabled={enviando}
                      aria-label={`Reembolsar ${emReais(gasto.valorEmCentavos)} a ${quemPagou(gasto)}`}
                      onClick={() => reembolsar(gasto)}
                    >
                      <Icone nome="reembolso" />
                      Reembolsar {quemPagou(gasto)}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <section aria-labelledby="gastos-do-mes">
        <div className="titulo-com-acao">
          <h2 id="gastos-do-mes">Gastos de {nomeDoMes(mes)}</h2>
          <MesNavegavel mes={mes} mudar={setMes} />
        </div>
        {doMes.length === 0 ? (
          <p className="cartao apoio">Nenhum gasto em {mesPorExtenso(mes)}.</p>
        ) : (
          <div className="cartao tabela">
            <table className="empilhada gastos">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Tipo de gasto</th>
                  <th scope="col">Pago</th>
                  <th scope="col">Registrado por</th>
                  <th scope="col" className="numero">
                    Valor
                  </th>
                  <th scope="col">Nota</th>
                </tr>
              </thead>
              <tbody>
                {doMes.map((gasto) => (
                  <tr key={gasto.id} {...dadosDe(gasto)}>
                    <td data-rotulo="Data">{dataEmCampoGrande(gasto.feitoEm)}</td>
                    <td data-rotulo="Tipo de gasto">
                      <strong>{NOME_DO_TIPO_DE_GASTO[gasto.tipo]}</strong>
                    </td>
                    <td data-rotulo="Pago">
                      {NOME_DA_ORIGEM[gasto.origem]}
                      {gasto.reembolsado && ', reembolsado'}
                    </td>
                    <td data-rotulo="Registrado por">{quemPagou(gasto)}</td>
                    <td data-rotulo="Valor" className="numero">
                      {emReais(gasto.valorEmCentavos)}
                    </td>
                    <td data-rotulo="Nota">
                      <button
                        type="button"
                        className="link"
                        aria-label={`Ver a nota do gasto de ${emReais(gasto.valorEmCentavos)}`}
                        onClick={() => verNota(gasto)}
                      >
                        Ver nota
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={4}>
                    Total registrado em {nomeDoMes(mes)}
                  </th>
                  <td data-rotulo="Total" className="numero">
                    {emReais(doMes.reduce((total, gasto) => total + gasto.valorEmCentavos, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  );
};

/**
 * *Registrar gasto*, under *Gastos* for the gestor and under *Caixinha* for the participante
 * (RN-FIN-26): the tipo de gasto, the valor total, how it was paid and the nota; then back to
 * `voltar`.
 */
export const RegistrarGasto = ({
  token,
  voltar,
  origem,
}: {
  token: string;
  voltar: string;
  origem: Gasto['origem'];
}) => {
  const { enviando, fazer, avisos } = useComando(() => {});
  const navigate = useNavigate();
  const registrar = aoEnviar(async (dados) => {
    const feito = 'Gasto registrado.';
    const registrado = await fazer(
      () =>
        registrarGasto(token, {
          valorEmCentavos: emCentavos(String(dados.get('valor'))),
          origem: dados.get('origem') as Gasto['origem'],
          tipo: dados.get('tipo') as Gasto['tipo'],
          nota: dados.get('nota') as File,
        }),
      feito,
      'Não foi possível registrar o gasto.',
    );
    if (registrado) navigate(voltar, { state: { feito } });
  });
  return (
    <form onSubmit={registrar} data-testid="registro-de-gasto" className="cartao pilha estreita">
      {avisos}
      <label className="campo">
        <span className="rotulo">Tipo de gasto</span>
        <select name="tipo" data-testid="tipo-de-gasto" required defaultValue="">
          <option value="" disabled>
            Escolha o tipo de gasto
          </option>
          {Object.entries(NOME_DO_TIPO_DE_GASTO).map(([tipo, nome]) => (
            <option key={tipo} value={tipo}>
              {nome}
            </option>
          ))}
        </select>
      </label>
      <CampoValor rotulo="Valor total (R$)" />
      <fieldset className="segmentado">
        <legend>Pago</legend>
        <div>
          {(['caixinha', 'proprio-bolso'] as const).map((cada) => (
            <label key={cada}>
              <input
                type="radio"
                name="origem"
                value={cada}
                data-testid={`origem-${cada}`}
                defaultChecked={cada === origem}
              />
              {NOME_DA_ORIGEM[cada]}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="nota">Do próprio bolso, sai da caixinha só quando o gestor reembolsar.</p>
      <CampoArquivo rotulo="Nota" ajuda="Foto ou PDF, até 5 MB." nome="nota" />
      <button type="submit" className="largo" data-testid="registrar-gasto" disabled={enviando}>
        Registrar gasto
      </button>
    </form>
  );
};

/**
 * *Solicitar complemento* (gestor), under *Gastos*: the valor is divided among the participantes
 * ativos.
 */
export const SolicitarComplemento = ({ token }: { token: string }) => {
  const { enviando, fazer, avisos } = useComando(() => {});
  const navigate = useNavigate();
  const solicitar = aoEnviar(async (dados) => {
    const valorEmCentavos = emCentavos(String(dados.get('valor')));
    if (
      !confirm(
        `Solicitar complemento de ${emReais(valorEmCentavos)}, dividido entre os participantes ativos?`,
      )
    )
      return;
    const feito = 'Complemento solicitado.';
    const solicitado = await fazer(
      () => comandar(token, '/api/financeiro/solicitar-complemento', { valorEmCentavos }),
      feito,
      'Não foi possível solicitar o complemento.',
    );
    if (solicitado) navigate('/gastos', { state: { feito } });
  });
  return (
    <section
      className="cartao pilha estreita"
      aria-label="Solicitar complemento"
      data-testid="solicitacao-de-complemento"
    >
      <p className="apoio">
        Quando o saldo não cobre os gastos. O valor é dividido em partes iguais entre todos os
        participantes ativos, inclusive os pendentes.
      </p>
      {avisos}
      <form onSubmit={solicitar} className="pilha">
        <CampoValor rotulo="Valor total (R$)" />
        <button
          type="submit"
          className="largo"
          data-testid="solicitar-complemento"
          disabled={enviando}
        >
          Solicitar complemento
        </button>
      </form>
    </section>
  );
};

const TIPOS_DE_COTA = ['so-cafe', 'completa'] as const;

/**
 * *Valor da cota* (gestor): the valores of this year, the gastos do ano anterior they come from,
 * and definir the valor of each tipo de cota for this year, while one is missing, or else for the
 * next.
 */
export const ValorDaCota = ({ token }: { token: string }) => {
  const [caixinha, recarregarCaixinha] = useLeitura<CaixinhaLida>(
    token,
    '/api/financeiro/caixinha',
  );
  const [valores, recarregarValores] = useLeitura<readonly ValorDaCotaLido[]>(
    token,
    '/api/participacao/tipo-de-cota',
  );
  const recarregar = () => {
    recarregarCaixinha();
    recarregarValores();
  };
  const { enviando, fazer, avisos } = useComando(recarregarValores);
  if (!caixinha || !valores) return <Carregando />;
  if (caixinha.situacao !== 'ok' || valores.situacao !== 'ok')
    return <FalhaAoCarregar tentarDeNovo={recarregar} />;

  const ano = anoAtual();
  const doAno = new Map(valores.valor.map((valor) => [valor.tipoDeCota, valor.valorEmCentavos]));
  const faltando = TIPOS_DE_COTA.filter((tipo) => !doAno.has(tipo));
  const alvo = faltando.length > 0 ? ano : ano + 1;
  const tipos = faltando.length > 0 ? faltando : TIPOS_DE_COTA;

  const definir = aoEnviar(async (dados) => {
    const definicoes = tipos.map((tipoDeCota) => ({
      tipoDeCota,
      valorEmCentavos: emCentavos(String(dados.get(`valor-${tipoDeCota}`))),
    }));
    const resumo = definicoes
      .map((d) => `${NOME_DO_TIPO_DE_COTA[d.tipoDeCota]}, ${emReais(d.valorEmCentavos)}`)
      .join('; ');
    if (
      !confirm(
        `Definir os valores por mês de ${alvo} (${resumo})? Depois, não mudam durante o ano.`,
      )
    )
      return;
    await fazer(
      async () => {
        for (const definicao of definicoes) {
          const definido = await comandar(token, '/api/participacao/definir-valor-da-cota', {
            ...definicao,
            ano: alvo,
          });
          if (!definido.feito) return definido;
        }
        return { feito: true };
      },
      `Valores de ${alvo} definidos.`,
      'Não foi possível definir o valor da cota.',
    );
  });

  return (
    <div className="colunas">
      <section className="cartao pilha" aria-labelledby="definir">
        <h2 id="definir">Definir {alvo}</h2>
        <p className="apoio">
          {alvo === ano
            ? `O valor da cota de ${ano} ainda não foi definido${faltando.length === 1 ? ` para ${NOME_DO_TIPO_DE_COTA[faltando[0] as TipoDeCota].toLowerCase()}` : ''}.`
            : `Se não definir até 1º de janeiro, ${alvo} repete os valores de ${ano}.`}
        </p>
        {avisos}
        <form
          onSubmit={definir}
          data-testid="definicao-do-valor-da-cota"
          data-ano={alvo}
          className="pilha"
        >
          <div className="lado-a-lado">
            {tipos.map((tipo) => {
              const atual = doAno.get(tipo);
              return (
                <CampoValor
                  key={tipo}
                  rotulo={`${NOME_DO_TIPO_DE_COTA[tipo]}, por mês (R$)`}
                  nome={`valor-${tipo}`}
                  ajuda={atual === undefined ? undefined : `Em ${ano}: ${emReais(atual)}`}
                />
              );
            })}
          </div>
          <p className="texto-alerta linha-com-icone">
            <Icone nome="alerta" />
            Depois de definido, o valor não muda durante o ano.
          </p>
          <button type="submit" data-testid="definir-valor-da-cota" disabled={enviando}>
            Definir valores de {alvo}
          </button>
        </form>
      </section>
      <div className="pilha">
        <section className="cartao" aria-labelledby="deste-ano">
          <h2 id="deste-ano" className="titulo-com-valor">
            {ano}
            <small className="linha-com-icone">
              <Icone nome="cadeado" />
              Vale até dezembro
            </small>
          </h2>
          <ValoresDaCota valores={valores.valor} />
        </section>
        <section className="cartao">
          <GastosDoAnoAnterior caixinha={caixinha.valor} />
        </section>
      </div>
    </div>
  );
};
