import { expect, it } from 'vitest';
import { createLogger } from './logger.js';

it('writes one JSON line with level, service and serialized error', () => {
  const lines: string[] = [];
  createLogger('example', (line) => lines.push(line)).error('failed', { error: new Error('boom') });

  expect(JSON.parse(lines[0] ?? '')).toMatchObject({
    level: 'error',
    service: 'example',
    message: 'failed',
    error: { name: 'Error', message: 'boom' },
  });
});
