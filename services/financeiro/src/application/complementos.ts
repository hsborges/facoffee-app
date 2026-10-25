import type { Solicitante } from '../domain/arquivo.js';
import { type Complemento, type SolicitarErro, solicitar } from '../domain/complemento.js';
import type { Event } from '../domain/event.js';
import { ok, type Result } from '../domain/result.js';
import type { Clock } from './pagamentos.js';

/** Persistence of complementos. */
export type Complementos = {
  /** Leitura *Participantes ativos*: ids of who entered and has not left. */
  readonly ativos: () => Promise<readonly string[]>;
  /** Persists the complemento, its partes and its events (outbox) in the same transaction. */
  readonly salvar: (complemento: Complemento, events: readonly Event[]) => Promise<void>;
};

/**
 * Use case: *Solicitar complemento*. The gestor informs the valor total, divided among the
 * participantes ativos now. Stores *Complemento solicitado* in the outbox and gives the id of the
 * complemento.
 */
export const solicitarComplemento =
  (complementos: Complementos, clock: Clock) =>
  async (
    solicitante: Pick<Solicitante, 'perfis'>,
    valorTotalEmCentavos: number,
  ): Promise<Result<string, SolicitarErro>> => {
    const result = solicitar(solicitante, valorTotalEmCentavos, await complementos.ativos(), {
      complementoId: clock.newId(),
      eventId: clock.newId(),
      agora: clock.now(),
    });
    if (!result.ok) return result;
    const { complemento, evento } = result.value;
    await complementos.salvar(complemento, [evento]);
    return ok(complemento.id);
  };
