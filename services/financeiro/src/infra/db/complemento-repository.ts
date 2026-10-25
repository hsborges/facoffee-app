import type { Complementos } from '../../application/complementos.js';
import { enqueue } from '../outbox.js';
import type { Executor } from './database.js';
import { participanteRepository } from './participante-repository.js';
import { complementos, partes } from './schema.js';

/** {@link Complementos} on PostgreSQL; `salvar` saves the complemento and enqueues its events at once. */
export const complementoRepository = (db: Executor): Complementos => ({
  ativos: participanteRepository(db).ativos,
  salvar: ({ partes: devidas, ...complemento }, events) =>
    db.transaction(async (tx) => {
      await tx.insert(complementos).values(complemento);
      await tx
        .insert(partes)
        .values(devidas.map((parte) => ({ complementoId: complemento.id, ...parte })));
      await enqueue(tx, events);
    }),
});
