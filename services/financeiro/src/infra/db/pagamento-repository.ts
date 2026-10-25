import { eq } from 'drizzle-orm';
import type { Pagamentos } from '../../application/pagamentos.js';
import { fail, ok } from '../../domain/result.js';
import { enqueue } from '../outbox.js';
import type { Executor } from './database.js';
import { pagamentos, participantes } from './schema.js';

/** {@link Pagamentos} on PostgreSQL; `salvar` saves the pagamento and enqueues its events at once. */
export const pagamentoRepository = (db: Executor): Pagamentos => ({
  // The unique comprovante_id makes a repeated pagamento por PIX save and publish nothing.
  salvar: (pagamento, events) =>
    db.transaction(async (tx) => {
      const [conhecido] = await tx
        .select({ id: participantes.id })
        .from(participantes)
        .where(eq(participantes.id, pagamento.participanteId));
      if (!conhecido) return fail('participante-nao-encontrado' as const);
      const saved = await tx
        .insert(pagamentos)
        .values(pagamento)
        .onConflictDoNothing()
        .returning({ id: pagamentos.id });
      if (saved.length === 0) return fail('comprovante-ja-usado' as const);
      await enqueue(tx, events);
      return ok(undefined);
    }),
});
