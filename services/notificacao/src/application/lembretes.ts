import { type Contato, type Email, email } from '../domain/aviso.js';
import {
  diaEmCampoGrande,
  lembretesDevidos,
  type Pendente,
  type Registro,
} from '../domain/lembrete.js';
import type { BuscarContato } from './avisos.js';

/** The ativos pendentes, from Financeiro; rejects when Financeiro cannot be reached. */
export type BuscarPendentes = () => Promise<readonly Pendente[]>;

/** The lembretes already registered in a month. */
export type BuscarRegistrados = (mes: string) => Promise<readonly Registro[]>;

/**
 * Registers the lembretes of a month, each at most once even under concurrent runs, and stores
 * for sending the e-mail of the ones registered now. Resolves with how many were registered.
 */
export type Registrar = (
  mes: string,
  lembretes: readonly (Registro & { readonly email: Email | undefined })[],
) => Promise<number>;

/**
 * Policy *Lembrar os pendentes*, fired by the agendador (ADR 0027): avisa the cota devida and
 * lembra each pendente once a month, only them and only about their own pendência. Resolves with
 * how many lembretes were registered and the participantes left without e-mail for having no
 * contato. Before `horaDosLembretes`, in Campo Grande, none is due.
 */
export const lembrarPendentes =
  (
    buscarPendentes: BuscarPendentes,
    buscarRegistrados: BuscarRegistrados,
    buscarContato: BuscarContato,
    registrar: Registrar,
    horaDosLembretes?: number,
  ) =>
  async (agora: Date) => {
    const quando = diaEmCampoGrande(agora);
    const [pendentes, registrados] = await Promise.all([
      buscarPendentes(),
      buscarRegistrados(quando.mes),
    ]);
    const devidos = lembretesDevidos(pendentes, quando, registrados, horaDosLembretes);
    const ids = devidos.flatMap(({ aviso }) => (aviso ? [aviso.participanteId] : []));
    const contatos = (await Promise.all(ids.map(buscarContato))).filter(
      (c): c is Contato => c !== undefined,
    );
    const porId = new Map(contatos.map((c) => [c.id, c]));
    const lembretes = await registrar(
      quando.mes,
      devidos.map(({ participanteId, tipo, aviso }) => {
        const contato = porId.get(participanteId);
        return {
          participanteId,
          tipo,
          email: aviso && contato ? email(contato, aviso) : undefined,
        };
      }),
    );
    return { lembretes, semContato: ids.filter((id) => !porId.has(id)) };
  };
