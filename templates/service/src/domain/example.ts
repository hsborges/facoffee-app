import type { Event } from './event.js';
import { fail, ok, type Result } from './result.js';

export type Example = {
  readonly id: string;
  readonly name: string;
  readonly registeredAt: Date;
  readonly confirmedAt: Date | null;
};

export type ExampleRegistered = Event<
  'example.example-registered',
  { readonly exampleId: string; readonly name: string }
>;

export type RegisterError = 'empty-name';

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
      tipo: 'example.example-registered',
      versao: 1,
      ocorridoEm: now.toISOString(),
      payload: { exampleId: id, name },
    },
  });
};

export const confirm = (example: Example, now: Date): Example =>
  example.confirmedAt ? example : { ...example, confirmedAt: now };
