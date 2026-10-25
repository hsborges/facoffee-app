import { describe, expect, it } from 'vitest';
import { parseEvent, retry } from './consumer.js';

const envelope = {
  id: '0b6f2f0e-6a1c-4c55-9a43-6f1f1b0c9e11',
  tipo: 'example.example-registered',
  versao: 1,
  ocorridoEm: '2026-11-01T03:00:00Z',
  payload: {},
};
const buffer = (value: unknown) => Buffer.from(JSON.stringify(value));

describe('parseEvent', () => {
  it('accepts the contract envelope', () => {
    expect(parseEvent(buffer(envelope))).toEqual({ ok: true, value: envelope });
  });

  it.each([
    ['without id', { ...envelope, id: undefined }],
    ['with a non-uuid id', { ...envelope, id: '1' }],
    ['with a non-integer version', { ...envelope, versao: '1' }],
    ['without payload', { ...envelope, payload: null }],
  ])('rejects an envelope %s', (_case, event) => {
    expect(parseEvent(buffer(event))).toEqual({ ok: false, error: 'invalid envelope' });
  });

  it('rejects invalid JSON', () => {
    expect(parseEvent(Buffer.from('{'))).toEqual({ ok: false, error: 'invalid JSON' });
  });
});

describe('retry', () => {
  it('repeats until it succeeds', async () => {
    const failures: number[] = [];
    let calls = 0;

    const result = await retry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error('down');
        return 'done';
      },
      5,
      () => 0,
      (_error, attempt) => failures.push(attempt),
    );

    expect(result).toEqual({ ok: true, value: 'done' });
    expect(failures).toEqual([1, 2]);
  });

  it('gives up after the number of attempts and returns the last error', async () => {
    let calls = 0;
    const result = await retry(
      async () => {
        calls += 1;
        throw new Error(`failure ${calls}`);
      },
      3,
      () => 0,
      () => {},
    );

    expect(calls).toBe(3);
    expect(result).toEqual({ ok: false, error: new Error('failure 3') });
  });
});
