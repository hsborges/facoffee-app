import { describe, expect, it } from 'vitest';
import type { Event } from '../domain/event.js';
import type { Example } from '../domain/example.js';
import { confirmExample, type Repository, registerExample } from './examples.js';

const now = new Date('2026-11-01T03:00:00Z');

const inMemory = () => {
  const examples = new Map<string, Example>();
  const events: Event[] = [];
  const repository: Repository = {
    find: async (id) => examples.get(id),
    save: async (example, newEvents) => {
      examples.set(example.id, example);
      events.push(...newEvents);
    },
  };
  let n = 0;
  const clock = { now: () => now, newId: () => `id-${++n}` };
  return { examples, events, repository, clock };
};

describe('registerExample', () => {
  it('saves the example together with its event', async () => {
    const { examples, events, repository, clock } = inMemory();

    const result = await registerExample(repository, clock)({ name: 'Coffee' });

    expect(result.ok).toBe(true);
    expect(examples.get('id-1')?.name).toBe('Coffee');
    expect(events).toMatchObject([{ id: 'id-2', type: 'example.example-registered' }]);
  });

  it('saves nothing when the domain rejects the command', async () => {
    const { examples, repository, clock } = inMemory();

    expect(await registerExample(repository, clock)({ name: '' })).toEqual({
      ok: false,
      error: 'empty-name',
    });
    expect(examples.size).toBe(0);
  });
});

describe('confirmExample', () => {
  it('confirms the example from the event', async () => {
    const { examples, events, repository, clock } = inMemory();
    await registerExample(repository, clock)({ name: 'Coffee' });
    const [event] = events;
    if (!event) throw new Error('event not published');

    await confirmExample(repository, clock)(event);

    expect(examples.get('id-1')?.confirmedAt).toEqual(now);
  });

  it('rejects an invalid payload and an unknown example', async () => {
    const { repository, clock } = inMemory();
    const confirmFrom = confirmExample(repository, clock);
    const event = { id: 'e', type: 'example.example-registered', version: 1, occurredAt: '' };

    expect(await confirmFrom({ ...event, payload: null })).toEqual({
      ok: false,
      error: 'invalid-payload',
    });
    expect(await confirmFrom({ ...event, payload: { exampleId: 'x' } })).toEqual({
      ok: false,
      error: 'example-not-found',
    });
  });
});
