import { type FormEvent, useState } from 'react';
import {
  type Caixinha as CaixinhaLida,
  type Comando,
  type CreditoEPendente,
  comandar,
  type Gasto,
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
import { Carregando, FalhaAoCarregar, GastosDoAnoAnterior, useLeitura } from './participante';

const ERROS: ReadonlyMap<string, string> = new Map([
  ['arquivo-vazio', 'O arquivo está vazio.'],
  ['tipo-nao-aceito', 'Envie o arquivo em PDF, JPEG ou PNG.'],
  ['arquivo-grande-demais', 'O arquivo passa de 5 MB.'],
  ['pix-sem-comprovante', 'O pagamento por PIX exige o comprovante.'],
  ['comprovante-so-no-pix', 'Só o pagamento por PIX tem comprovante.'],
  ['comprovante-ja-usado', 'Esse comprovante já foi usado em outro pagamento.'],
  ['nota-ja-usada', 'Essa nota já foi usada em outro gasto.'],
  [
    'participante-nao-encontrado',
    'Participante não encontrado: só quem já pediu entrada tem pagamentos e gastos.',
  ],
  ['gasto-nao-encontrado', 'Gasto não encontrado.'],
  ['gasto-ja-reembolsado', 'Esse gasto já foi reembolsado.'],
  ['sem-participantes-ativos', 'Não há participante ativo para dividir o complemento.'],
  ['parte-menor-que-um-centavo', 'O valor não dá um centavo para cada participante ativo.'],
  ['ano-passado', 'Esse ano já passou.'],
  ['valor-ja-definido', 'O valor desse tipo de cota já foi definido para esse ano.'],
]);

/** Explains an error of the API to the gestor; any other gets the comando's own message. */
export const mensagemDaFalha = (erro: string | undefined, padrao: string) =>
  ERROS.get(erro ?? '') ?? padrao;

// Runs a comando, announces how it went and then reloads the page's leituras.
const useComando = (recarregar: () => void) => {
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
      {aviso.falha && <p role="alert">{aviso.falha}</p>}
      <p role="status">{aviso.feito}</p>
    </>
  );
  return { enviando, fazer, avisos };
};

// The form is read before any await: React lets go of the event right after the handler.
const aoEnviar =
  (enviar: (dados: FormData, form: HTMLFormElement) => unknown) =>
  (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    enviar(new FormData(evento.currentTarget), evento.currentTarget);
  };

const CampoValor = ({ rotulo }: { rotulo: string }) => (
  <label className="campo">
    {rotulo}
    <input
      name="valor"
      type="number"
      min="0.01"
      max="21474836.47"
      step="0.01"
      inputMode="decimal"
      required
    />
  </label>
);

const ARQUIVOS = 'application/pdf,image/jpeg,image/png';

// Guarda the arquivo first; the comando then references it by id.
// ponytail: an arquivo guardado whose comando fails stays orphaned in the armazenamento; clean up if they pile up
const guardarAntes = async (
  token: string,
  caminho: string,
  campos: Readonly<Record<string, string | File>>,
  comando: (id?: string) => Promise<Comando>,
): Promise<Comando> => {
  const form = new FormData();
  for (const [nome, valor] of Object.entries(campos)) form.append(nome, valor);
  const guardado = await comandar(token, caminho, form);
  return guardado.feito ? comando(guardado.id) : guardado;
};

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
 * *Participantes* (gestor): each usuário with their participação and crédito or pendência,
 * receber pagamento (PIX with comprovante, or dinheiro) and desativar or reativar access. The
 * gestor's own access is left out: once desativado, nobody could reativá-lo.
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
  const recarregar = () => {
    recarregarUsuarios();
    recarregarSituacoes();
  };
  const { enviando, fazer, avisos } = useComando(recarregar);
  const [pix, setPix] = useState(true);

  if (!usuarios || !situacoes) return <Carregando />;
  if (usuarios.situacao !== 'ok' || situacoes.situacao !== 'ok')
    return (
      <>
        {avisos}
        <FalhaAoCarregar tentarDeNovo={recarregar} />
      </>
    );

  const situacaoDe = new Map(situacoes.valor.map((situacao) => [situacao.id, situacao]));
  const participantes = usuarios.valor.filter((usuario) => situacaoDe.has(usuario.id));

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
                <tr key={usuario.id}>
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
          <form onSubmit={receber}>
            <label className="campo">
              Participante
              <select name="participanteId" required defaultValue="">
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
                  defaultChecked
                  onChange={() => setPix(true)}
                />
                <strong>PIX</strong>
              </label>
              <label className="opcao">
                <input type="radio" name="forma" value="dinheiro" onChange={() => setPix(false)} />
                <strong>Dinheiro</strong>
                <span>Em mãos.</span>
              </label>
            </fieldset>
            {pix && (
              <label className="campo">
                Comprovante do PIX (PDF, JPEG ou PNG, até 5 MB)
                <input type="file" name="comprovante" accept={ARQUIVOS} required />
              </label>
            )}
            <button type="submit" disabled={enviando}>
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
        <form onSubmit={registrar}>
          <label className="campo">
            Tipo
            <select name="tipo" required defaultValue="">
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
                  defaultChecked={origem === 'caixinha'}
                />
                <strong>{NOME_DA_ORIGEM[origem]}</strong>
                {origem === 'proprio-bolso' && <span>Sai da caixinha só no reembolso.</span>}
              </label>
            ))}
          </fieldset>
          <label className="campo">
            Nota (PDF, JPEG ou PNG, até 5 MB)
            <input type="file" name="nota" accept={ARQUIVOS} required />
          </label>
          <button type="submit" disabled={enviando}>
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
                  <tr key={gasto.id}>
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
    <section aria-labelledby="solicitar-complemento">
      <h2 id="solicitar-complemento">Solicitar complemento</h2>
      <p>
        Quando o saldo não cobre os gastos. O valor é dividido em partes iguais entre todos os
        participantes ativos, inclusive os pendentes.
      </p>
      {avisos}
      <form onSubmit={solicitar}>
        <CampoValor rotulo="Valor total (R$)" />
        <button type="submit" disabled={enviando}>
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
        <form onSubmit={definir}>
          <fieldset>
            <legend>Tipo de cota</legend>
            {(['so-cafe', 'completa'] as const).map((tipo) => (
              <label key={tipo} className="opcao">
                <input
                  type="radio"
                  name="tipoDeCota"
                  value={tipo}
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
              type="number"
              min={anoAtual}
              step="1"
              defaultValue={anoAtual}
              required
            />
          </label>
          <CampoValor rotulo="Valor mensal (R$)" />
          <button type="submit" disabled={enviando}>
            Definir valor da cota
          </button>
        </form>
      </section>
    </>
  );
};
