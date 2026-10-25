import { and, eq } from 'drizzle-orm';
import type { Repository } from '../../application/participantes.js';
import type { Participante } from '../../domain/participante.js';
import { enqueue } from '../outbox.js';
import type { Executor } from './database.js';
import { participantes } from './schema.js';

const colunasDaTroca = ({ troca }: Participante) => ({
  trocaTipoDeCota: troca?.tipoDeCota ?? null,
  trocaAPartirDe: troca?.aPartirDe ?? null,
});

/** A row of `participantes` as a {@link Participante}. */
export const paraParticipante = ({
  trocaTipoDeCota,
  trocaAPartirDe,
  ...participante
}: typeof participantes.$inferSelect): Participante => ({
  ...participante,
  troca:
    trocaTipoDeCota && trocaAPartirDe
      ? { tipoDeCota: trocaTipoDeCota, aPartirDe: trocaAPartirDe }
      : null,
});

const participando = (id: string) =>
  and(eq(participantes.id, id), eq(participantes.participando, true));

/**
 * {@link Repository} on PostgreSQL; entrada and saída save the participante and enqueue its
 * events at once. Each write only applies if the person is still in the expected state.
 */
export const participanteRepository = (db: Executor): Repository => ({
  buscar: async (id) => {
    const [row] = await db.select().from(participantes).where(eq(participantes.id, id));
    return row && paraParticipante(row);
  },
  // The setWhere makes a concurrent entrada of the same person save and publish nothing.
  salvarEntrada: (participante, events) =>
    db.transaction(async (tx) => {
      const saved = await tx
        .insert(participantes)
        .values({ ...participante, ...colunasDaTroca(participante) })
        .onConflictDoUpdate({
          target: participantes.id,
          set: {
            tipoDeCota: participante.tipoDeCota,
            participando: true,
            ...colunasDaTroca(participante),
          },
          setWhere: eq(participantes.participando, false),
        })
        .returning({ id: participantes.id });
      if (saved.length === 0) return false;
      await enqueue(tx, events);
      return true;
    }),
  salvarTroca: async (participante) => {
    const saved = await db
      .update(participantes)
      .set({ tipoDeCota: participante.tipoDeCota, ...colunasDaTroca(participante) })
      .where(participando(participante.id))
      .returning({ id: participantes.id });
    return saved.length > 0;
  },
  // Only who is still participando leaves: a saída and a deactivation publish one event.
  salvarSaida: (participante, events) =>
    db.transaction(async (tx) => {
      const saved = await tx
        .update(participantes)
        .set({ participando: false })
        .where(participando(participante.id))
        .returning({ id: participantes.id });
      if (saved.length === 0) return false;
      await enqueue(tx, events);
      return true;
    }),
});
