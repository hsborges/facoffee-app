import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  type CaixinhaDoMes as CaixinhaDoMesLida,
  type Caixinha as CaixinhaLida,
  comandar,
  type Leitura,
  ler,
  type Participacao,
  type Situacao,
  type TipoDeCota,
  type TipoDeGasto,
} from './api';
import {
  dataEmCampoGrande,
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
export const Carregando = () => <p role="status">Carregando…</p>;

/** Announces that the page could not load, with a button to try again. */
export const FalhaAoCarregar = ({ tentarDeNovo }: { tentarDeNovo: () => void }) => (
  <>
    <p role="alert">Não foi possível carregar esta página.</p>
    <button type="button" onClick={tentarDeNovo}>
      Tentar de novo
    </button>
  </>
);

const EscolhaDoTipoDeCota = ({
  legenda,
  botao,
  inicial,
  desabilitado,
  escolher,
}: {
  legenda: string;
  botao: string;
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
            <input type="radio" name="tipoDeCota" value={tipo} defaultChecked={tipo === inicial} />
            <strong>{NOME_DO_TIPO_DE_COTA[tipo]}</strong>
            <span>{ITENS_DO_TIPO_DE_COTA[tipo]}</span>
          </label>
        ))}
      </fieldset>
      <button type="submit" disabled={desabilitado}>
        {botao}
      </button>
    </form>
  );
};

const CreditoOuPendencia = ({ situacao }: { situacao: Situacao }) => (
  <section aria-labelledby="credito-ou-pendencia">
    <h2 id="credito-ou-pendencia">Crédito ou pendência</h2>
    {situacao.pendenteEmCentavos > 0 ? (
      <p>
        Pendente: <strong>{emReais(situacao.pendenteEmCentavos)}</strong>. Acerte com o gestor, sem
        multa nem juros.
      </p>
    ) : situacao.creditoEmCentavos > 0 ? (
      <p>
        Crédito: <strong>{emReais(situacao.creditoEmCentavos)}</strong>, abatido das próximas cotas
        e complementos.
      </p>
    ) : (
      <p>Em dia: nenhum crédito nem pendência.</p>
    )}
    {situacao.cotas.length > 0 && (
      <table>
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
            <tr key={cota.mes}>
              <td>{mesPorExtenso(cota.mes)}</td>
              <td>{NOME_DO_TIPO_DE_COTA[cota.tipoDeCota]}</td>
              <td>{emReais(cota.valorEmCentavos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
    {situacao.complementos.length > 0 && (
      <table>
        <caption>Complementos</caption>
        <thead>
          <tr>
            <th scope="col">Solicitado em</th>
            <th scope="col">Sua parte</th>
          </tr>
        </thead>
        <tbody>
          {situacao.complementos.map((complemento) => (
            <tr key={complemento.id}>
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
 * crédito or pendência with the cotas and complementos, and desativar the person's own access.
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
      {falha && <p role="alert">{falha}</p>}
      <p role="status">{feito}</p>
      <section aria-labelledby="participacao">
        <h2 id="participacao">Participação</h2>
        {atual?.participando ? (
          <>
            <p>
              Você participa com a cota <strong>{NOME_DO_TIPO_DE_COTA[atual.tipoDeCota]}</strong>.
              {atual.troca &&
                ` A partir de ${mesPorExtenso(atual.troca.aPartirDe)}, ela passa a ser ${NOME_DO_TIPO_DE_COTA[atual.troca.tipoDeCota]}.`}
            </p>
            <EscolhaDoTipoDeCota
              key={atual.troca?.tipoDeCota ?? atual.tipoDeCota}
              legenda="Trocar tipo de cota (vale a partir do mês seguinte)"
              botao="Trocar tipo de cota"
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
            <button type="button" className="fantasma" disabled={enviando} onClick={pedirSaida}>
              Pedir saída
            </button>
          </>
        ) : (
          <>
            <p>Você não participa da divisão dos custos da copa.</p>
            <EscolhaDoTipoDeCota
              legenda="Escolha o tipo de cota"
              botao="Pedir entrada"
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
      {situacao.situacao === 'ok' && <CreditoOuPendencia situacao={situacao.valor} />}
      <section aria-labelledby="acesso">
        <h2 id="acesso">Acesso</h2>
        <p>Ao desativar seu acesso, sua participação termina. Só o gestor pode reativá-lo.</p>
        <button type="button" className="fantasma" disabled={enviando} onClick={desativarAcesso}>
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
        <table>
          <caption>Caixinha de {mesPorExtenso(lida.valor.mes)}</caption>
          <tbody>
            <tr>
              <th scope="row">Saldo no início do mês</th>
              <td>{emReais(lida.valor.saldoNoInicioEmCentavos)}</td>
            </tr>
            <tr>
              <th scope="row">Entrou (pagamentos recebidos)</th>
              <td>{emReais(lida.valor.recebidoEmCentavos)}</td>
            </tr>
            {Object.entries(NOME_DO_TIPO_DE_GASTO).map(([tipo, nome]) => (
              <tr key={tipo}>
                <th scope="row">Saiu: {nome}</th>
                <td>{emReais(lida.valor.gastosPorTipoEmCentavos[tipo as TipoDeGasto])}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">Saldo no fim do mês</th>
              <td>{emReais(lida.valor.saldoNoFimEmCentavos)}</td>
            </tr>
          </tbody>
        </table>
      )}
      <p>Um gasto pago do próprio bolso sai da caixinha no mês do reembolso.</p>
    </section>
  );
};

/** *Caixinha*: the saldo da caixinha, the gastos do ano anterior and the caixinha do mês. */
export const Caixinha = ({ token }: { token: string }) => {
  const [caixinha, recarregar] = useLeitura<CaixinhaLida>(token, '/api/financeiro/caixinha');
  if (!caixinha) return <Carregando />;
  if (caixinha.situacao !== 'ok') return <FalhaAoCarregar tentarDeNovo={recarregar} />;
  return (
    <>
      <dl>
        <dt>Saldo da caixinha</dt>
        <dd>{emReais(caixinha.valor.saldoEmCentavos)}</dd>
        <dt>Gastos do ano anterior</dt>
        <dd>{emReais(caixinha.valor.gastosDoAnoAnteriorEmCentavos)}</dd>
      </dl>
      <CaixinhaDoMes token={token} />
    </>
  );
};
