import { describe, expect, it } from 'vitest';
import { confirm, register } from './example.js';

const now = new Date('2026-11-01T03:00:00Z');
const ids = {
  id: '11111111-1111-4111-8111-111111111111',
  eventId: '22222222-2222-4222-8222-222222222222',
};

describe('register', () => {
  it('creates a pending example and the Example registered event', () => {
    const result = register({ name: ' Coffee ' }, { ...ids, now });

    expect(result).toEqual({
      ok: true,
      value: {
        example: { id: ids.id, name: 'Coffee', registeredAt: now, confirmedAt: null },
        event: {
          id: ids.eventId,
          type: 'example.example-registered',
          version: 1,
          occurredAt: '2026-11-01T03:00:00.000Z',
          payload: { exampleId: ids.id, name: 'Coffee' },
        },
      },
    });
  });

  it('rejects an empty name', () => {
    expect(register({ name: '  ' }, { ...ids, now })).toEqual({ ok: false, error: 'empty-name' });
  });
});

describe('confirm', () => {
  const pending = { id: ids.id, name: 'Coffee', registeredAt: now, confirmedAt: null };

  it('marks the example as confirmed', () => {
    const later = new Date('2026-11-01T03:00:01Z');
    expect(confirm(pending, later)).toEqual({ ...pending, confirmedAt: later });
  });

  it('keeps the first confirmation', () => {
    const confirmed = confirm(pending, now);
    expect(confirm(confirmed, new Date('2027-01-01T00:00:00Z'))).toBe(confirmed);
  });
});
