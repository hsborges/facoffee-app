import { useState } from 'react';
import {
  abrirArquivo,
  type Caixinha as CaixinhaLida,
  type Comando,
  type ComprovanteEnviado,
  type CreditoEPendente,
  comandar,
  type Gasto,
  guardarAntes,
  type TipoDeCota,
  type UsuarioRegistrado,
} from './api';
import {
  dataEmCampoGrande,
  emCentavos,
  emReais,
  NOME_DO_TIPO_DE_COTA,
  NOME_DO_TIPO_DE_GASTO,
} from './formato';
import {
  ARQUIVOS,
  aoEnviar,
  CampoValor,
  Carregando,
  FalhaAoCarregar,
  GastosDoAnoAnterior,
  useComando,
  useLeitura,
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

const nomeDe = (usuario: UsuarioRegistrado) => usuario.nome || usuario.email;

/**
 * *Participantes* (gestor): the comprovantes a confirmar, to confirmar (receiving the pagamento,
 * with the valor corrected if needed) or recusar with the motivo; each usuário with their
 * participação and crédito or pendência; receber pagamento (PIX with comprovante, or dinheiro)
 * and desativar or reativar access. The gestor's own access is left out: once desativado, nobody
 * could reativá-lo.
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
  const [pix, setPix] = useState(true);
  const [falhaAoAbrir, setFalhaAoAbrir] = useState(false);

  if (!usuarios || !situacoes || !comprovantes) return <Carregando />;
  if (usuarios.situacao !== 'ok' || situacoes.situacao !== 'ok' || comprovantes.situacao !== 'ok')
    return (
      <>
        {avisos}
        <FalhaAoCarregar tentarDeNovo={recarregar} />
      </>
    );

  const situacaoDe = new Map(situacoes.valor.map((situacao) => [situacao.id, situacao]));
  const participantes = usuarios.valor.filter((usuario) => situacaoDe.has(usuario.id));
  const nomes = new Map(usuarios.valor.map((usuario) => [usuario.id, nomeDe(usuario)]));

  const abrir = async (comprovante: ComprovanteEnviado) =>
    setFalhaAoAbrir(
      !(await abrirArquivo(token, `/api/financeiro/comprovante/${comprovante.comprovanteId}`)),
    );
  const confirmar = (comprovante: ComprovanteEnviado) =>
    aoEnviar((dados) =>
      fazer(
        () => confirmarComprovante(token, comprovante, emCentavos(String(dados.get('valor')))),
        'Comprovante confirmado: pagamento recebido.',
        'Não foi possível confirmar o comprovante.',
      ),
    );
  const recusar = (comprovante: ComprovanteEnviado) =>
    aoEnviar((dados) =>
      fazer(
        () =>
          comandar(token, `/api/financeiro/comprovante-enviado/${comprovante.id}/recusar`, {
            motivo: String(dados.get('motivo')),
          }),
        'Comprovante recusado.',
        'Não foi possível recusar o comprovante.',
      ),
    );

  const receber = aoEnviar(async (dados, form) => {
    const feito = await fazer(
      () =>
        receberPagamento(token, {
          participanteId: String(dados.get('participanteId')),
          valorEmCentavos: emCentavos(String(dados.get('valor'))),
          forma: pix ? 'pix' : 'dinheiro',
          comprovante: dados.get('comprovante') as File | null,
        }),
      'Pagamento recebido.',
      'Não foi possível receber o pagamento.',
    );
    if (!feito) return;
    form.reset();
    // The radios are uncontrolled: reset checks PIX again, and `pix` follows.
    setPix(true);
  });

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
      {avisos}
      <section aria-labelledby="comprovantes-a-confirmar" data-testid="comprovantes-a-confirmar">
        <h2 id="comprovantes-a-confirmar">Comprovantes a confirmar</h2>
        {falhaAoAbrir && <p role="alert">Não foi possível abrir o comprovante.</p>}
        {comprovantes.valor.length === 0 ? (
          <p>Nenhum comprovante a confirmar.</p>
        ) : (
          <table className="empilhada">
            <thead>
              <tr>
                <th scope="col">Participante</th>
                <th scope="col">Enviado em</th>
                <th scope="col">Valor informado</th>
                <th scope="col">Arquivo</th>
                <th scope="col">Análise</th>
              </tr>
            </thead>
            <tbody>
              {comprovantes.valor.map((comprovante) => {
                const quem = nomes.get(comprovante.participanteId) ?? 'Desconhecido';
                const qual = `comprovante de ${quem}, ${emReais(comprovante.valorEmCentavos)}`;
                return (
                  <tr key={comprovante.id} data-testid="comprovante-a-confirmar">
                    <th scope="row">{quem}</th>
                    <td data-rotulo="Enviado em">{dataEmCampoGrande(comprovante.enviadoEm)}</td>
                    <td data-rotulo="Valor informado">{emReais(comprovante.valorEmCentavos)}</td>
                    <td data-rotulo="Arquivo">
                      <button
                        type="button"
                        className="fantasma"
                        data-testid="ver-comprovante"
                        aria-label={`Ver o ${qual}`}
                        onClick={() => abrir(comprovante)}
                      >
                        Ver
                      </button>
                    </td>
                    <td data-rotulo="Análise">
                      <details>
                        <summary
                          aria-label={`Confirmar ou recusar o ${qual}`}
                          data-testid="analisar-comprovante"
                        >
                          Confirmar ou recusar
                        </summary>
                        <form onSubmit={confirmar(comprovante)}>
                          <CampoValor
                            rotulo="Valor confirmado (R$)"
                            inicial={comprovante.valorEmCentavos}
                          />
                          <button type="submit" data-testid="confirmar" disabled={enviando}>
                            Confirmar
                          </button>
                        </form>
                        <form onSubmit={recusar(comprovante)}>
                          <label className="campo">
                            Motivo da recusa
                            <input name="motivo" data-testid="motivo" maxLength={500} required />
                          </label>
                          <button
                            type="submit"
                            className="secundario"
                            data-testid="recusar"
                            disabled={enviando}
                          >
                            Recusar
                          </button>
                        </form>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <section aria-labelledby="credito-e-pendentes">
        <h2 id="credito-e-pendentes">Crédito e pendentes</h2>
        <table className="empilhada">
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">Participação</th>
              <th scope="col">Crédito ou pendência</th>
              <th scope="col">Acesso</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.valor.map((usuario) => {
              const situacao = situacaoDe.get(usuario.id);
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
                  <th scope="row">{nomeDe(usuario)}</th>
                  <td data-rotulo="Participação">
                    {!situacao ? 'Nunca participou' : situacao.ativo ? 'Participa' : 'Saiu'}
                  </td>
                  <td data-rotulo="Crédito ou pendência">
                    {situacao ? creditoOuPendencia(situacao) : '—'}
                  </td>
                  <td data-rotulo="Acesso">
                    {usuario.desativado ? 'Desativado ' : 'Ativo '}
                    {usuario.id !== usuarioId && (
                      <button
                        type="button"
                        className="fantasma"
                        data-testid={usuario.desativado ? 'reativar-acesso' : 'desativar-acesso'}
                        disabled={enviando}
                        aria-label={`${acao} de ${nomeDe(usuario)}`}
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
      </section>
      <section aria-labelledby="receber-pagamento">
        <h2 id="receber-pagamento">Receber pagamento</h2>
        {participantes.length === 0 ? (
          <p>Ninguém pediu entrada ainda.</p>
        ) : (
          <form onSubmit={receber} data-testid="recebimento">
            <label className="campo">
              Participante
              <select
                name="participanteId"
                data-testid="escolha-do-participante"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Escolha o participante
                </option>
                {participantes.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {nomeDe(usuario)}
                  </option>
                ))}
              </select>
            </label>
            <CampoValor rotulo="Valor (R$)" />
            <fieldset>
              <legend>Forma</legend>
              <label className="opcao">
                <input
                  type="radio"
                  name="forma"
                  value="pix"
                  data-testid="forma-pix"
                  defaultChecked
                  onChange={() => setPix(true)}
                />
                <strong>PIX</strong>
              </label>
              <label className="opcao">
                <input
                  type="radio"
                  name="forma"
                  value="dinheiro"
                  data-testid="forma-dinheiro"
                  onChange={() => setPix(false)}
                />
                <strong>Dinheiro</strong>
                <span>Em mãos.</span>
              </label>
            </fieldset>
            {pix && (
              <label className="campo">
                Comprovante do PIX (PDF, JPEG ou PNG, até 5 MB)
                <input
                  type="file"
                  name="comprovante"
                  data-testid="arquivo"
                  accept={ARQUIVOS}
                  required
                />
              </label>
            )}
            <button type="submit" data-testid="receber-pagamento" disabled={enviando}>
              Receber pagamento
            </button>
          </form>
        )}
      </section>
    </>
  );
};

const NOME_DA_ORIGEM: Readonly<Record<Gasto['origem'], string>> = {
  caixinha: 'Caixinha',
  'proprio-bolso': 'Próprio bolso',
};

/** *Gastos* (gestor): registrar gasto with its nota, and reembolsar gastos pagos do próprio bolso. */
export const Gastos = ({ token }: { token: string }) => {
  const [gastos, recarregarGastos] = useLeitura<readonly Gasto[]>(token, '/api/financeiro/gasto');
  const [usuarios, recarregarUsuarios] = useLeitura<readonly UsuarioRegistrado[]>(
    token,
    '/api/usuario',
  );
  const recarregar = () => {
    recarregarGastos();
    recarregarUsuarios();
  };
  const { enviando, fazer, avisos } = useComando(recarregar);

  if (!gastos || !usuarios) return <Carregando />;
  if (gastos.situacao !== 'ok' || usuarios.situacao !== 'ok')
    return (
      <>
        {avisos}
        <FalhaAoCarregar tentarDeNovo={recarregar} />
      </>
    );

  const nomes = new Map(usuarios.valor.map((usuario) => [usuario.id, nomeDe(usuario)]));

  const registrar = aoEnviar(async (dados, form) => {
    const feito = await fazer(
      () =>
        registrarGasto(token, {
          valorEmCentavos: emCentavos(String(dados.get('valor'))),
          origem: dados.get('origem') as Gasto['origem'],
          tipo: dados.get('tipo') as Gasto['tipo'],
          nota: dados.get('nota') as File,
        }),
      'Gasto registrado.',
      'Não foi possível registrar o gasto.',
    );
    if (feito) form.reset();
  });

  const reembolsar = (gasto: Gasto, quem: string) =>
    confirm(`Reembolsar ${emReais(gasto.valorEmCentavos)} a ${quem}? Sai da caixinha.`) &&
    fazer(
      () => comandar(token, `/api/financeiro/gasto/${gasto.id}/reembolsar`),
      'Reembolso feito.',
      'Não foi possível reembolsar.',
    );

  return (
    <>
      {avisos}
      <section aria-labelledby="registrar-gasto">
        <h2 id="registrar-gasto">Registrar gasto</h2>
        <form onSubmit={registrar} data-testid="registro-de-gasto">
          <label className="campo">
            Tipo
            <select name="tipo" data-testid="tipo-de-gasto" required defaultValue="">
              <option value="" disabled>
                Escolha o tipo do gasto
              </option>
              {Object.entries(NOME_DO_TIPO_DE_GASTO).map(([tipo, nome]) => (
                <option key={tipo} value={tipo}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <CampoValor rotulo="Valor total (R$)" />
          <fieldset>
            <legend>Pago com</legend>
            {(['caixinha', 'proprio-bolso'] as const).map((origem) => (
              <label key={origem} className="opcao">
                <input
                  type="radio"
                  name="origem"
                  value={origem}
                  data-testid={`origem-${origem}`}
                  defaultChecked={origem === 'caixinha'}
                />
                <strong>{NOME_DA_ORIGEM[origem]}</strong>
                {origem === 'proprio-bolso' && <span>Sai da caixinha só no reembolso.</span>}
              </label>
            ))}
          </fieldset>
          <label className="campo">
            Nota (PDF, JPEG ou PNG, até 5 MB)
            <input type="file" name="nota" data-testid="arquivo" accept={ARQUIVOS} required />
          </label>
          <button type="submit" data-testid="registrar-gasto" disabled={enviando}>
            Registrar gasto
          </button>
        </form>
      </section>
      <section aria-labelledby="gastos">
        <h2 id="gastos">Gastos</h2>
        {gastos.valor.length === 0 ? (
          <p>Nenhum gasto registrado.</p>
        ) : (
          <table className="empilhada">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Quem pagou</th>
                <th scope="col">Tipo</th>
                <th scope="col">Valor</th>
                <th scope="col">Pago com</th>
                <th scope="col">Reembolso</th>
              </tr>
            </thead>
            <tbody>
              {gastos.valor.map((gasto) => {
                const quem = nomes.get(gasto.participanteId) ?? 'Desconhecido';
                return (
                  <tr
                    key={gasto.id}
                    data-testid="gasto"
                    data-tipo={gasto.tipo}
                    data-origem={gasto.origem}
                    data-reembolsado={gasto.reembolsado}
                  >
                    <td data-rotulo="Data">{dataEmCampoGrande(gasto.feitoEm)}</td>
                    <td data-rotulo="Quem pagou">{quem}</td>
                    <td data-rotulo="Tipo">{NOME_DO_TIPO_DE_GASTO[gasto.tipo]}</td>
                    <td data-rotulo="Valor">{emReais(gasto.valorEmCentavos)}</td>
                    <td data-rotulo="Pago com">{NOME_DA_ORIGEM[gasto.origem]}</td>
                    <td data-rotulo="Reembolso">
                      {gasto.origem === 'caixinha' ? (
                        '—'
                      ) : gasto.reembolsado ? (
                        'Reembolsado'
                      ) : (
                        <button
                          type="button"
                          className="fantasma"
                          data-testid="reembolsar"
                          disabled={enviando}
                          aria-label={`Reembolsar ${emReais(gasto.valorEmCentavos)} a ${quem}`}
                          onClick={() => reembolsar(gasto, quem)}
                        >
                          Reembolsar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
};

/**
 * *Solicitar complemento* (gestor), under the *Gastos*: the valor is divided among the
 * participantes ativos.
 */
export const SolicitarComplemento = ({ token }: { token: string }) => {
  // A complemento does not change the saldo: nothing to reload.
  const { enviando, fazer, avisos } = useComando(() => {});
  const solicitar = aoEnviar(async (dados, form) => {
    const valorEmCentavos = emCentavos(String(dados.get('valor')));
    if (
      !confirm(
        `Solicitar complemento de ${emReais(valorEmCentavos)}, dividido entre os participantes ativos?`,
      )
    )
      return;
    const feito = await fazer(
      () => comandar(token, '/api/financeiro/solicitar-complemento', { valorEmCentavos }),
      'Complemento solicitado.',
      'Não foi possível solicitar o complemento.',
    );
    if (feito) form.reset();
  });
  return (
    <section aria-labelledby="solicitar-complemento" data-testid="solicitacao-de-complemento">
      <h2 id="solicitar-complemento">Solicitar complemento</h2>
      <p>
        Quando o saldo não cobre os gastos. O valor é dividido em partes iguais entre todos os
        participantes ativos, inclusive os pendentes.
      </p>
      {avisos}
      <form onSubmit={solicitar}>
        <CampoValor rotulo="Valor total (R$)" />
        <button type="submit" data-testid="solicitar-complemento" disabled={enviando}>
          Solicitar complemento
        </button>
      </form>
    </section>
  );
};

/** *Valor da cota* (gestor): definir valor da cota of a year, with the gastos do ano anterior. */
export const ValorDaCota = ({ token }: { token: string }) => {
  const [caixinha, recarregar] = useLeitura<CaixinhaLida>(token, '/api/financeiro/caixinha');
  const { enviando, fazer, avisos } = useComando(() => {});
  if (!caixinha) return <Carregando />;
  if (caixinha.situacao !== 'ok') return <FalhaAoCarregar tentarDeNovo={recarregar} />;

  const anoAtual = new Date().getFullYear();
  const definir = aoEnviar(async (dados) => {
    const tipoDeCota = dados.get('tipoDeCota') as TipoDeCota;
    const ano = Number(dados.get('ano'));
    const valorEmCentavos = emCentavos(String(dados.get('valor')));
    const nome = NOME_DO_TIPO_DE_COTA[tipoDeCota];
    if (
      !confirm(
        `Definir ${emReais(valorEmCentavos)} por mês para a cota ${nome} em ${ano}? O valor não muda durante o ano.`,
      )
    )
      return;
    await fazer(
      () =>
        comandar(token, '/api/participacao/definir-valor-da-cota', {
          tipoDeCota,
          ano,
          valorEmCentavos,
        }),
      `Valor da cota ${nome} em ${ano} definido.`,
      'Não foi possível definir o valor da cota.',
    );
  });

  return (
    <>
      <GastosDoAnoAnterior caixinha={caixinha.valor} />
      <section aria-labelledby="definir-valor-da-cota">
        <h2 id="definir-valor-da-cota">Definir valor da cota</h2>
        <p>
          Uma vez por tipo de cota e ano: o valor não muda durante o ano. Sem definição até o início
          do ano, repete-se o valor do ano anterior.
        </p>
        {avisos}
        <form onSubmit={definir} data-testid="definicao-do-valor-da-cota">
          <fieldset>
            <legend>Tipo de cota</legend>
            {(['so-cafe', 'completa'] as const).map((tipo) => (
              <label key={tipo} className="opcao">
                <input
                  type="radio"
                  name="tipoDeCota"
                  value={tipo}
                  data-testid={`tipo-de-cota-${tipo}`}
                  defaultChecked={tipo === 'so-cafe'}
                />
                <strong>{NOME_DO_TIPO_DE_COTA[tipo]}</strong>
              </label>
            ))}
          </fieldset>
          <label className="campo">
            Ano
            <input
              name="ano"
              data-testid="ano"
              type="number"
              min={anoAtual}
              step="1"
              defaultValue={anoAtual}
              required
            />
          </label>
          <CampoValor rotulo="Valor mensal (R$)" />
          <button type="submit" data-testid="definir-valor-da-cota" disabled={enviando}>
            Definir valor da cota
          </button>
        </form>
      </section>
    </>
  );
};
