import { anoDe } from '../domain/calendario.js';
import type { Event } from '../domain/event.js';
import { TIPOS_DE_COTA, type TipoDeCota } from '../domain/participante.js';
import { fail, ok, type Result } from '../domain/result.js';
import {
  type DefinirValorErro,
  definirValorDaCota,
  repetirValorDoAnoAnterior,
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

/**
 * Use case: *Todo início de ano*, triggered by the agendador; each tipo de cota without a valor
 * for the current year repeats the previous one and stores *Valor da cota definido* in the outbox.
 * Running it again in the same year repeats nothing.
 */
export const iniciarAno =
  (valores: ValoresDaCota, clock: Clock) =>
  async (): Promise<{ readonly valoresRepetidos: number }> => {
    const agora = clock.now();
    const ano = anoDe(agora);
    const salvos = await Promise.all(
      TIPOS_DE_COTA.map(async (tipoDeCota) => {
        const repetido = repetirValorDoAnoAnterior(
          await valores.buscar(tipoDeCota, ano),
          await valores.buscar(tipoDeCota, ano - 1),
          { eventId: clock.newId(), agora },
        );
        return repetido !== undefined && valores.salvar(repetido.valor, [repetido.evento]);
      }),
    );
    return { valoresRepetidos: salvos.filter(Boolean).length };
  };

/** Leitura *Valores da cota*: the valor of each tipo de cota defined for the current year. */
export const consultarValoresDaCota =
  (valores: ValoresDaCota, clock: Pick<Clock, 'now'>) =>
  async (): Promise<readonly ValorDaCota[]> => {
    const ano = anoDe(clock.now());
    const doAno = await Promise.all(
      TIPOS_DE_COTA.map((tipoDeCota) => valores.buscar(tipoDeCota, ano)),
    );
    return doAno.filter((valor) => valor !== undefined);
  };
