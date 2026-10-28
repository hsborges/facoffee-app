/** Where the money of a gasto came from: the caixinha or the próprio bolso of who paid. */
export const ORIGENS = ['caixinha', 'proprio-bolso'] as const;

/** Origem do dinheiro of a gasto. */
export type Origem = (typeof ORIGENS)[number];

/**
 * What the gasto was for: café, outros itens da copa (açúcar, leite, bolachas, chás, filtros,
 * copos), conserto e manutenção da máquina, or reposição de itens quebrados.
 */
export const TIPOS_DE_GASTO = [
  'cafe',
  'outros-itens',
  'conserto-e-manutencao',
  'reposicao',
] as const;

/** Tipo de gasto. */
export type TipoDeGasto = (typeof TIPOS_DE_GASTO)[number];

/** A compra, conserto, manutenção or reposição; only the valor total and the nota are kept. */
export type Gasto = {
  readonly id: string;
  /** Who paid; the one reembolsado when the gasto was pago do próprio bolso. */
  readonly participanteId: string;
  readonly valorEmCentavos: number;
  readonly origem: Origem;
  readonly tipo: TipoDeGasto;
  /** The nota guardada with `/guardar-nota`. */
  readonly notaId: string;
  readonly registradoEm: Date;
};

/** What a participante informs when registering a gasto. */
export type PedidoDeGasto = Pick<Gasto, 'valorEmCentavos' | 'origem' | 'tipo' | 'notaId'>;

/**
 * How much the gasto takes out of the caixinha. A gasto pago do próprio bolso takes nothing: its
 * money only leaves the caixinha with the reembolso, so it does not leave twice.
 */
export const saidaDaCaixinha = (gasto: Pick<Gasto, 'origem' | 'valorEmCentavos'>): number =>
  gasto.origem === 'caixinha' ? gasto.valorEmCentavos : 0;
