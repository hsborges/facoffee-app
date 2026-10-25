import { anoDe } from './calendario.js';
import type { Event } from './event.js';
import type { TipoDeCota } from './participante.js';
import { fail, ok, type Result } from './result.js';

/** Valor da cota: what a tipo de cota costs per month during `ano`, in centavos. */
export type ValorDaCota = {
  readonly tipoDeCota: TipoDeCota;
  readonly ano: number;
  readonly valorEmCentavos: number;
};

/** *Valor da cota definido*, per `contracts/events/participation.contribution-amount-set.v1.json`. */
export type ValorDaCotaDefinido = Event<
  'participation.contribution-amount-set',
  {
    readonly contributionType: 'coffee-only' | 'full';
    readonly year: number;
    readonly amountInCents: number;
  }
>;

/** Why defining a valor da cota was refused. */
export type DefinirValorErro = 'sem-permissao' | 'ano-passado' | 'valor-ja-definido';

const NOS_CONTRATOS = { 'so-cafe': 'coffee-only', completa: 'full' } as const;

/**
 * *Definir valor da cota*: only the gestor defines it, once per tipo de cota and year, for the
 * current year or a later one; the valor does not change during the year.
 * `atual` is the valor already defined for that tipo de cota and year, if any.
 */
export const definirValorDaCota = (
  atual: ValorDaCota | undefined,
  solicitante: { readonly perfis: readonly string[] },
  valor: ValorDaCota,
  contexto: { readonly eventId: string; readonly agora: Date },
): Result<
  { readonly valor: ValorDaCota; readonly evento: ValorDaCotaDefinido },
  DefinirValorErro
> => {
  if (!solicitante.perfis.includes('gestor')) return fail('sem-permissao');
  const { eventId, agora } = contexto;
  if (valor.ano < anoDe(agora)) return fail('ano-passado');
  if (atual) return fail('valor-ja-definido');
  return ok({
    valor,
    evento: {
      id: eventId,
      type: 'participation.contribution-amount-set',
      version: 1,
      occurredAt: agora.toISOString(),
      payload: {
        contributionType: NOS_CONTRATOS[valor.tipoDeCota],
        year: valor.ano,
        amountInCents: valor.valorEmCentavos,
      },
    },
  });
};
