import type { Event } from './event.js';
import { fail, ok, type Result } from './result.js';

/** Sample aggregate; replace it with the context's own. `confirmedAt` is null until confirmed. */
export type Example = {
  readonly id: string;
  readonly name: string;
  readonly registeredAt: Date;
  readonly confirmedAt: Date | null;
};

/** *Example registered*, published when an Example is registered. */
export type ExampleRegistered = Event<
  'example.example-registered',
  { readonly exampleId: string; readonly name: string }
>;

/** Why an Example cannot be registered. */
export type RegisterError = 'empty-name';

/** Registers an Example with a trimmed, non-empty name, along with its *Example registered*. */
export const register = (
  command: { readonly name: string },
  context: { readonly id: string; readonly eventId: string; readonly now: Date },
): Result<{ readonly example: Example; readonly event: ExampleRegistered }, RegisterError> => {
  const name = command.name.trim();
  if (name === '') return fail('empty-name');
  const { id, eventId, now } = context;
  return ok({
    example: { id, name, registeredAt: now, confirmedAt: null },
    event: {
      id: eventId,
      type: 'example.example-registered',
      version: 1,
      occurredAt: now.toISOString(),
      payload: { exampleId: id, name },
    },
  });
};

/** Confirms an Example; an already confirmed one is returned unchanged. */
export const confirm = (example: Example, now: Date): Example =>
  example.confirmedAt ? example : { ...example, confirmedAt: now };
