import { eq } from 'drizzle-orm';
import type { BuscarRegistrados, Registrar } from '../application/lembretes.js';
import type { Executor } from './db/database.js';
import { lembretes } from './db/schema.js';
import { guardar } from './envio.js';

/** {@link BuscarRegistrados} on PostgreSQL. */
export const buscarRegistrados =
  (db: Executor): BuscarRegistrados =>
  (mes) =>
    db
      .select({ participanteId: lembretes.participanteId, tipo: lembretes.tipo })
      .from(lembretes)
      .where(eq(lembretes.mes, mes));

/**
 * {@link Registrar} on PostgreSQL, in one transaction: the unique key skips a lembrete another run
 * already registered, and only a lembrete registered here stores its e-mail.
 */
export const registrar =
  (db: Executor): Registrar =>
  (mes, lista) =>
    db.transaction(async (tx) => {
      let registrados = 0;
      for (const { participanteId, tipo, email } of lista) {
        const [lembrete] = await tx
          .insert(lembretes)
          .values({ participanteId, mes, tipo })
          .onConflictDoNothing()
          .returning({ id: lembretes.id });
        if (!lembrete) continue;
        registrados++;
        if (email) await guardar(tx, lembrete.id, [email]);
      }
      return registrados;
    });
