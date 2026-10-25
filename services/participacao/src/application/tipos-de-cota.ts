import type { Event } from '../domain/event.js';
import type { TipoDeCota } from '../domain/participante.js';
import { fail, ok, type Result } from '../domain/result.js';
import {
  type DefinirValorErro,
  definirValorDaCota,
  type ValorDaCota,
} from '../domain/tipo-de-cota.js';
import type { Clock } from './participantes.js';

/** Persistence of the valores da cota of each tipo de cota. */
export type ValoresDaCota = {
  readonly buscar: (tipoDeCota: TipoDeCota, ano: number) => Promise<ValorDaCota | undefined>;
  /**
   * Persists the valor and its events (outbox) in the same transaction, unless that tipo de cota
   * and year already have a valor; resolves `false` then, without saving anything.
   */
  readonly salvar: (valor: ValorDaCota, events: readonly Event[]) => Promise<boolean>;
};

/** Use case: *Definir valor da cota*; stores *Valor da cota definido* in the outbox. */
export const definirValor =
  (valores: ValoresDaCota, clock: Clock) =>
  async (
    solicitante: { readonly perfis: readonly string[] },
    valor: ValorDaCota,
  ): Promise<Result<void, DefinirValorErro>> => {
    const result = definirValorDaCota(
      await valores.buscar(valor.tipoDeCota, valor.ano),
      solicitante,
      valor,
      { eventId: clock.newId(), agora: clock.now() },
    );
    if (!result.ok) return result;
    const salvo = await valores.salvar(result.value.valor, [result.value.evento]);
    return salvo ? ok(undefined) : fail('valor-ja-definido');
  };
