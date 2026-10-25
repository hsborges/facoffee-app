import type { Solicitante } from '../domain/arquivo.js';
import type { Gasto, PedidoDeGasto } from '../domain/gasto.js';
import { fail, ok, type Result } from '../domain/result.js';
import type { Clock } from './pagamentos.js';

/** Why a gasto was not saved. */
export type SalvarGastoErro = 'participante-nao-encontrado' | 'nota-ja-usada';

/** Persistence of gastos. */
export type Gastos = {
  /** Saves nothing for a participante Financeiro does not know or a nota of another gasto. */
  readonly salvar: (gasto: Gasto) => Promise<Result<void, SalvarGastoErro>>;
};

/** Why a participante could not register a gasto. */
export type RegistrarGastoErro = 'nota-nao-encontrada' | SalvarGastoErro;

/**
 * Use case: *Pagar compra, conserto, manutenção ou reposição*. Any participante registers the gasto
 * they paid, pela caixinha or do próprio bolso, with a nota they guardaram before. *Gasto feito* is
 * internal: the saved gasto is the fact, and nothing is published. Gives the id of the gasto.
 */
export const registrarGasto =
  (
    gastos: Gastos,
    notaDoParticipante: (participanteId: string, id: string) => Promise<boolean>,
    clock: Clock,
  ) =>
  async (
    solicitante: Pick<Solicitante, 'id'>,
    pedido: PedidoDeGasto,
  ): Promise<Result<string, RegistrarGastoErro>> => {
    if (!(await notaDoParticipante(solicitante.id, pedido.notaId))) {
      return fail('nota-nao-encontrada');
    }
    const gasto = {
      ...pedido,
      id: clock.newId(),
      participanteId: solicitante.id,
      feitoEm: clock.now(),
    };
    const salvo = await gastos.salvar(gasto);
    return salvo.ok ? ok(gasto.id) : salvo;
  };
