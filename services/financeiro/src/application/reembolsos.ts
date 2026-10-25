import type { Solicitante } from '../domain/arquivo.js';
import type { Event } from '../domain/event.js';
import type { Gasto } from '../domain/gasto.js';
import { type ReembolsarErro, type Reembolso, reembolsar } from '../domain/reembolso.js';
import { fail, ok, type Result } from '../domain/result.js';
import type { Clock } from './pagamentos.js';

/** Persistence of reembolsos. */
export type Reembolsos = {
  readonly buscarGasto: (id: string) => Promise<Gasto | undefined>;
  /**
   * Persists the reembolso and its events (outbox) in the same transaction. Saves nothing for a
   * gasto already reembolsado.
   */
  readonly salvar: (
    reembolso: Reembolso,
    events: readonly Event[],
  ) => Promise<Result<void, 'gasto-ja-reembolsado'>>;
};

/** Why the gestor could not reembolsar a gasto. */
export type ReembolsarGastoErro = ReembolsarErro | 'gasto-nao-encontrado' | 'gasto-ja-reembolsado';

/**
 * Use case: *Reembolsar*. The gestor gives back the valor of a gasto pago do próprio bolso, once
 * per gasto. Stores *Reembolso feito* in the outbox and gives the id of the reembolso.
 */
export const reembolsarGasto =
  (reembolsos: Reembolsos, clock: Clock) =>
  async (
    solicitante: Pick<Solicitante, 'perfis'>,
    gastoId: string,
  ): Promise<Result<string, ReembolsarGastoErro>> => {
    const gasto = await reembolsos.buscarGasto(gastoId);
    if (!gasto) return fail('gasto-nao-encontrado');
    const result = reembolsar(solicitante, gasto, {
      reembolsoId: clock.newId(),
      eventId: clock.newId(),
      agora: clock.now(),
    });
    if (!result.ok) return result;
    const { reembolso, evento } = result.value;
    const salvo = await reembolsos.salvar(reembolso, [evento]);
    return salvo.ok ? ok(reembolso.id) : salvo;
  };
