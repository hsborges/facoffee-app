import { setTimeout as sleep } from 'node:timers/promises';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import { type Email, proximaTentativa } from '../domain/aviso.js';
import type { Executor } from './db/database.js';
import { emails } from './db/schema.js';
import type { Logger } from './logger.js';

/** Sends one e-mail; rejects when it was not accepted by the SMTP server. */
export type Enviar = (email: Email) => Promise<void>;

/** Writes the e-mails of an event. Call it inside the transaction that handles the event. */
export const guardar = async (
  tx: Executor,
  eventoId: string,
  lista: readonly Email[],
): Promise<void> => {
  if (lista.length === 0) return;
  await tx.insert(emails).values(lista.map((email) => ({ eventoId, ...email })));
};

/**
 * Sends the next e-mail due at `agora`, in its own transaction: marks it sent, or counts the
 * failure and schedules the next attempt. Resolves undefined when none is due.
 * `skip locked`: two instances send different e-mails.
 */
export const enviarProximo = (db: Executor, enviar: Enviar, agora: Date) =>
  db.transaction(async (tx) => {
    const [email] = await tx
      .select()
      .from(emails)
      .where(and(isNull(emails.enviadoEm), lte(emails.proximaTentativaEm, agora)))
      .orderBy(asc(emails.proximaTentativaEm))
      .limit(1)
      .for('update', { skipLocked: true });
    if (!email) return undefined;
    try {
      await enviar({ para: email.para, assunto: email.assunto, texto: email.texto });
    } catch (error) {
      const tentativas = email.tentativas + 1;
      await tx
        .update(emails)
        .set({ tentativas, proximaTentativaEm: proximaTentativa(tentativas, agora) })
        .where(eq(emails.id, email.id));
      return { id: email.id, eventoId: email.eventoId, tentativas, error };
    }
    await tx.update(emails).set({ enviadoEm: agora }).where(eq(emails.id, email.id));
    return { id: email.id, eventoId: email.eventoId };
  });

/**
 * Every `intervalMs`, sends all e-mails due until the returned function is called.
 *
 * shortcut: sent rows stay in the table forever; purge by age once volume matters.
 */
export const startEnvio = (db: Executor, enviar: Enviar, logger: Logger, intervalMs = 1000) => {
  const controller = new AbortController();
  const enviarDevidos = async (): Promise<void> => {
    const resultado = await enviarProximo(db, enviar, new Date());
    if (!resultado) return;
    if ('error' in resultado) logger.warn('failed to send e-mail; will retry', resultado);
    else logger.info('e-mail sent', resultado);
    if (!controller.signal.aborted) await enviarDevidos();
  };
  const loop = async (): Promise<void> => {
    while (!controller.signal.aborted) {
      await enviarDevidos().catch((error) => logger.error('e-mail relay failed', { error }));
      await sleep(intervalMs, undefined, { signal: controller.signal }).catch(() => {});
    }
  };
  const running = loop();
  return async () => {
    controller.abort();
    await running;
  };
};
