import { and, asc, desc, eq, ne } from 'drizzle-orm';
import type { ComprovantesEnviados } from '../../application/comprovantes-enviados.js';
import type { ComprovanteEnviado } from '../../domain/comprovante-enviado.js';
import { fail, ok } from '../../domain/result.js';
import { enqueue } from '../outbox.js';
import type { Executor } from './database.js';
import { pagamentoRepository } from './pagamento-repository.js';
import { pagamentos, participantes, comprovantesEnviados as tabela } from './schema.js';

const doBanco = ({
  situacao,
  valorConfirmadoEmCentavos,
  motivo,
  ...comprovante
}: typeof tabela.$inferSelect): ComprovanteEnviado => {
  // The `analise` check guarantees the valor confirmado of a confirmado and the motivo of a recusado.
  if (situacao === 'confirmado') {
    return {
      ...comprovante,
      situacao,
      valorConfirmadoEmCentavos: valorConfirmadoEmCentavos as number,
    };
  }
  if (situacao === 'recusado') return { ...comprovante, situacao, motivo: motivo as string };
  return { ...comprovante, situacao };
};

const usadoEmPagamento = async (db: Executor, comprovanteId: string) =>
  (
    await db
      .select({ id: pagamentos.id })
      .from(pagamentos)
      .where(eq(pagamentos.comprovanteId, comprovanteId))
  ).length > 0;

const aConfirmar = (id: string) => and(eq(tabela.id, id), eq(tabela.situacao, 'a-confirmar'));

/**
 * {@link ComprovantesEnviados} on PostgreSQL. Every change is conditioned on the comprovante still
 * being a confirmar, so a confirmação and a recusa, an edição or a cancelamento at the same time
 * never both happen.
 */
export const comprovanteEnviadoRepository = (db: Executor): ComprovantesEnviados => ({
  buscar: async (id) => {
    const [linha] = await db.select().from(tabela).where(eq(tabela.id, id));
    return linha && doBanco(linha);
  },
  aConfirmar: async () =>
    // ponytail: every comprovante a confirmar at once, paginate if the list gets long
    (
      await db
        .select()
        .from(tabela)
        .where(eq(tabela.situacao, 'a-confirmar'))
        .orderBy(asc(tabela.enviadoEm), asc(tabela.id))
    ).map(doBanco),
  doParticipante: async (participanteId) =>
    (
      await db
        .select()
        .from(tabela)
        .where(eq(tabela.participanteId, participanteId))
        .orderBy(desc(tabela.enviadoEm), desc(tabela.id))
    ).map(doBanco),
  // The unique comprovante_id makes an arquivo sent twice save nothing; nor does an arquivo already
  // used in a pagamento, which could never be confirmado.
  salvar: (comprovante, events) =>
    db.transaction(async (tx) => {
      const [conhecido] = await tx
        .select({ id: participantes.id })
        .from(participantes)
        .where(eq(participantes.id, comprovante.participanteId));
      if (!conhecido) return fail('participante-nao-encontrado' as const);
      if (await usadoEmPagamento(tx, comprovante.comprovanteId)) {
        return fail('comprovante-ja-usado' as const);
      }
      const saved = await tx
        .insert(tabela)
        .values(comprovante)
        .onConflictDoNothing({ target: tabela.comprovanteId })
        .returning({ id: tabela.id });
      if (saved.length === 0) return fail('comprovante-ja-usado' as const);
      await enqueue(tx, events);
      return ok(undefined);
    }),
  editar: ({ id, comprovanteId, valorEmCentavos }) =>
    db.transaction(async (tx) => {
      const [usado] = await tx
        .select({ id: tabela.id })
        .from(tabela)
        .where(and(eq(tabela.comprovanteId, comprovanteId), ne(tabela.id, id)));
      if (usado || (await usadoEmPagamento(tx, comprovanteId))) {
        return fail('comprovante-ja-usado' as const);
      }
      const saved = await tx
        .update(tabela)
        .set({ comprovanteId, valorEmCentavos })
        .where(aConfirmar(id))
        .returning({ id: tabela.id });
      return saved.length === 0 ? fail('comprovante-ja-analisado' as const) : ok(undefined);
    }),
  recusar: (comprovante, events) =>
    db.transaction(async (tx) => {
      const motivo = comprovante.situacao === 'recusado' ? comprovante.motivo : null;
      const saved = await tx
        .update(tabela)
        .set({ situacao: comprovante.situacao, motivo })
        .where(aConfirmar(comprovante.id))
        .returning({ id: tabela.id });
      if (saved.length === 0) return fail('comprovante-ja-analisado' as const);
      await enqueue(tx, events);
      return ok(undefined);
    }),
  remover: async (id) => {
    const removed = await db.delete(tabela).where(aConfirmar(id)).returning({ id: tabela.id });
    return removed.length === 0 ? fail('comprovante-ja-analisado') : ok(undefined);
  },
  // The row lock holds any other change until the pagamento is saved, or nothing is; an edição
  // saved since `comprovante` was read changes nothing.
  confirmar: (comprovante, pagamento, events) =>
    db.transaction(async (tx) => {
      const [atual] = await tx
        .select({ situacao: tabela.situacao, comprovanteId: tabela.comprovanteId })
        .from(tabela)
        .where(eq(tabela.id, comprovante.id))
        .for('update');
      if (atual?.situacao !== 'a-confirmar') return fail('comprovante-ja-analisado' as const);
      if (atual.comprovanteId !== comprovante.comprovanteId) {
        return fail('comprovante-alterado' as const);
      }
      const salvo = await pagamentoRepository(tx).salvar(pagamento, events);
      if (!salvo.ok) return salvo;
      await tx
        .update(tabela)
        .set({ situacao: 'confirmado', valorConfirmadoEmCentavos: pagamento.valorEmCentavos })
        .where(eq(tabela.id, comprovante.id));
      return ok(undefined);
    }),
});
