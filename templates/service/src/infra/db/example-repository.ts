import { eq } from 'drizzle-orm';
import type { Repository } from '../../application/examples.js';
import { enqueue } from '../outbox.js';
import type { Executor } from './database.js';
import { examples } from './schema.js';

export const exampleRepository = (db: Executor): Repository => ({
  find: async (id) => {
    const [row] = await db.select().from(examples).where(eq(examples.id, id));
    return row;
  },
  save: (example, events) =>
    db.transaction(async (tx) => {
      await tx
        .insert(examples)
        .values(example)
        .onConflictDoUpdate({ target: examples.id, set: example });
      await enqueue(tx, events);
    }),
});
