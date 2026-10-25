import type { Event } from '../domain/event.js';
import { confirm, type Example, register } from '../domain/example.js';
import { fail, ok, type Result } from '../domain/result.js';

export type Repository = {
  readonly find: (id: string) => Promise<Example | undefined>;
  // Persists the aggregate and its events (outbox) in the same transaction.
  readonly save: (example: Example, events: readonly Event[]) => Promise<void>;
};

export type Clock = { readonly now: () => Date; readonly newId: () => string };

export const registerExample =
  (repository: Repository, clock: Clock) => async (command: { readonly name: string }) => {
    const result = register(command, {
      id: clock.newId(),
      eventId: clock.newId(),
      now: clock.now(),
    });
    if (!result.ok) return result;
    await repository.save(result.value.example, [result.value.event]);
    return ok(result.value.example);
  };

// Handler for Example registered. The payload comes from the broker, so it is validated here.
export const confirmExample =
  (repository: Repository, clock: Clock) =>
  async (event: Event): Promise<Result<Example, 'invalid-payload' | 'example-not-found'>> => {
    const exampleId = (event.payload as { exampleId?: unknown } | null)?.exampleId;
    if (typeof exampleId !== 'string') return fail('invalid-payload');
    const example = await repository.find(exampleId);
    if (!example) return fail('example-not-found');
    const confirmed = confirm(example, clock.now());
    if (confirmed !== example) await repository.save(confirmed, []);
    return ok(confirmed);
  };
