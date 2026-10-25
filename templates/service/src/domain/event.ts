// Envelope from contracts/events/envelope.v1.json (ADR 0004); field names are part of the contract.
export type Event<Type extends string = string, Payload = unknown> = {
  readonly id: string;
  readonly tipo: Type;
  readonly versao: number;
  readonly ocorridoEm: string;
  readonly payload: Payload;
};
