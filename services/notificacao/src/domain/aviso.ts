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

/** Who an aviso goes to: every contato with an active access, or one participante. */
export type Destino =
  | { readonly tipo: 'todos' }
  | { readonly tipo: 'participante'; readonly id: string };

/** An aviso of an event, before knowing the e-mail addresses. */
export type Aviso = {
  readonly destino: Destino;
  readonly assunto: string;
  readonly texto: string;
};

/** The e-mails of an event, and the participantes left out for having no contato. */
export type Avisos = { readonly emails: readonly Email[]; readonly semContato: readonly string[] };

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
const participante = (id: string): Destino => ({ tipo: 'participante', id });

// The payload comes from the broker, so it is validated here; undefined means invalid.
const doEvento = (event: Event): readonly Aviso[] | undefined => {
  const p = event.payload as Record<string, unknown>;
  switch (event.type) {
    case 'participation.contribution-amount-set': {
      const tipo = TIPOS_DE_COTA[p.contributionType as string];
      const ano = p.year;
      if (!tipo || !Number.isInteger(ano) || (ano as number) < 2000 || !positivo(p.amountInCents))
        return undefined;
      return [
        {
          destino: { tipo: 'todos' },
          assunto: `Valor da cota de ${ano}: ${tipo}`,
          texto: `O gestor definiu o valor da cota de ${ano} para o tipo de cota ${tipo}: ${emReais(p.amountInCents)} por mês.`,
        },
      ];
    }
    case 'finance.payment-received': {
      const forma = FORMAS[p.method as string];
      if (!uuid(p.participantId) || !positivo(p.amountInCents) || !forma) return undefined;
      return [
        {
          destino: participante(p.participantId),
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
        destino: participante(s.participantId),
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
          destino: participante(p.participantId),
          assunto: 'Reembolso feito',
          texto: `O gestor fez o reembolso de ${emReais(p.amountInCents)} do gasto que você pagou do próprio bolso.`,
        },
      ];
    default:
      return undefined;
  }
};

/**
 * The avisos of an event: *Valor da cota definido* goes to every contato with an active access;
 * *Pagamento recebido*, *Complemento solicitado* and *Reembolso feito* go to each participante
 * named in it. Fails when the payload breaks the contract.
 */
export const avisosDoEvento = (event: Event): Result<readonly Aviso[], PayloadInvalido> => {
  const lista = doEvento(event);
  return lista ? ok(lista) : fail('payload-invalido');
};

const email = (contato: Contato, aviso: Aviso): Email => ({
  para: contato.email,
  assunto: aviso.assunto,
  texto: `Olá${contato.nome ? `, ${contato.nome}` : ''}.\n\n${aviso.texto}\n\nFACOFFEE\n`,
});

/**
 * Turns avisos into e-mails to the contatos. A participante gets the aviso even with the access
 * desativado, because the fact is theirs; participantes without a contato are listed apart.
 */
export const enderecar = (avisos: readonly Aviso[], contatos: readonly Contato[]): Avisos => {
  const porId = new Map(contatos.map((c) => [c.id, c]));
  const ativos = contatos.filter((c) => !c.desativado);
  const destinatarios = ({ destino }: Aviso): readonly Contato[] => {
    if (destino.tipo === 'todos') return ativos;
    const contato = porId.get(destino.id);
    return contato ? [contato] : [];
  };
  return {
    emails: avisos.flatMap((aviso) => destinatarios(aviso).map((c) => email(c, aviso))),
    semContato: avisos.flatMap(({ destino }) =>
      destino.tipo === 'participante' && !porId.has(destino.id) ? [destino.id] : [],
    ),
  };
};

/** When to try a failed e-mail again: 1 minute after the first failure, doubling up to 1 hour. */
export const proximaTentativa = (tentativas: number, agora: Date): Date =>
  new Date(agora.getTime() + Math.min(2 ** (tentativas - 1), 60) * 60_000);
