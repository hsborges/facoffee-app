import type { Event } from './event.js';
import { fail, ok, type Result } from './result.js';

/** Who can receive avisos, as listed by Usuário (ADR 0019). */
export type Contato = {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly desativado: boolean;
};

/** An aviso by e-mail, ready to be sent. */
export type Email = { readonly para: string; readonly assunto: string; readonly texto: string };

/** Why an event was refused: its payload breaks the contract. */
export type PayloadInvalido = 'payload-invalido';

/** The e-mails of an event, and the participantes left out for having no contato. */
export type Avisos = { readonly emails: readonly Email[]; readonly semContato: readonly string[] };

// `todos`: every contato with an active access.
type Aviso = { readonly para: string; readonly assunto: string; readonly texto: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS_DE_COTA: Readonly<Record<string, string>> = {
  'coffee-only': 'Só café',
  full: 'Completa',
};
const FORMAS: Readonly<Record<string, string>> = { pix: 'por PIX', cash: 'em dinheiro' };

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const emReais = (centavos: number) => reais.format(centavos / 100);
const uuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const positivo = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

// The payload comes from the broker, so it is validated here; undefined means invalid.
const doEvento = (event: Event): readonly Aviso[] | undefined => {
  const p = event.payload as Record<string, unknown>;
  switch (event.type) {
    case 'participation.contribution-amount-set': {
      const tipo = TIPOS_DE_COTA[p.contributionType as string];
      if (!tipo || !Number.isInteger(p.year) || !positivo(p.amountInCents)) return undefined;
      return [
        {
          para: 'todos',
          assunto: `Valor da cota de ${p.year}: ${tipo}`,
          texto: `O gestor definiu o valor da cota de ${p.year} para o tipo de cota ${tipo}: ${emReais(p.amountInCents)} por mês.`,
        },
      ];
    }
    case 'finance.payment-received': {
      const forma = FORMAS[p.method as string];
      if (!uuid(p.participantId) || !positivo(p.amountInCents) || !forma) return undefined;
      return [
        {
          para: p.participantId,
          assunto: 'Pagamento recebido',
          texto: `O gestor recebeu o seu pagamento de ${emReais(p.amountInCents)} ${forma}.`,
        },
      ];
    }
    case 'finance.top-up-requested': {
      const partes = p.shares;
      const valido =
        positivo(p.totalAmountInCents) &&
        Array.isArray(partes) &&
        partes.length > 0 &&
        partes.every((s) => uuid(s?.participantId) && positivo(s?.amountInCents));
      if (!valido) return undefined;
      const total = emReais(p.totalAmountInCents as number);
      return (partes as { participantId: string; amountInCents: number }[]).map((s) => ({
        para: s.participantId,
        assunto: 'Complemento solicitado',
        texto:
          `O saldo da caixinha não é suficiente para os gastos, e o gestor solicitou um complemento de ${total}, ` +
          `dividido em partes iguais entre os participantes ativos. A sua parte é de ${emReais(s.amountInCents)}.`,
      }));
    }
    case 'finance.reimbursement-made':
      if (!uuid(p.participantId) || !positivo(p.amountInCents)) return undefined;
      return [
        {
          para: p.participantId,
          assunto: 'Reembolso feito',
          texto: `O gestor fez o reembolso de ${emReais(p.amountInCents)} do gasto que você pagou do próprio bolso.`,
        },
      ];
    default:
      return undefined;
  }
};

const email = (contato: Contato, aviso: Aviso): Email => ({
  para: contato.email,
  assunto: aviso.assunto,
  texto: `Olá${contato.nome ? `, ${contato.nome}` : ''}.\n\n${aviso.texto}\n\nFACOFFEE\n`,
});

/**
 * The avisos of an event: *Valor da cota definido* goes to every contato with an active access;
 * *Pagamento recebido*, *Complemento solicitado* and *Reembolso feito* go to each participante
 * named in it, even with the access desativado. Participantes without a contato are listed apart.
 */
export const avisos = (
  event: Event,
  contatos: readonly Contato[],
): Result<Avisos, PayloadInvalido> => {
  const lista = doEvento(event);
  if (!lista) return fail('payload-invalido');
  const porId = new Map(contatos.map((c) => [c.id, c]));
  const ativos = contatos.filter((c) => !c.desativado);
  const destinatarios = (aviso: Aviso) => {
    if (aviso.para === 'todos') return ativos;
    const contato = porId.get(aviso.para);
    return contato ? [contato] : [];
  };
  return ok({
    emails: lista.flatMap((aviso) => destinatarios(aviso).map((c) => email(c, aviso))),
    semContato: lista
      .filter((aviso) => aviso.para !== 'todos' && !porId.has(aviso.para))
      .map((aviso) => aviso.para),
  });
};

/** When to try a failed e-mail again: 1 minute after the first failure, doubling up to 1 hour. */
export const proximaTentativa = (tentativas: number, agora: Date): Date =>
  new Date(agora.getTime() + Math.min(2 ** (tentativas - 1), 60) * 60_000);
