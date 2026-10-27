import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  type CaixinhaDoMes as CaixinhaDoMesLida,
  type Caixinha as CaixinhaLida,
  type Comando,
  type ComprovanteEnviado,
  type CreditoEPendente,
  comandar,
  guardarAntes,
  type Leitura,
  ler,
  mensagemDaFalha,
  type Participacao,
  type Situacao,
  type TipoDeCota,
  type TipoDeGasto,
  type ValorDaCota,
} from './api';
import {
  dataEmCampoGrande,
  emCentavos,
  emReais,
  ITENS_DO_TIPO_DE_COTA,
  mascaraDeReais,
  mesEmCampoGrande,
  mesPorExtenso,
  NOME_DO_TIPO_DE_COTA,
  NOME_DO_TIPO_DE_GASTO,
  nomeDoMes,
  outroMes,
} from './formato';
import { Icone, type NomeDoIcone } from './icones';

/** Reads a recurso when mounted; gives the leitura (undefined while loading) and how to reload it. */
export const useLeitura = <T,>(token: string, caminho: string) => {
  const [leitura, setLeitura] = useState<Leitura<T>>();
  const ultima = useRef(0);
  // Only the latest request sets the leitura: an older answer arriving late would show stale data.
  const carregar = useCallback(async () => {
    const minha = ++ultima.current;
    const lida = await ler<T>(token, caminho);
    if (minha === ultima.current) setLeitura(lida);
  }, [token, caminho]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  return [leitura, carregar] as const;
};

/** Announces that the page is loading. */
export const Carregando = () => (
  <p role="status" data-testid="carregando">
    Carregando…
  </p>
);

/** Announces that the page could not load, with a button to try again. */
export const FalhaAoCarregar = ({ tentarDeNovo }: { tentarDeNovo: () => void }) => (
  <>
    <p role="alert">Não foi possível carregar esta página.</p>
    <button type="button" onClick={tentarDeNovo}>
      Tentar de novo
    </button>
  </>
);

/**
 * Runs a comando, announces how it went and then reloads the page's leituras. A subpágina that
 * goes back to its page when done passes the aviso in the navigation `state` (`{ feito }`), and
 * the page announces it.
 */
export const useComando = (recarregar: () => void) => {
  const { state } = useLocation();
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{
    readonly feito?: string | undefined;
    readonly falha?: string;
  }>(() => ({
    feito: (state as { feito?: string } | null)?.feito,
  }));
  const fazer = async (comando: () => Promise<Comando>, feito: string, falha: string) => {
    setEnviando(true);
    setAviso({});
    const resultado = await comando();
    setEnviando(false);
    setAviso(resultado.feito ? { feito } : { falha: mensagemDaFalha(resultado.erro, falha) });
    recarregar();
    return resultado.feito;
  };
  const avisos = (
    <>
      {aviso.falha && (
        <p role="alert" className="aviso-falha" data-testid="aviso-falha">
          {aviso.falha}
        </p>
      )}
      <p role="status" className="aviso-feito" data-testid="aviso-feito">
        {aviso.feito}
      </p>
    </>
  );
  return { enviando, fazer, avisos };
};

/** What a confirmação asks: the question, what follows, the action's name and if it is destrutiva. */
export type Pedido = {
  readonly titulo: string;
  readonly texto: string;
  readonly acao: string;
  readonly destrutiva?: boolean;
};

/**
 * Confirmação of a critical action, in a modal `<dialog>`: it holds the focus, closes with Esc and
 * starts on Voltar, so Enter does not confirm by accident. `confirmar` opens it and gives whether
 * the person confirmed; the page renders `confirmacao`.
 */
export const useConfirmacao = () => {
  const dialogo = useRef<HTMLDialogElement>(null);
  const resposta = useRef<(sim: boolean) => void>(undefined);
  const [pedido, setPedido] = useState<Pedido>();
  const titulo = useId();
  useEffect(() => {
    const aberto = dialogo.current;
    if (!pedido || !aberto || aberto.open) return;
    aberto.returnValue = '';
    aberto.showModal();
  }, [pedido]);
  const confirmar = (novo: Pedido) => {
    setPedido(novo);
    return new Promise<boolean>((resolver) => {
      resposta.current = resolver;
    });
  };
  const confirmacao = (
    <dialog
      ref={dialogo}
      className="confirmacao"
      data-testid="confirmacao"
      aria-labelledby={titulo}
      onClose={() => {
        resposta.current?.(dialogo.current?.returnValue === 'sim');
        resposta.current = undefined;
        setPedido(undefined);
      }}
    >
      <form method="dialog">
        <h2 id={titulo}>{pedido?.titulo}</h2>
        <p className="apoio">{pedido?.texto}</p>
        <div className="acoes">
          <button type="submit" value="nao" className="contorno" data-testid="voltar">
            Voltar
          </button>
          <button
            type="submit"
            value="sim"
            className={pedido?.destrutiva ? 'perigo' : undefined}
            data-testid="confirmar-acao"
          >
            {pedido?.acao}
          </button>
        </div>
      </form>
    </dialog>
  );
  return { confirmar, confirmacao };
};

/**
 * Handles a form submit with its data. The form is read before any await: React lets go of the
 * event right after the handler.
 */
export const aoEnviar =
  (enviar: (dados: FormData, form: HTMLFormElement) => unknown) =>
  (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    enviar(new FormData(evento.currentTarget), evento.currentTarget);
  };

/**
 * A valor in reais, with the mask of `mascaraDeReais` (`R$ 30,00`), sent as `nome` (`valor`);
 * `inicial` (in centavos) fills it in. With `aoMudar`, the page holds the valor typed, masked.
 */
export const CampoValor = ({
  rotulo,
  inicial,
  nome = 'valor',
  valor,
  aoMudar,
  ajuda,
  obrigatorio = true,
}: {
  rotulo: string;
  inicial?: number;
  nome?: string;
  valor?: string;
  aoMudar?: (valor: string) => void;
  ajuda?: string | undefined;
  obrigatorio?: boolean;
}) => {
  const id = useId();
  return (
    <label className="campo">
      <span className="rotulo">{rotulo}</span>
      <input
        name={nome}
        data-testid={nome}
        inputMode="numeric"
        autoComplete="off"
        placeholder="R$ 0,00"
        aria-describedby={ajuda ? id : undefined}
        {...(aoMudar
          ? { value: valor ?? '' }
          : { defaultValue: inicial === undefined ? undefined : emReais(inicial) })}
        onChange={(evento: ChangeEvent<HTMLInputElement>) => {
          const mascarado = mascaraDeReais(evento.target.value);
          if (aoMudar) aoMudar(mascarado);
          else evento.target.value = mascarado;
        }}
        required={obrigatorio}
      />
      {ajuda && (
        <small id={id} className="ajuda">
          {ajuda}
        </small>
      )}
    </label>
  );
};

/** Types accepted for a comprovante or a nota. */
export const ARQUIVOS = 'application/pdf,image/jpeg,image/png';

/** An arquivo (comprovante or nota), picked or dropped on the field, which shows the one picked. */
export const CampoArquivo = ({
  rotulo,
  ajuda,
  nome,
  obrigatorio = true,
}: {
  rotulo: string;
  ajuda: string;
  nome: string;
  obrigatorio?: boolean;
}) => {
  const [arquivo, setArquivo] = useState<File>();
  return (
    <label className="campo">
      <span className="rotulo">{rotulo}</span>
      <span className="arquivo" data-escolhido={arquivo ? 'sim' : 'nao'}>
        <span className="icone-fundo">
          <Icone nome={arquivo ? 'arquivo' : 'enviar'} />
        </span>
        <span>
          <strong>{arquivo?.name ?? 'Escolher arquivo'}</strong>
          <small>
            {arquivo ? `${Math.ceil(arquivo.size / 1024)} KB · toque para trocar` : ajuda}
          </small>
        </span>
        <input
          type="file"
          name={nome}
          data-testid="arquivo"
          accept={ARQUIVOS}
          required={obrigatorio}
          onChange={(evento) => setArquivo(evento.target.files?.[0])}
        />
      </span>
    </label>
  );
};

/** A situação, as a selo: an icon and a word besides the color (Design System, Situação). */
export type SituacaoDoSelo =
  | 'em-dia'
  | 'pendente'
  | 'credito'
  | 'a-confirmar'
  | 'confirmado'
  | 'recusado'
  | 'saiu';

const SELOS: Readonly<Record<SituacaoDoSelo, readonly [string, NomeDoIcone?]>> = {
  'em-dia': ['Em dia', 'check'],
  pendente: ['Pendente', 'relogio'],
  credito: ['Com crédito', 'mais'],
  'a-confirmar': ['A confirmar', 'relogio'],
  confirmado: ['Confirmado', 'check'],
  recusado: ['Recusado', 'x'],
  saiu: ['Saiu'],
};

/** The selo of a situação; `rotulo` says it in other words. */
export const Selo = ({ situacao, rotulo }: { situacao: SituacaoDoSelo; rotulo?: string }) => {
  const [palavra, icone] = SELOS[situacao];
  return (
    <span className="selo" data-selo={situacao}>
      {icone && <Icone nome={icone} />}
      {rotulo ?? palavra}
    </span>
  );
};

type Saldo = Pick<CreditoEPendente, 'creditoEmCentavos' | 'pendenteEmCentavos'>;

/** Whether a participante is pendente, has crédito or is em dia. */
export const situacaoDe = (saldo: Saldo): 'pendente' | 'credito' | 'em-dia' =>
  saldo.pendenteEmCentavos > 0 ? 'pendente' : saldo.creditoEmCentavos > 0 ? 'credito' : 'em-dia';

/** RN-FIN-35: how the situação of `quem` stands once `valorEmCentavos` is paid. */
export const depoisDoPagamento = (quem: string, saldo: Saldo, valorEmCentavos: number) => {
  const depois = saldo.creditoEmCentavos - saldo.pendenteEmCentavos + valorEmCentavos;
  if (depois > 0)
    return {
      situacao: 'credito',
      texto: `${quem} fica com ${emReais(depois)} de crédito.`,
    } as const;
  if (depois < 0)
    return {
      situacao: 'pendente',
      texto: `${quem} continua pendente em ${emReais(-depois)}.`,
    } as const;
  return { situacao: 'em-dia', texto: `${quem} fica em dia, sem crédito.` } as const;
};

/**
 * RN-FIN-34: the atalhos of the valor pago, counted from the month `AAAA-MM`: one month, until
 * December and a semester of the cota; a valor already offered is not repeated.
 */
export const atalhosDoValorPago = (cotaEmCentavos: number, mes: string) => {
  const atalhos = (
    [
      ['1 mês', 1],
      ['Até dezembro', 13 - Number(mes.slice(5))],
      ['Semestre', 6],
    ] as const
  ).map(([rotulo, meses]) => ({ rotulo, valorEmCentavos: cotaEmCentavos * meses }));
  return atalhos.filter(
    (atalho, i) => atalhos.findIndex((a) => a.valorEmCentavos === atalho.valorEmCentavos) === i,
  );
};

/** A month to browse, with buttons to the one before and the one after, up to the current. */
export const MesNavegavel = ({ mes, mudar }: { mes: string; mudar: (mes: string) => void }) => (
  <fieldset className="mes">
    <legend className="visualmente-oculto">Mês</legend>
    <button
      type="button"
      className="fantasma quadrado"
      aria-label="Mês anterior"
      onClick={() => mudar(outroMes(mes, -1))}
    >
      <Icone nome="esquerda" />
    </button>
    <span aria-live="polite">{mesPorExtenso(mes)}</span>
    <button
      type="button"
      className="fantasma quadrado"
      aria-label="Mês seguinte"
      disabled={mes >= mesEmCampoGrande(new Date())}
      onClick={() => mudar(outroMes(mes, 1))}
    >
      <Icone nome="direita" />
    </button>
  </fieldset>
);

/** A valor per tipo de gasto, each with a bar against the largest; `testId` names each valor. */
export const PorTipoDeGasto = ({
  valores,
  testId,
}: {
  valores: Readonly<Record<TipoDeGasto, number>>;
  testId: (tipo: string) => string;
}) => {
  const maior = Math.max(1, ...Object.values(valores));
  return (
    <ul className="barras">
      {Object.entries(NOME_DO_TIPO_DE_GASTO).map(([tipo, nome]) => {
        const valor = valores[tipo as TipoDeGasto];
        return (
          <li key={tipo}>
            <span>{nome}</span>
            <span data-testid={testId(tipo)}>{emReais(valor)}</span>
            <span className="barra" aria-hidden="true">
              <span style={{ width: `${(100 * valor) / maior}%` }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
};

/** The year now, in Campo Grande (ADR 0015). */
export const anoAtual = () => Number(mesEmCampoGrande(new Date()).slice(0, 4));

/** The gastos do ano anterior per tipo de gasto, and their total. */
export const GastosDoAnoAnterior = ({ caixinha }: { caixinha: CaixinhaLida }) => (
  <div data-testid="gastos-do-ano-anterior">
    <h3 className="titulo-com-valor">
      Gastos de {anoAtual() - 1}
      <span data-testid="total-do-ano-anterior">
        {emReais(caixinha.gastosDoAnoAnteriorEmCentavos)}
      </span>
    </h3>
    <PorTipoDeGasto
      valores={caixinha.gastosDoAnoAnteriorPorTipoEmCentavos}
      testId={(tipo) => `gasto-do-ano-anterior-${tipo}`}
    />
  </div>
);

/** The valor of each tipo de cota this year, or that it is not defined yet. */
export const ValoresDaCota = ({ valores }: { valores: readonly ValorDaCota[] }) =>
  valores.length === 0 ? (
    <p data-testid="valor-da-cota-indefinido">O valor da cota deste ano ainda não foi definido.</p>
  ) : (
    <dl className="valores-da-cota" data-testid="valores-da-cota" data-ano={valores[0]?.ano}>
      {valores.map((valor) => (
        <div key={valor.tipoDeCota}>
          <dt>{NOME_DO_TIPO_DE_COTA[valor.tipoDeCota]}</dt>
          <dd data-testid={`valor-da-cota-${valor.tipoDeCota}`}>
            {emReais(valor.valorEmCentavos)}
          </dd>
        </div>
      ))}
    </dl>
  );

/** Enviar comprovante: guarda the arquivo for the participante, then sends it with the valor pago. */
export const enviarComprovante = (
  token: string,
  {
    participanteId,
    valorEmCentavos,
    comprovante,
  }: {
    readonly participanteId: string;
    readonly valorEmCentavos: number;
    readonly comprovante: File;
  },
) =>
  guardarAntes(
    token,
    '/api/financeiro/guardar-comprovante',
    { participanteId, arquivo: comprovante },
    (comprovanteId) =>
      comandar(token, '/api/financeiro/enviar-comprovante', { valorEmCentavos, comprovanteId }),
  );

/** Editar comprovante: a new arquivo, if picked, is guardado first; else the current one stays. */
export const editarComprovante = (
  token: string,
  {
    id,
    participanteId,
    comprovanteId,
    valorEmCentavos,
    comprovante,
  }: Pick<ComprovanteEnviado, 'id' | 'participanteId' | 'comprovanteId' | 'valorEmCentavos'> & {
    readonly comprovante: File | null;
  },
): Promise<Comando> => {
  const editar = (novo = comprovanteId) =>
    comandar(token, `/api/financeiro/comprovante-enviado/${id}/editar`, {
      valorEmCentavos,
      comprovanteId: novo,
    });
  if (!comprovante?.size) return editar();
  return guardarAntes(
    token,
    '/api/financeiro/guardar-comprovante',
    { participanteId, arquivo: comprovante },
    editar,
  );
};

/** What the situação of a comprovante enviado means, in one line, under its selo. */
export const detalheDoComprovante = (comprovante: ComprovanteEnviado) =>
  comprovante.situacao === 'confirmado'
    ? `Valor confirmado: ${emReais(comprovante.valorConfirmadoEmCentavos)}`
    : comprovante.situacao === 'recusado'
      ? `Motivo: ${comprovante.motivo}`
      : 'Vale como pagamento quando o gestor confirmar.';

// The participante's comprovantes enviados: while a confirmar, editar or cancelar.
const Comprovantes = ({ token }: { token: string }) => {
  const [comprovantes, recarregar] = useLeitura<readonly ComprovanteEnviado[]>(
    token,
    '/api/financeiro/comprovante-enviado/eu',
  );
  const { enviando, fazer, avisos } = useComando(recarregar);
  const { confirmar, confirmacao } = useConfirmacao();
  if (!comprovantes) return <Carregando />;
  if (comprovantes.situacao !== 'ok') return <FalhaAoCarregar tentarDeNovo={recarregar} />;

  const editar = (comprovante: ComprovanteEnviado) =>
    aoEnviar((dados) =>
      fazer(
        () =>
          editarComprovante(token, {
            ...comprovante,
            valorEmCentavos: emCentavos(String(dados.get('valor'))),
            comprovante: dados.get('comprovante') as File | null,
          }),
        'Comprovante editado.',
        'Não foi possível editar o comprovante.',
      ),
    );
  const cancelar = async (comprovante: ComprovanteEnviado) =>
    (await confirmar({
      titulo: `Cancelar o envio do comprovante de ${emReais(comprovante.valorEmCentavos)}?`,
      texto: 'O gestor não confere mais este comprovante. Dá para enviar outro quando quiser.',
      acao: 'Cancelar envio',
      destrutiva: true,
    })) &&
    fazer(
      () => comandar(token, `/api/financeiro/comprovante-enviado/${comprovante.id}/cancelar`),
      'Envio cancelado.',
      'Não foi possível cancelar o envio.',
    );

  return (
    <section aria-labelledby="comprovantes" data-testid="comprovantes">
      <h2 id="comprovantes">Comprovantes enviados</h2>
      {avisos}
      {confirmacao}
      {comprovantes.valor.length === 0 ? (
        <p className="cartao apoio">Nenhum comprovante enviado.</p>
      ) : (
        <ul className="cartao lista" data-testid="comprovantes-enviados">
          {comprovantes.valor.map((comprovante) => {
            const qual = `comprovante de ${emReais(comprovante.valorEmCentavos)} enviado em ${dataEmCampoGrande(comprovante.enviadoEm)}`;
            return (
              <li
                key={comprovante.id}
                data-testid="comprovante-enviado"
                data-situacao={comprovante.situacao}
              >
                <div className="linha">
                  <p>
                    <strong>{emReais(comprovante.valorEmCentavos)}</strong>
                    <small>Enviado em {dataEmCampoGrande(comprovante.enviadoEm)}</small>
                  </p>
                  <Selo situacao={comprovante.situacao} />
                </div>
                <p
                  className={comprovante.situacao === 'recusado' ? 'motivo' : 'apoio'}
                  data-testid="situacao"
                >
                  {detalheDoComprovante(comprovante)}
                </p>
                {comprovante.situacao === 'a-confirmar' && (
                  <div className="acoes">
                    <details>
                      <summary
                        className="botao contorno"
                        aria-label={`Editar ${qual}`}
                        data-testid="editar-comprovante"
                      >
                        Editar
                      </summary>
                      <form onSubmit={editar(comprovante)} data-testid="edicao-de-comprovante">
                        <CampoValor rotulo="Valor pago" inicial={comprovante.valorEmCentavos} />
                        <CampoArquivo
                          rotulo="Outro comprovante (opcional)"
                          ajuda="Foto ou PDF, até 5 MB."
                          nome="comprovante"
                          obrigatorio={false}
                        />
                        <button type="submit" data-testid="salvar" disabled={enviando}>
                          Salvar
                        </button>
                      </form>
                    </details>
                    <button
                      type="button"
                      className="contorno"
                      data-testid="cancelar-envio"
                      disabled={enviando}
                      aria-label={`Cancelar o envio do ${qual}`}
                      onClick={() => cancelar(comprovante)}
                    >
                      Cancelar envio
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const TIPOS_DE_COTA = ['so-cafe', 'completa'] as const;

const outroTipo = (tipo: TipoDeCota): TipoDeCota => (tipo === 'so-cafe' ? 'completa' : 'so-cafe');

const valorDe = (valores: readonly ValorDaCota[], tipo: TipoDeCota) =>
  valores.find((valor) => valor.tipoDeCota === tipo)?.valorEmCentavos;

const EntrarNaCopa = ({
  inicial,
  valores,
  desabilitado,
  entrar,
}: {
  inicial: TipoDeCota;
  valores: readonly ValorDaCota[];
  desabilitado: boolean;
  entrar: (tipoDeCota: TipoDeCota) => void;
}) => {
  const [tipo, setTipo] = useState(inicial);
  const valor = valorDe(valores, tipo);
  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    entrar(tipo);
  };
  return (
    <section aria-labelledby="entrar-na-copa" className="entrar">
      <p className="sobretitulo" data-testid="nao-participa">
        Você ainda não participa
      </p>
      <h2 id="entrar-na-copa" className="titulo-grande">
        Entre na copa
      </h2>
      <p className="apoio">
        Escolha o tipo de cota. Dá para trocar depois, valendo a partir do mês seguinte.
      </p>
      <form onSubmit={enviar}>
        <fieldset>
          <legend>Tipo de cota{valores[0] && ` · valores mensais de ${valores[0].ano}`}</legend>
          <div className="opcoes-em-cartao">
            {TIPOS_DE_COTA.map((cada) => {
              const valorDoTipo = valorDe(valores, cada);
              return (
                <label key={cada} className="opcao-em-cartao">
                  <input
                    type="radio"
                    name="tipoDeCota"
                    value={cada}
                    data-testid={`tipo-de-cota-${cada}`}
                    checked={cada === tipo}
                    onChange={() => setTipo(cada)}
                  />
                  <strong>{NOME_DO_TIPO_DE_COTA[cada]}</strong>
                  {valorDoTipo !== undefined && (
                    <span className="valor-medio">
                      {emReais(valorDoTipo)} <small>por mês</small>
                    </span>
                  )}
                  <span className="apoio">{ITENS_DO_TIPO_DE_COTA[cada]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="aviso-espuma com-acao">
          <Icone nome="info" />
          <p>
            {valor === undefined ? (
              'Ao entrar, você passa a dever a cota de cada mês, a partir deste.'
            ) : (
              <>
                Ao entrar, você já deve a cota de {nomeDoMes(mesEmCampoGrande(new Date()))}, de{' '}
                <strong>{emReais(valor)}</strong>.
              </>
            )}{' '}
            Pague por PIX e envie o comprovante aqui, ou entregue em dinheiro ao gestor.
          </p>
          <button type="submit" data-testid="pedir-entrada" disabled={desabilitado}>
            Entrar com a cota {NOME_DO_TIPO_DE_COTA[tipo].toLowerCase()}
          </button>
        </div>
      </form>
    </section>
  );
};

const SituacaoEmDestaque = ({ situacao }: { situacao: Situacao }) => {
  const qual = situacaoDe(situacao);
  return (
    <section className="cartao destaque" aria-labelledby="situacao" data-testid={qual}>
      <h2 id="situacao" className="visualmente-oculto">
        Situação
      </h2>
      <Selo situacao={qual} />
      <p className="valor-grande">
        {emReais(qual === 'pendente' ? situacao.pendenteEmCentavos : situacao.creditoEmCentavos)}
      </p>
      <p className="apoio">
        {qual === 'pendente'
          ? 'Sem multa nem juros: acerte quando puder.'
          : qual === 'credito'
            ? 'De crédito, abatido das próximas cotas e complementos.'
            : 'Nenhum crédito nem pendência.'}
      </p>
      <Link className="botao" to="/enviar-comprovante" data-testid="ir-enviar-comprovante">
        <Icone nome="enviar" />
        Enviar comprovante do PIX
      </Link>
      <p className="nota">Pagou em dinheiro? O gestor registra para você.</p>
    </section>
  );
};

const CotasEComplementos = ({ situacao }: { situacao: Situacao }) =>
  situacao.cotas.length + situacao.complementos.length > 0 && (
    <section className="cartao" aria-labelledby="cotas">
      <h2 id="cotas">Cotas e complementos</h2>
      <ul className="lista">
        {situacao.cotas.map((cota) => (
          <li
            key={cota.mes}
            className="linha"
            data-testid="cota"
            data-tipo-de-cota={cota.tipoDeCota}
          >
            <p>
              <strong>Cota de {mesPorExtenso(cota.mes)}</strong>
              <small>{NOME_DO_TIPO_DE_COTA[cota.tipoDeCota]}</small>
            </p>
            <span className="valor">{emReais(cota.valorEmCentavos)}</span>
          </li>
        ))}
        {situacao.complementos.map((complemento) => (
          <li key={complemento.id} className="linha" data-testid="complemento">
            <p>
              <strong>Complemento</strong>
              <small>Solicitado em {dataEmCampoGrande(complemento.solicitadoEm)}</small>
            </p>
            <span className="valor">{emReais(complemento.parteEmCentavos)}</span>
          </li>
        ))}
      </ul>
    </section>
  );

/**
 * *Minha situação*: the crédito or pendência in evidence, the comprovantes enviados, the cotas and
 * complementos, and the participação (pedir entrada, trocar tipo de cota, sair da copa).
 */
export const MinhaSituacao = ({ token }: { token: string }) => {
  const [participacao, recarregarParticipacao] = useLeitura<Participacao>(
    token,
    '/api/participacao/participante/eu',
  );
  const [situacao, recarregarSituacao] = useLeitura<Situacao>(
    token,
    '/api/financeiro/participante/eu',
  );
  const [valores] = useLeitura<readonly ValorDaCota[]>(token, '/api/participacao/tipo-de-cota');
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string>();
  const [feito, setFeito] = useState<string>();
  const { confirmar, confirmacao } = useConfirmacao();

  const recarregar = () => {
    recarregarParticipacao();
    recarregarSituacao();
  };
  const fazer = async (caminho: string, resultado: readonly [string, string], corpo?: unknown) => {
    setEnviando(true);
    setFalha(undefined);
    setFeito(undefined);
    const comandado = await comandar(token, caminho, corpo);
    setEnviando(false);
    if (comandado.feito) setFeito(resultado[0]);
    else setFalha(resultado[1]);
    recarregar();
  };

  if (!participacao || !situacao || !valores) return <Carregando />;
  if (participacao.situacao === 'erro' || situacao.situacao === 'erro')
    return <FalhaAoCarregar tentarDeNovo={recarregar} />;

  const atual = participacao.situacao === 'ok' ? participacao.valor : undefined;
  const doAno = valores.situacao === 'ok' ? valores.valor : [];
  const minha = situacao.situacao === 'ok' ? situacao.valor : undefined;
  const pedirSaida = async () =>
    (await confirmar({
      titulo: 'Sair da copa?',
      texto: 'Seu crédito ou pendência continua valendo se você voltar.',
      acao: 'Sair da copa',
      destrutiva: true,
    })) && fazer('/api/participacao/sair', ['Saída pedida.', 'Não foi possível pedir a saída.']);
  const tipoDaCota = atual?.troca?.tipoDeCota ?? atual?.tipoDeCota ?? 'completa';
  const valorDaMinha = atual && valorDe(doAno, atual.tipoDeCota);

  return (
    <>
      {falha && (
        <p role="alert" className="aviso-falha" data-testid="aviso-falha">
          {falha}
        </p>
      )}
      <p role="status" className="aviso-feito" data-testid="aviso-feito">
        {feito}
      </p>
      {confirmacao}
      {!atual?.participando && (
        <EntrarNaCopa
          inicial={tipoDaCota}
          valores={doAno}
          desabilitado={enviando}
          entrar={async (tipoDeCota) => {
            const valor = valorDe(doAno, tipoDeCota);
            const mes = nomeDoMes(mesEmCampoGrande(new Date()));
            const sim = await confirmar({
              titulo: `Entrar na copa com a cota ${NOME_DO_TIPO_DE_COTA[tipoDeCota].toLowerCase()}?`,
              texto: `Você já passa a dever a cota de ${mes}${valor === undefined ? '' : `, de ${emReais(valor)}`}. Dá para trocar o tipo de cota depois, valendo a partir do mês seguinte.`,
              acao: 'Entrar na copa',
            });
            if (sim)
              fazer(
                '/api/participacao/entrar',
                ['Entrada pedida.', 'Não foi possível pedir a entrada.'],
                { tipoDeCota },
              );
          }}
        />
      )}
      <div className="colunas">
        <div className="pilha">
          {minha && <SituacaoEmDestaque situacao={minha} />}
          {minha && <Comprovantes token={token} />}
        </div>
        <div className="pilha">
          {minha && <CotasEComplementos situacao={minha} />}
          {atual?.participando && (
            <section className="cartao" aria-labelledby="minha-cota">
              <h2 id="minha-cota">Minha cota</h2>
              <div
                className="linha-com-icone"
                data-testid="participando"
                data-tipo-de-cota={atual.tipoDeCota}
              >
                <span className="icone-fundo">
                  <Icone nome="cafe" />
                </span>
                <p>
                  <strong>
                    {NOME_DO_TIPO_DE_COTA[atual.tipoDeCota]}
                    {valorDaMinha !== undefined && ` · ${emReais(valorDaMinha)} por mês`}
                  </strong>
                  <small>{ITENS_DO_TIPO_DE_COTA[atual.tipoDeCota]}</small>
                </p>
              </div>
              {atual.troca && (
                <p
                  className="aviso-espuma"
                  data-testid="troca-de-tipo-de-cota"
                  data-tipo-de-cota={atual.troca.tipoDeCota}
                  data-a-partir-de={atual.troca.aPartirDe}
                >
                  A partir de {mesPorExtenso(atual.troca.aPartirDe)}, ela passa a ser{' '}
                  {NOME_DO_TIPO_DE_COTA[atual.troca.tipoDeCota]}.
                </p>
              )}
              <button
                type="button"
                className="secundario largo"
                data-testid="trocar-tipo-de-cota"
                disabled={enviando}
                onClick={() =>
                  fazer(
                    '/api/participacao/trocar-tipo-de-cota',
                    ['Tipo de cota trocado.', 'Não foi possível trocar o tipo de cota.'],
                    { tipoDeCota: outroTipo(tipoDaCota) },
                  )
                }
              >
                <Icone nome="trocar" />
                Trocar para {NOME_DO_TIPO_DE_COTA[outroTipo(tipoDaCota)].toLowerCase()}
              </button>
              <p className="nota">A troca vale a partir do mês seguinte.</p>
            </section>
          )}
          {atual?.participando && (
            <section aria-labelledby="participacao" className="discreta">
              <h2 id="participacao" className="visualmente-oculto">
                Participação
              </h2>
              <button
                type="button"
                className="destrutivo"
                data-testid="pedir-saida"
                disabled={enviando}
                onClick={pedirSaida}
              >
                Sair da copa
              </button>
              <p className="nota">
                O crédito e o que estiver devido ficam guardados para quando voltar.
              </p>
            </section>
          )}
        </div>
      </div>
    </>
  );
};

/**
 * *Desativar meu acesso*, opened from the menu da conta of the visão do participante: what follows
 * (RN-PAR-08, RN-USU-02, RN-USU-04), sair da copa for who only wants to stop paying, and the crédito
 * or pendência, which stays. Desativar asks for confirmação (RNF-12); once done, `desativado` shows
 * the acesso desativado.
 */
export const DesativarMeuAcesso = ({
  token,
  usuarioId,
  desativado,
}: {
  token: string;
  usuarioId: string;
  desativado: () => void;
}) => {
  const [situacao] = useLeitura<Situacao>(token, '/api/financeiro/participante/eu');
  const { confirmar, confirmacao } = useConfirmacao();
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState(false);
  if (!situacao) return <Carregando />;

  // Whoever never asked for entrada has no situação: nothing to keep, nor a copa to leave.
  const saldo = situacao.situacao === 'ok' ? situacao.valor : undefined;
  const qual = saldo && situacaoDe(saldo);
  // Once desativado, every leitura answers 403: the page leaves for the acesso desativado.
  const desativar = async () => {
    const sim = await confirmar({
      titulo: 'Desativar seu acesso ao FACOFFEE?',
      texto: 'Sua participação termina, e só o gestor pode reativar o acesso.',
      acao: 'Desativar meu acesso',
      destrutiva: true,
    });
    if (!sim) return;
    setEnviando(true);
    setFalha(false);
    if ((await comandar(token, `/api/usuario/${usuarioId}/desativar`)).feito) return desativado();
    setEnviando(false);
    setFalha(true);
  };

  return (
    <>
      <p className="apoio">Para quem não vai mais usar o FACOFFEE.</p>
      {confirmacao}
      {falha && (
        <p role="alert" className="aviso-falha" data-testid="aviso-falha">
          Não foi possível desativar seu acesso.
        </p>
      )}
      <div className="colunas">
        <div className="pilha">
          <section className="cartao" aria-labelledby="o-que-acontece">
            <h2 id="o-que-acontece">O que acontece</h2>
            <ul className="com-icone">
              <li>
                <Icone nome="cafe" />
                Sua participação na copa termina.
              </li>
              <li>
                <Icone nome="cadeado" />
                Você não acessa mais o FACOFFEE.
              </li>
              <li>
                <Icone nome="reembolso" />
                Só o gestor reativa o acesso. Reativado, você pede a entrada na copa de novo.
              </li>
            </ul>
          </section>
          <div className="acoes">
            <button
              type="button"
              className="perigo"
              data-testid="desativar-meu-acesso"
              disabled={enviando}
              onClick={desativar}
            >
              Desativar meu acesso
            </button>
            <Link className="botao contorno" to="/">
              Continuar com o acesso
            </Link>
          </div>
        </div>
        <div className="pilha">
          {saldo?.ativo && (
            <Link className="chamada espuma" to="/" data-testid="ir-sair-da-copa">
              <Icone nome="info" />
              <span>
                <strong>Só quer parar de pagar a cota?</strong>
                <small>Saia da copa em Minha situação: o acesso continua.</small>
              </span>
              <Icone nome="direita" />
            </Link>
          )}
          {saldo && qual === 'pendente' && (
            <p className="previa-da-situacao" data-situacao="pendente">
              Você deve {emReais(saldo.pendenteEmCentavos)}. O que está devido fica guardado; se
              puder, acerte com o gestor antes.
            </p>
          )}
          {saldo && qual === 'credito' && (
            <p className="previa-da-situacao" data-situacao="credito">
              Você tem {emReais(saldo.creditoEmCentavos)} de crédito. Ele fica guardado para quando
              voltar.
            </p>
          )}
        </div>
      </div>
    </>
  );
};

/**
 * *Enviar comprovante*, under *Minha situação*: the comprovante do PIX with the valor pago, which
 * starts at the pendente, with atalhos of the cota (RN-FIN-34) and how the situação stands once
 * the gestor confirms it (RN-FIN-35).
 */
export const EnviarComprovante = ({
  token,
  participanteId,
}: {
  token: string;
  participanteId: string;
}) => {
  const [situacao, recarregar] = useLeitura<Situacao>(token, '/api/financeiro/participante/eu');
  const [participacao] = useLeitura<Participacao>(token, '/api/participacao/participante/eu');
  const [valores] = useLeitura<readonly ValorDaCota[]>(token, '/api/participacao/tipo-de-cota');
  const { enviando, fazer, avisos } = useComando(() => {});
  const [valor, setValor] = useState<string>();
  const navigate = useNavigate();

  if (!situacao || !participacao || !valores) return <Carregando />;
  if (situacao.situacao === 'nao-encontrado')
    return <p>Só quem já pediu entrada na copa envia comprovante.</p>;
  if (situacao.situacao !== 'ok') return <FalhaAoCarregar tentarDeNovo={recarregar} />;

  const saldo = situacao.valor;
  const campo = valor ?? (saldo.pendenteEmCentavos > 0 ? emReais(saldo.pendenteEmCentavos) : '');
  const centavos = campo ? emCentavos(campo) : 0;
  const tipo = participacao.situacao === 'ok' ? participacao.valor.tipoDeCota : undefined;
  const cota = tipo && valores.situacao === 'ok' ? valorDe(valores.valor, tipo) : undefined;
  const atalhos = cota ? atalhosDoValorPago(cota, mesEmCampoGrande(new Date())) : [];
  const depois = depoisDoPagamento('Você', saldo, centavos);

  const enviar = aoEnviar(async (dados) => {
    const feito = 'Comprovante enviado. Vale como pagamento quando o gestor confirmar.';
    const enviado = await fazer(
      () =>
        enviarComprovante(token, {
          participanteId,
          valorEmCentavos: emCentavos(String(dados.get('valor'))),
          comprovante: dados.get('comprovante') as File,
        }),
      feito,
      'Não foi possível enviar o comprovante.',
    );
    if (enviado) navigate('/', { state: { feito } });
  });

  return (
    <form onSubmit={enviar} data-testid="envio-de-comprovante">
      {avisos}
      {saldo.pendenteEmCentavos > 0 && (
        <p className="apoio">
          Você deve <strong>{emReais(saldo.pendenteEmCentavos)}</strong>.
        </p>
      )}
      <div className="colunas">
        <div className="cartao pilha">
          <CampoArquivo
            rotulo="Comprovante do PIX"
            ajuda="Foto ou PDF, até 5 MB. Dá para tirar uma foto da tela do banco."
            nome="comprovante"
          />
          <CampoValor
            rotulo="Valor pago"
            valor={campo}
            aoMudar={setValor}
            ajuda="Pagou a mais? O que passar vira crédito para os próximos meses."
          />
          {atalhos.length > 0 && (
            <fieldset className="atalhos">
              <legend className="visualmente-oculto">Valores de cota</legend>
              {atalhos.map((atalho) => (
                <button
                  key={atalho.rotulo}
                  type="button"
                  className="atalho"
                  data-testid="atalho"
                  aria-pressed={atalho.valorEmCentavos === centavos}
                  onClick={() => setValor(emReais(atalho.valorEmCentavos))}
                >
                  {atalho.rotulo} · {emReais(atalho.valorEmCentavos)}
                </button>
              ))}
            </fieldset>
          )}
        </div>
        <div className="pilha">
          <div className="cartao resumo">
            <dl>
              <div>
                <dt>{saldo.creditoEmCentavos > 0 ? 'Seu crédito' : 'Você deve'}</dt>
                <dd>{emReais(saldo.creditoEmCentavos || saldo.pendenteEmCentavos)}</dd>
              </div>
              <div>
                <dt>Vai enviar</dt>
                <dd>{emReais(centavos)}</dd>
              </div>
            </dl>
            <p className="previa-da-situacao" data-situacao={depois.situacao} aria-live="polite">
              Depois da confirmação: {depois.texto}
            </p>
            <button
              type="submit"
              className="largo"
              data-testid="enviar-comprovante"
              disabled={enviando}
            >
              <Icone nome="enviar" />
              Enviar {emReais(centavos)} ao gestor
            </button>
          </div>
          <p className="aviso-espuma">
            <Icone nome="relogio" />
            <span>
              O gestor recebe um aviso e confere. Até ele confirmar, o comprovante fica{' '}
              <strong>a confirmar</strong> e a cota continua pendente. Você pode editar ou cancelar
              enquanto isso.
            </span>
          </p>
        </div>
      </div>
    </form>
  );
};

/**
 * *Caixinha*: the saldo da caixinha and the caixinha do mês, month by month; why the cota costs
 * what it costs (the gastos do ano anterior and the valor of each tipo de cota); and registrar a
 * gasto paid by the person.
 */
export const Caixinha = ({ token }: { token: string }) => {
  const [caixinha, recarregar] = useLeitura<CaixinhaLida>(token, '/api/financeiro/caixinha');
  const [valores, recarregarValores] = useLeitura<readonly ValorDaCota[]>(
    token,
    '/api/participacao/tipo-de-cota',
  );
  const [mes, setMes] = useState(() => mesEmCampoGrande(new Date()));
  const [doMes, recarregarMes] = useLeitura<CaixinhaDoMesLida>(
    token,
    `/api/financeiro/caixinha/${mes}`,
  );
  const { avisos } = useComando(() => {});
  if (!caixinha || !valores) return <Carregando />;
  if (caixinha.situacao !== 'ok' || valores.situacao !== 'ok')
    return (
      <FalhaAoCarregar
        tentarDeNovo={() => {
          recarregar();
          recarregarValores();
        }}
      />
    );
  const ano = anoAtual();
  const saiu = doMes?.situacao === 'ok' ? doMes.valor.gastosPorTipoEmCentavos : undefined;
  const totalQueSaiu = saiu ? Object.values(saiu).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      {avisos}
      <div className="barra-de-acoes">
        <MesNavegavel mes={mes} mudar={setMes} />
        <Link
          className="botao contorno"
          to="/caixinha/registrar-gasto"
          data-testid="ir-registrar-gasto"
        >
          <Icone nome="recibo" />
          Registrar um gasto que paguei
        </Link>
      </div>
      {!doMes ? (
        <Carregando />
      ) : doMes.situacao !== 'ok' || !saiu ? (
        <FalhaAoCarregar tentarDeNovo={recarregarMes} />
      ) : (
        <div className="colunas" data-testid="caixinha-do-mes">
          <section className="cartao escuro" aria-labelledby="saldo-agora">
            <h2 id="saldo-agora" className="rotulo">
              Saldo agora
            </h2>
            <p className="valor-grande">{emReais(caixinha.valor.saldoEmCentavos)}</p>
            <dl className="contas">
              <div>
                <dt>No início de {nomeDoMes(mes)}</dt>
                <dd data-testid="saldo-no-inicio">
                  {emReais(doMes.valor.saldoNoInicioEmCentavos)}
                </dd>
              </div>
              <div>
                <dt>Entrou</dt>
                <dd data-testid="recebido">{emReais(doMes.valor.recebidoEmCentavos)}</dd>
              </div>
              <div>
                <dt>Saiu</dt>
                <dd>{emReais(totalQueSaiu)}</dd>
              </div>
              <div className="total">
                <dt>Sobrou</dt>
                <dd data-testid="saldo-no-fim">{emReais(doMes.valor.saldoNoFimEmCentavos)}</dd>
              </div>
            </dl>
          </section>
          <section className="cartao" aria-labelledby="o-que-saiu">
            <h2 id="o-que-saiu" className="titulo-com-valor">
              O que saiu em {nomeDoMes(mes)}
              <span>{emReais(totalQueSaiu)}</span>
            </h2>
            <PorTipoDeGasto valores={saiu} testId={(tipo) => `saiu-${tipo}`} />
            <p className="nota">
              Um gasto pago do próprio bolso sai da caixinha no mês do reembolso.
            </p>
          </section>
        </div>
      )}
      <section className="cartao" aria-labelledby="por-que">
        <h2 id="por-que">Por que a cota custa isso</h2>
        <p className="apoio">
          No início do ano, o gestor define o valor de cada tipo de cota com base nos gastos do ano
          anterior: os de {ano} vieram dos gastos de {ano - 1}.
        </p>
        <div className="colunas">
          <GastosDoAnoAnterior caixinha={caixinha.valor} />
          <div>
            <h3>Cota de {ano}, por mês</h3>
            <ValoresDaCota valores={valores.valor} />
          </div>
        </div>
      </section>
    </>
  );
};
