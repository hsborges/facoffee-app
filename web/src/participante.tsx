import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  type CaixinhaDoMes as CaixinhaDoMesLida,
  type Caixinha as CaixinhaLida,
  type Comando,
  type ComprovanteEnviado,
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
  mesEmCampoGrande,
  mesPorExtenso,
  NOME_DO_TIPO_DE_COTA,
  NOME_DO_TIPO_DE_GASTO,
} from './formato';

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

/** Runs a comando, announces how it went and then reloads the page's leituras. */
export const useComando = (recarregar: () => void) => {
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ readonly feito?: string; readonly falha?: string }>({});
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
        <p role="alert" data-testid="aviso-falha">
          {aviso.falha}
        </p>
      )}
      <p role="status" data-testid="aviso-feito">
        {aviso.feito}
      </p>
    </>
  );
  return { enviando, fazer, avisos };
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

/** A valor in reais, sent as `valor`; `inicial` (in centavos) fills it in. */
export const CampoValor = ({ rotulo, inicial }: { rotulo: string; inicial?: number }) => (
  <label className="campo">
    {rotulo}
    <input
      name="valor"
      data-testid="valor"
      type="number"
      min="0.01"
      max="21474836.47"
      step="0.01"
      inputMode="decimal"
      defaultValue={inicial === undefined ? undefined : (inicial / 100).toFixed(2)}
      required
    />
  </label>
);

/** Types accepted for a comprovante or a nota. */
export const ARQUIVOS = 'application/pdf,image/jpeg,image/png';

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

/** The situação of a comprovante enviado, in one line. */
export const situacaoDoComprovante = (comprovante: ComprovanteEnviado) =>
  comprovante.situacao === 'confirmado'
    ? `Confirmado: ${emReais(comprovante.valorConfirmadoEmCentavos)}`
    : comprovante.situacao === 'recusado'
      ? `Recusado: ${comprovante.motivo}`
      : 'A confirmar';

