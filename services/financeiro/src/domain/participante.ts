/** The tipos de cota: *Só café* or *Completa*. */
export const TIPOS_DE_COTA = ['so-cafe', 'completa'] as const;

/** Modality chosen by the participante in Participação; Financeiro only records it. */
export type TipoDeCota = (typeof TIPOS_DE_COTA)[number];

/** A cota devida: the valor of one month, fixed once devida. `mes` is `AAAA-MM`. */
export type Cota = {
  readonly mes: string;
  readonly tipoDeCota: TipoDeCota;
  readonly valorEmCentavos: number;
};

/**
 * Participante in Financeiro: whether the person is ativo (entered and has not left) and the
 * cotas devidas. Leaving keeps the cotas: credit or pendência still count on return.
 */
export type Participante = {
  readonly id: string;
  readonly ativo: boolean;
  readonly cotas: readonly Cota[];
};

const inicial = (id: string): Participante => ({ id, ativo: false, cotas: [] });

/** *Participante entrou*: the person becomes ativo, keeping the cotas from before. */
export const entrar = (atual: Participante | undefined, id: string): Participante => ({
  ...(atual ?? inicial(id)),
  ativo: true,
});

/** *Participante saiu*: the person stops being ativo, keeping the cotas. */
export const sair = (atual: Participante | undefined, id: string): Participante => ({
  ...(atual ?? inicial(id)),
  ativo: false,
});

/**
 * *Cota devida*: the participante owes the cota of the month. A cota is devida once per month;
 * a repeated one is ignored, so the valor never changes after it is devida.
 */
export const deverCota = (
  atual: Participante | undefined,
  id: string,
  cota: Cota,
): Participante => {
  const participante = atual ?? inicial(id);
  return participante.cotas.some((c) => c.mes === cota.mes)
    ? participante
    : { ...participante, cotas: [...participante.cotas, cota] };
};
