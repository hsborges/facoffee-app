import { and, asc, desc, eq, ne } from 'drizzle-orm';
import type { ComprovantesEnviados } from '../../application/comprovantes-enviados.js';
import type { ComprovanteEnviado } from '../../domain/comprovante-enviado.js';
import { fail, ok } from '../../domain/result.js';
import type { Executor } from './database.js';
import { pagamentoRepository } from './pagamento-repository.js';
import { participantes, comprovantesEnviados as tabela } from './schema.js';

const doBanco = ({
  situacao,
  valorConfirmadoEmCentavos,
  motivo,
  ...comprovante
}: typeof tabela.$inferSelect): ComprovanteEnviado => {
  if (situacao === 'confirmado') {
    return { ...comprovante, situacao, valorConfirmadoEmCentavos: valorConfirmadoEmCentavos ?? 0 };
  }
  if (situacao === 'recusado') return { ...comprovante, situacao, motivo: motivo ?? '' };
  return { ...comprovante, situacao };
};

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
  // The unique comprovante_id makes an arquivo sent twice save nothing.
  salvar: (comprovante) =>
    db.transaction(async (tx) => {
      const [conhecido] = await tx
        .select({ id: participantes.id })
        .from(participantes)
        .where(eq(participantes.id, comprovante.participanteId));
      if (!conhecido) return fail('participante-nao-encontrado' as const);
      const saved = await tx
        .insert(tabela)
        .values(comprovante)
        .onConflictDoNothing({ target: tabela.comprovanteId })
        .returning({ id: tabela.id });
      return saved.length === 0 ? fail('comprovante-ja-usado' as const) : ok(undefined);
    }),
  editar: ({ id, comprovanteId, valorEmCentavos }) =>
    db.transaction(async (tx) => {
      const [usado] = await tx
        .select({ id: tabela.id })
        .from(tabela)
        .where(and(eq(tabela.comprovanteId, comprovanteId), ne(tabela.id, id)));
      if (usado) return fail('comprovante-ja-usado' as const);
      const saved = await tx
        .update(tabela)
        .set({ comprovanteId, valorEmCentavos })
        .where(aConfirmar(id))
        .returning({ id: tabela.id });
      return saved.length === 0 ? fail('comprovante-ja-analisado' as const) : ok(undefined);
    }),
  recusar: async (comprovante) => {
    const motivo = comprovante.situacao === 'recusado' ? comprovante.motivo : null;
    const saved = await db
      .update(tabela)
      .set({ situacao: comprovante.situacao, motivo })
      .where(aConfirmar(comprovante.id))
      .returning({ id: tabela.id });
    return saved.length === 0 ? fail('comprovante-ja-analisado') : ok(undefined);
  },
  remover: async (id) => {
    const removed = await db.delete(tabela).where(aConfirmar(id)).returning({ id: tabela.id });
    return removed.length === 0 ? fail('comprovante-ja-analisado') : ok(undefined);
  },
  // The row lock holds any other change until the pagamento is saved, or nothing is.
  confirmar: (comprovante, pagamento, events) =>
    db.transaction(async (tx) => {
      const [atual] = await tx
        .select({ situacao: tabela.situacao })
        .from(tabela)
        .where(eq(tabela.id, comprovante.id))
        .for('update');
      if (atual?.situacao !== 'a-confirmar') return fail('comprovante-ja-analisado' as const);
      const salvo = await pagamentoRepository(tx).salvar(pagamento, events);
      if (!salvo.ok) return salvo;
      await tx
        .update(tabela)
        .set({ situacao: 'confirmado', valorConfirmadoEmCentavos: pagamento.valorEmCentavos })
        .where(eq(tabela.id, comprovante.id));
      return ok(undefined);
    }),
});
