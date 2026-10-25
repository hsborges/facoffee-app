import { describe, expect, it } from 'vitest';
import { publishInOrder } from './outbox.js';

const pending = ['a', 'b', 'c'].map((id) => ({ id, routingKey: `rk.${id}`, event: { id } }));

describe('publishInOrder', () => {
  it('publishes everything in order', async () => {
    const sent: string[] = [];

    const result = await publishInOrder(pending, async (rk) => {
      sent.push(rk);
    });

    expect(sent).toEqual(['rk.a', 'rk.b', 'rk.c']);
    expect(result).toEqual({ published: ['a', 'b', 'c'] });
  });

  it('stops at the first error and does not mark the failed event nor the following ones', async () => {
    const sent: string[] = [];
    const failure = new Error('broker down');

    const result = await publishInOrder(pending, async (rk) => {
      if (rk === 'rk.b') throw failure;
      sent.push(rk);
    });

    expect(sent).toEqual(['rk.a']);
    expect(result).toEqual({ published: ['a'], error: failure });
  });
});
