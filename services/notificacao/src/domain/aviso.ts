import type { Event } from './event.js';
import { fail, ok, type Result } from './result.js';

/** Nome and e-mail of a participante or a gestor, as told by Usuário (ADR 0020, 0031). */
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

/** An aviso to every gestor about what a participante did; the texto takes the participante's nome. */
export type AvisoAosGestores = {
  readonly aosGestores: true;
  readonly participanteId: string;
  readonly assunto: string;
  readonly texto: (nome: string) => string;
};

/**
 * The e-mails of an event, the participantes left out for having no contato, and whether an aviso
 * to the gestores was left out for having no gestor.
 */
export type Avisos = {
  readonly emails: readonly Email[];
  readonly semContato: readonly string[];
  readonly semGestor: boolean;
};

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
const doEvento = (event: Event): readonly (Aviso | AvisoAosGestores)[] | undefined => {
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
    case 'finance.receipt-sent': {
      if (!uuid(p.participantId) || !positivo(p.amountInCents)) return undefined;
      const valor = emReais(p.amountInCents);
      return [
        {
          aosGestores: true,
          participanteId: p.participantId,
          assunto: 'Comprovante enviado',
          texto: (nome) =>
            `${nome || 'Um participante'} enviou um comprovante de ${valor} para você confirmar ou recusar no FACOFFEE.`,
        },
      ];
    }
    case 'finance.receipt-rejected': {
      const motivo = typeof p.reason === 'string' ? p.reason.trim() : '';
      if (!uuid(p.participantId) || !positivo(p.amountInCents) || !motivo) return undefined;
      return [
        {
          participanteId: p.participantId,
          assunto: 'Comprovante recusado',
          texto:
            `O gestor recusou o comprovante de ${emReais(p.amountInCents)} que você enviou, e ele não conta como pagamento.\n\n` +
            `Motivo: ${motivo}`,
        },
      ];
    }
    default:
      return undefined;
  }
};

/**
 * The avisos of an event: *Pagamento recebido*, *Complemento solicitado*, *Reembolso feito* and
 * *Comprovante recusado* go to each participante named in it; *Comprovante enviado* goes to the
 * gestores; *Valor da cota definido* has none yet. Fails when the payload breaks the contract.
 */
export const avisosDoEvento = (
  event: Event,
): Result<readonly (Aviso | AvisoAosGestores)[], PayloadInvalido> => {
  const lista = doEvento(event);
  return lista ? ok(lista) : fail('payload-invalido');
};

/** The e-mail of an aviso to the contato, greeting them by nome. */
export const email = (contato: Contato, aviso: Pick<Aviso, 'assunto' | 'texto'>): Email => ({
  para: contato.email,
  assunto: aviso.assunto,
  texto: `Olá${contato.nome ? `, ${contato.nome}` : ''}.\n\n${aviso.texto}\n\nFACOFFEE\n`,
});

/**
 * Turns avisos into e-mails to the contatos, and avisos to the gestores into one e-mail per gestor,
 * naming the participante. Participantes without a contato are listed apart; to the gestores, they
 * go unnamed.
 */
export const enderecar = (
  avisos: readonly (Aviso | AvisoAosGestores)[],
  contatos: readonly Contato[],
  gestores: readonly Contato[],
): Avisos => {
  const porId = new Map(contatos.map((c) => [c.id, c]));
  const aosParticipantes = avisos.filter((a): a is Aviso => !('aosGestores' in a));
  const aosGestores = avisos.filter((a): a is AvisoAosGestores => 'aosGestores' in a);
  return {
    emails: [
      ...aosParticipantes.flatMap((aviso) => {
        const contato = porId.get(aviso.participanteId);
        return contato ? [email(contato, aviso)] : [];
      }),
      ...aosGestores.flatMap(({ participanteId, assunto, texto }) =>
        gestores.map((g) =>
          email(g, { assunto, texto: texto(porId.get(participanteId)?.nome ?? '') }),
        ),
      ),
    ],
    semContato: aosParticipantes.flatMap(({ participanteId }) =>
      porId.has(participanteId) ? [] : [participanteId],
    ),
    semGestor: aosGestores.length > 0 && gestores.length === 0,
  };
};

/** When to try a failed e-mail again: 1 minute after the first failure, doubling up to 1 hour. */
export const proximaTentativa = (tentativas: number, agora: Date): Date =>
  new Date(agora.getTime() + Math.min(2 ** (tentativas - 1), 60) * 60_000);
