import { anoDe, type Mes, mesDe } from '../domain/calendario.js';
import { type Cota, deverCota } from '../domain/cota.js';
import type { Event } from '../domain/event.js';
import { type Participante, TIPOS_DE_COTA } from '../domain/participante.js';
import type { ValorDaCota } from '../domain/tipo-de-cota.js';
import type { Clock } from './participantes.js';
import type { ValoresDaCota } from './tipos-de-cota.js';

/** Persistence of the cotas devidas. */
export type Cotas = {
  /** Participantes participando who do not owe the cota of `mes` yet. */
  readonly participandoSemCota: (mes: Mes) => Promise<readonly Participante[]>;
  /**
   * Persists the cota and its events (outbox) in the same transaction, unless that cota is
   * already devida; resolves `false` then, without saving anything.
   */
  readonly salvar: (cota: Cota, events: readonly Event[]) => Promise<boolean>;
};

/**
 * Use case: *Todo início de mês*, triggered by the agendador; each participante ativo who does not
 * owe the cota of the current month yet owes it now, storing *Cota devida* in the outbox.
 * Running it again in the same month only reaches who entered meanwhile; participantes whose tipo
 * de cota has no valor for the year are counted in `semValorDaCota` and wait for a later run.
 */
export const iniciarMes =
  (cotas: Cotas, valores: ValoresDaCota, clock: Clock) =>
  async (): Promise<{ readonly cotasDevidas: number; readonly semValorDaCota: number }> => {
    const agora = clock.now();
    const mes = mesDe(agora);
    const doAno = (
      await Promise.all(TIPOS_DE_COTA.map((tipoDeCota) => valores.buscar(tipoDeCota, anoDe(agora))))
    ).filter((valor): valor is ValorDaCota => valor !== undefined);
    const resultados = await Promise.all(
      (await cotas.participandoSemCota(mes)).map(async (participante) => {
        const result = deverCota(participante, mes, doAno, { eventId: clock.newId(), agora });
        if (!result.ok) return result.error;
        return (await cotas.salvar(result.value.cota, [result.value.evento]))
          ? 'devida'
          : 'ja-devida';
      }),
    );
    const contar = (resultado: string) => resultados.filter((r) => r === resultado).length;
    return { cotasDevidas: contar('devida'), semValorDaCota: contar('valor-nao-definido') };
  };
