import type { Event } from './event.js';
import { fail, ok, type Result } from './result.js';

/** Nome and e-mail of a participante, as told by Usuário (ADR 0020). */
export type Contato = { readonly id: string; readonly nome: string; readonly email: string };

/** An aviso by e-mail, ready to be sent. */
export type Email = { readonly para: string; readonly assunto: string; readonly texto: string };

/** Why an event was refused: its payload breaks the contract. */
export type PayloadInvalido = 'payload-invalido';

/** An aviso of an event to a participante, before knowing the e-mail address. */
export type Aviso = {
  readonly participanteId: string;
  readonly assunto: string;
  readonly texto: string;
};

/** The e-mails of an event, and the participantes left out for having no contato. */
export type Avisos = { readonly emails: readonly Email[]; readonly semContato: readonly string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORMAS: Readonly<Record<string, string>> = { pix: 'por PIX', cash: 'em dinheiro' };

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
/** A valor in centavos written in reais, like `R$ 30,00`. */
export const emReais = (centavos: number) => reais.format(centavos / 100);
/** Whether a value read from outside is a UUID. */
export const uuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
/** Whether a value read from outside is a positive integer, like a valor in centavos. */
export const positivo = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

// The payload comes from the broker, so it is validated here; undefined means invalid.
const doEvento = (event: Event): readonly Aviso[] | undefined => {
  const p = event.payload as Record<string, unknown>;
  switch (event.type) {
    // shortcut: no aviso yet, the event names no participante and Usuário answers one contato
    // at a time; send it once Notificação knows the participantes ativos.
    case 'participation.contribution-amount-set':
      return [];
    case 'finance.payment-received': {
      const forma = FORMAS[p.method as string];
      if (!uuid(p.participantId) || !positivo(p.amountInCents) || !forma) return undefined;
      return [
        {
          participanteId: p.participantId,
          assunto: 'Pagamento recebido',
          texto: `O gestor recebeu um pagamento de ${emReais(p.amountInCents)} ${forma} em seu nome.`,
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
        participanteId: s.participantId,
        assunto: 'Complemento solicitado',
        texto:
          `O saldo da caixinha não é suficiente para os gastos, e o gestor solicitou um complemento de ${total}, ` +
          `dividido entre os participantes ativos. A sua parte é de ${emReais(s.amountInCents)}.`,
      }));
    }
    case 'finance.reimbursement-made':
      if (!uuid(p.participantId) || !positivo(p.amountInCents)) return undefined;
      return [
        {
          participanteId: p.participantId,
          assunto: 'Reembolso feito',
          texto: `O gestor fez o reembolso de ${emReais(p.amountInCents)} do gasto que você pagou do próprio bolso.`,
        },
      ];
    default:
      return undefined;
  }
};

/**
 * The avisos of an event: *Pagamento recebido*, *Complemento solicitado* and *Reembolso feito*
 * go to each participante named in it; *Valor da cota definido* has none yet.
 * Fails when the payload breaks the contract.
 */
export const avisosDoEvento = (event: Event): Result<readonly Aviso[], PayloadInvalido> => {
  const lista = doEvento(event);
  return lista ? ok(lista) : fail('payload-invalido');
};

/** The e-mail of an aviso to the contato, greeting them by nome. */
export const email = (contato: Contato, aviso: Aviso): Email => ({
  para: contato.email,
  assunto: aviso.assunto,
  texto: `Olá${contato.nome ? `, ${contato.nome}` : ''}.\n\n${aviso.texto}\n\nFACOFFEE\n`,
});

/** Turns avisos into e-mails to the contatos; participantes without a contato are listed apart. */
export const enderecar = (avisos: readonly Aviso[], contatos: readonly Contato[]): Avisos => {
  const porId = new Map(contatos.map((c) => [c.id, c]));
  return {
    emails: avisos.flatMap((aviso) => {
      const contato = porId.get(aviso.participanteId);
      return contato ? [email(contato, aviso)] : [];
    }),
    semContato: avisos.flatMap(({ participanteId }) =>
      porId.has(participanteId) ? [] : [participanteId],
    ),
  };
};

/** When to try a failed e-mail again: 1 minute after the first failure, doubling up to 1 hour. */
export const proximaTentativa = (tentativas: number, agora: Date): Date =>
  new Date(agora.getTime() + Math.min(2 ** (tentativas - 1), 60) * 60_000);
