/**
 * Domain event in the envelope of `contracts/events/envelope.v1.json` (ADR 0006).
 * Field names are part of the contract.
 */
export type Event<Type extends string = string, Payload = unknown> = {
  readonly id: string;
  readonly type: Type;
  readonly version: number;
  readonly occurredAt: string;
  readonly payload: Payload;
};