// The participante's comprovantes: enviar, and while a confirmar, editar or cancelar.
const Comprovantes = ({ token, participanteId }: { token: string; participanteId: string }) => {
  const [comprovantes, recarregar] = useLeitura<readonly ComprovanteEnviado[]>(
    token,
    '/api/financeiro/comprovante-enviado/eu',
  );
  const { enviando, fazer, avisos } = useComando(recarregar);
  if (!comprovantes) return <Carregando />;
  if (comprovantes.situacao !== 'ok') return <FalhaAoCarregar tentarDeNovo={recarregar} />;

  const enviar = aoEnviar(async (dados, form) => {
    const feito = await fazer(
      () =>
        enviarComprovante(token, {
          participanteId,
          valorEmCentavos: emCentavos(String(dados.get('valor'))),
          comprovante: dados.get('comprovante') as File,
        }),
      'Comprovante enviado. Vale como pagamento quando o gestor confirmar.',
      'Não foi possível enviar o comprovante.',
    );
    if (feito) form.reset();
  });
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
  const cancelar = (comprovante: ComprovanteEnviado) =>
    confirm(`Cancelar o envio do comprovante de ${emReais(comprovante.valorEmCentavos)}?`) &&
    fazer(
      () => comandar(token, `/api/financeiro/comprovante-enviado/${comprovante.id}/cancelar`),
      'Envio cancelado.',
      'Não foi possível cancelar o envio.',
    );

  return (
    <section aria-labelledby="comprovantes" data-testid="comprovantes">
      <h2 id="comprovantes">Comprovantes</h2>
      <p>
        Pagou por PIX? Envie o comprovante ao gestor. Ele vale como pagamento quando o gestor
        confirmar.
      </p>
      {avisos}
      <form onSubmit={enviar} data-testid="envio-de-comprovante">
        <CampoValor rotulo="Valor pago (R$)" />
        <label className="campo">
          Comprovante do PIX (PDF, JPEG ou PNG, até 5 MB)
          <input type="file" name="comprovante" data-testid="arquivo" accept={ARQUIVOS} required />
        </label>
        <button type="submit" data-testid="enviar-comprovante" disabled={enviando}>
          Enviar comprovante
        </button>
      </form>
      {comprovantes.valor.length > 0 && (
        <table className="empilhada" data-testid="comprovantes-enviados">
          <caption>Comprovantes enviados</caption>
          <thead>
            <tr>
              <th scope="col">Enviado em</th>
              <th scope="col">Valor pago</th>
              <th scope="col">Situação</th>
              <th scope="col">Editar ou cancelar</th>
            </tr>
          </thead>
          <tbody>
            {comprovantes.valor.map((comprovante) => {
              const qual = `comprovante de ${emReais(comprovante.valorEmCentavos)} enviado em ${dataEmCampoGrande(comprovante.enviadoEm)}`;
              return (
                <tr
                  key={comprovante.id}
                  data-testid="comprovante-enviado"
                  data-situacao={comprovante.situacao}
                >
                  <td data-rotulo="Enviado em">{dataEmCampoGrande(comprovante.enviadoEm)}</td>
                  <td data-rotulo="Valor pago">{emReais(comprovante.valorEmCentavos)}</td>
                  <td data-rotulo="Situação" data-testid="situacao">
                    {situacaoDoComprovante(comprovante)}
                  </td>
                  <td data-rotulo="Editar ou cancelar">
                    {comprovante.situacao !== 'a-confirmar' ? (
                      '—'
                    ) : (
                      <>
                        <details>
                          <summary aria-label={`Editar ${qual}`} data-testid="editar-comprovante">
                            Editar
                          </summary>
                          <form onSubmit={editar(comprovante)} data-testid="edicao-de-comprovante">
                            <CampoValor
                              rotulo="Valor pago (R$)"
                              inicial={comprovante.valorEmCentavos}
                            />
                            <label className="campo">
                              Outro comprovante (opcional)
                              <input
                                type="file"
                                name="comprovante"
                                data-testid="arquivo"
                                accept={ARQUIVOS}
                              />
                            </label>
                            <button type="submit" data-testid="salvar" disabled={enviando}>
                              Salvar
                            </button>
                          </form>
                        </details>
                        <button
                          type="button"
                          className="fantasma"
                          data-testid="cancelar-envio"
                          disabled={enviando}
                          aria-label={`Cancelar o envio do ${qual}`}
                          onClick={() => cancelar(comprovante)}
                        >
                          Cancelar envio
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
};

const EscolhaDoTipoDeCota = ({
  legenda,
  botao,
  testId,
  inicial,
  desabilitado,
  escolher,
}: {
  legenda: string;
  botao: string;
  testId: string;
  inicial: TipoDeCota;
  desabilitado: boolean;
  escolher: (tipoDeCota: TipoDeCota) => void;
}) => {
  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    escolher(new FormData(evento.currentTarget).get('tipoDeCota') as TipoDeCota);
  };
  return (
    <form onSubmit={enviar}>
      <fieldset>
        <legend>{legenda}</legend>
        {(['so-cafe', 'completa'] as const).map((tipo) => (
          <label key={tipo} className="opcao">
            <input
              type="radio"
              name="tipoDeCota"
              value={tipo}
              data-testid={`tipo-de-cota-${tipo}`}
              defaultChecked={tipo === inicial}
            />
            <strong>{NOME_DO_TIPO_DE_COTA[tipo]}</strong>
            <span>{ITENS_DO_TIPO_DE_COTA[tipo]}</span>
          </label>
        ))}
      </fieldset>
      <button type="submit" data-testid={testId} disabled={desabilitado}>
        {botao}
      </button>
    </form>
  );
};

const CreditoOuPendencia = ({ situacao }: { situacao: Situacao }) => (
  <section aria-labelledby="credito-ou-pendencia" data-testid="credito-ou-pendencia">
    <h2 id="credito-ou-pendencia">Crédito ou pendência</h2>
    {situacao.pendenteEmCentavos > 0 ? (
      <p data-testid="pendente">
        Pendente: <strong>{emReais(situacao.pendenteEmCentavos)}</strong>. Acerte com o gestor ou
        envie o comprovante do PIX, sem multa nem juros.
      </p>
    ) : situacao.creditoEmCentavos > 0 ? (
      <p data-testid="credito">
        Crédito: <strong>{emReais(situacao.creditoEmCentavos)}</strong>, abatido das próximas cotas
        e complementos.
      </p>
    ) : (
      <p data-testid="em-dia">Em dia: nenhum crédito nem pendência.</p>
    )}
    {situacao.cotas.length > 0 && (
      <table data-testid="cotas">
        <caption>Cotas</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Tipo de cota</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          {situacao.cotas.map((cota) => (
            <tr key={cota.mes} data-testid="cota" data-tipo-de-cota={cota.tipoDeCota}>
              <td>{mesPorExtenso(cota.mes)}</td>
              <td>{NOME_DO_TIPO_DE_COTA[cota.tipoDeCota]}</td>
              <td>{emReais(cota.valorEmCentavos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
    {situacao.complementos.length > 0 && (
      <table data-testid="complementos">
        <caption>Complementos</caption>
        <thead>
          <tr>
            <th scope="col">Solicitado em</th>
            <th scope="col">Sua parte</th>
          </tr>
        </thead>
        <tbody>
          {situacao.complementos.map((complemento) => (
            <tr key={complemento.id} data-testid="complemento">
              <td>{dataEmCampoGrande(complemento.solicitadoEm)}</td>
              <td>{emReais(complemento.parteEmCentavos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </section>
);

/**
 * *Minha situação*: the participação (pedir entrada, trocar tipo de cota, pedir saída), the
 * crédito or pendência with the cotas and complementos, the comprovantes enviados to the gestor,
 * and desativar the person's own access.
 */
export const MinhaSituacao = ({
  token,
  usuarioId,
  sair,
}: {
  token: string;
  usuarioId: string;
  sair: () => void;
}) => {
  const [participacao, recarregarParticipacao] = useLeitura<Participacao>(
    token,
    '/api/participacao/participante/eu',
  );
  const [situacao, recarregarSituacao] = useLeitura<Situacao>(
    token,
    '/api/financeiro/participante/eu',
  );
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string>();
  const [feito, setFeito] = useState<string>();

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

  if (!participacao || !situacao) return <Carregando />;
  if (participacao.situacao === 'erro' || situacao.situacao === 'erro')
    return <FalhaAoCarregar tentarDeNovo={recarregar} />;

  const atual = participacao.situacao === 'ok' ? participacao.valor : undefined;
  const pedirSaida = () =>
    confirm('Pedir saída? Seu crédito ou pendência continua valendo se você voltar.') &&
    fazer('/api/participacao/sair', ['Saída pedida.', 'Não foi possível pedir a saída.']);
  // Once desativado, every leitura answers 403: the person leaves instead of reloading.
  const desativarAcesso = async () => {
    if (!confirm('Desativar seu acesso ao FACOFFEE? Só o gestor pode reativá-lo.')) return;
    setEnviando(true);
    setFalha(undefined);
    if ((await comandar(token, `/api/usuario/${usuarioId}/desativar`)).feito) return sair();
    setEnviando(false);
    setFalha('Não foi possível desativar seu acesso.');
  };

  return (
    <>
      {falha && (
        <p role="alert" data-testid="aviso-falha">
          {falha}
        </p>
      )}
      <p role="status" data-testid="aviso-feito">
        {feito}
      </p>
      <section aria-labelledby="participacao" data-testid="participacao">
        <h2 id="participacao">Participação</h2>
        {atual?.participando ? (
          <>
            <p data-testid="participando" data-tipo-de-cota={atual.tipoDeCota}>
              Você participa com a cota <strong>{NOME_DO_TIPO_DE_COTA[atual.tipoDeCota]}</strong>.
              {atual.troca && (
                <span
                  data-testid="troca-de-tipo-de-cota"
                  data-tipo-de-cota={atual.troca.tipoDeCota}
                  data-a-partir-de={atual.troca.aPartirDe}
                >
                  {` A partir de ${mesPorExtenso(atual.troca.aPartirDe)}, ela passa a ser ${NOME_DO_TIPO_DE_COTA[atual.troca.tipoDeCota]}.`}
                </span>
              )}
            </p>
            <EscolhaDoTipoDeCota
              key={atual.troca?.tipoDeCota ?? atual.tipoDeCota}
              legenda="Trocar tipo de cota (vale a partir do mês seguinte)"
              botao="Trocar tipo de cota"
              testId="trocar-tipo-de-cota"
              inicial={atual.troca?.tipoDeCota ?? atual.tipoDeCota}
              desabilitado={enviando}
              escolher={(tipoDeCota) =>
                fazer(
                  '/api/participacao/trocar-tipo-de-cota',
                  ['Tipo de cota trocado.', 'Não foi possível trocar o tipo de cota.'],
                  { tipoDeCota },
                )
              }
            />
            <button
              type="button"
              className="fantasma"
              data-testid="pedir-saida"
              disabled={enviando}
              onClick={pedirSaida}
            >
              Pedir saída
            </button>
          </>
        ) : (
          <>
            <p data-testid="nao-participa">Você não participa da divisão dos custos da copa.</p>
            <EscolhaDoTipoDeCota
              legenda="Escolha o tipo de cota"
              botao="Pedir entrada"
              testId="pedir-entrada"
              inicial={atual?.tipoDeCota ?? 'completa'}
              desabilitado={enviando}
              escolher={(tipoDeCota) =>
                fazer(
                  '/api/participacao/entrar',
                  ['Entrada pedida.', 'Não foi possível pedir a entrada.'],
                  { tipoDeCota },
                )
              }
            />
          </>
        )}
      </section>
      {situacao.situacao === 'ok' && (
        <>
          <CreditoOuPendencia situacao={situacao.valor} />
          <Comprovantes token={token} participanteId={usuarioId} />
        </>
      )}
      <section aria-labelledby="acesso">
        <h2 id="acesso">Acesso</h2>
        <p>Ao desativar seu acesso, sua participação termina. Só o gestor pode reativá-lo.</p>
        <button
          type="button"
          className="fantasma"
          data-testid="desativar-meu-acesso"
          disabled={enviando}
          onClick={desativarAcesso}
        >
          Desativar meu acesso
        </button>
      </section>
    </>
  );
};

const CaixinhaDoMes = ({ token }: { token: string }) => {
  const [mes, setMes] = useState(() => mesEmCampoGrande(new Date()));
  const [lida, recarregar] = useLeitura<CaixinhaDoMesLida>(
    token,
    `/api/financeiro/caixinha/${mes}`,
  );
  return (
    <section aria-labelledby="caixinha-do-mes">
      <h2 id="caixinha-do-mes">Caixinha do mês</h2>
      <label className="campo">
        Mês
        <input
          type="month"
          value={mes}
          required
          onChange={(evento) =>
            /^\d{4}-\d{2}$/.test(evento.target.value) && setMes(evento.target.value)
          }
        />
      </label>
      {!lida ? (
        <Carregando />
      ) : lida.situacao !== 'ok' ? (
        <FalhaAoCarregar tentarDeNovo={recarregar} />
      ) : (
        <table data-testid="caixinha-do-mes">
          <caption>Caixinha de {mesPorExtenso(lida.valor.mes)}</caption>
          <tbody>
            <tr>
              <th scope="row">Saldo no início do mês</th>
              <td data-testid="saldo-no-inicio">{emReais(lida.valor.saldoNoInicioEmCentavos)}</td>
            </tr>
            <tr>
              <th scope="row">Entrou (pagamentos recebidos)</th>
              <td data-testid="recebido">{emReais(lida.valor.recebidoEmCentavos)}</td>
            </tr>
            {Object.entries(NOME_DO_TIPO_DE_GASTO).map(([tipo, nome]) => (
              <tr key={tipo}>
                <th scope="row">Saiu: {nome}</th>
                <td data-testid={`saiu-${tipo}`}>
                  {emReais(lida.valor.gastosPorTipoEmCentavos[tipo as TipoDeGasto])}
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row">Saldo no fim do mês</th>
              <td data-testid="saldo-no-fim">{emReais(lida.valor.saldoNoFimEmCentavos)}</td>
            </tr>
          </tbody>
        </table>
      )}
      <p>Um gasto pago do próprio bolso sai da caixinha no mês do reembolso.</p>
    </section>
  );
};

/** The gastos do ano anterior per tipo de gasto, and their total. */
export const GastosDoAnoAnterior = ({ caixinha }: { caixinha: CaixinhaLida }) => (
  <table data-testid="gastos-do-ano-anterior">
    <caption>Gastos do ano anterior</caption>
    <tbody>
      {Object.entries(NOME_DO_TIPO_DE_GASTO).map(([tipo, nome]) => (
        <tr key={tipo}>
          <th scope="row">{nome}</th>
          <td data-testid={`gasto-do-ano-anterior-${tipo}`}>
            {emReais(caixinha.gastosDoAnoAnteriorPorTipoEmCentavos[tipo as TipoDeGasto])}
          </td>
        </tr>
      ))}
      <tr>
        <th scope="row">Total</th>
        <td data-testid="total-do-ano-anterior">
          {emReais(caixinha.gastosDoAnoAnteriorEmCentavos)}
        </td>
      </tr>
    </tbody>
  </table>
);

const ValoresDaCota = ({ token }: { token: string }) => {
  const [valores, recarregar] = useLeitura<readonly ValorDaCota[]>(
    token,
    '/api/participacao/tipo-de-cota',
  );
  if (!valores) return <Carregando />;
  if (valores.situacao !== 'ok') return <FalhaAoCarregar tentarDeNovo={recarregar} />;
  if (valores.valor.length === 0)
    return (
      <p data-testid="valor-da-cota-indefinido">
        O valor da cota deste ano ainda não foi definido.
      </p>
    );
  return (
    <table data-testid="valores-da-cota" data-ano={valores.valor[0]?.ano}>
      <caption>Valor da cota em {valores.valor[0]?.ano}</caption>
      <thead>
        <tr>
          <th scope="col">Tipo de cota</th>
          <th scope="col">Inclui</th>
          <th scope="col">Por mês</th>
        </tr>
      </thead>
      <tbody>
        {valores.valor.map((valor) => (
          <tr key={valor.tipoDeCota}>
            <th scope="row">{NOME_DO_TIPO_DE_COTA[valor.tipoDeCota]}</th>
            <td>{ITENS_DO_TIPO_DE_COTA[valor.tipoDeCota]}</td>
            <td data-testid={`valor-da-cota-${valor.tipoDeCota}`}>
              {emReais(valor.valorEmCentavos)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/**
 * *Caixinha*: the saldo da caixinha, the valor of each tipo de cota with the gastos do ano anterior
 * it comes from, and the caixinha do mês.
 */
export const Caixinha = ({ token }: { token: string }) => {
  const [caixinha, recarregar] = useLeitura<CaixinhaLida>(token, '/api/financeiro/caixinha');
  if (!caixinha) return <Carregando />;
  if (caixinha.situacao !== 'ok') return <FalhaAoCarregar tentarDeNovo={recarregar} />;
  return (
    <>
      <dl>
        <dt>Saldo da caixinha</dt>
        <dd>{emReais(caixinha.valor.saldoEmCentavos)}</dd>
      </dl>
      <section aria-labelledby="valor-da-cota">
        <h2 id="valor-da-cota">De onde vem o valor da cota</h2>
        <p>
          No início do ano, o gestor define o valor de cada tipo de cota com base nos gastos do ano
          anterior.
        </p>
        <ValoresDaCota token={token} />
        <GastosDoAnoAnterior caixinha={caixinha.valor} />
      </section>
      <CaixinhaDoMes token={token} />
    </>
  );
};
