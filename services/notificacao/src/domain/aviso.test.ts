import { describe, expect, it } from 'vitest';
import { avisosDoEvento, type Contato, enderecar, proximaTentativa } from './aviso.js';
import type { Event } from './event.js';
import { ok } from './result.js';

const ana: Contato = {
  id: '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d',
  nome: 'Ana',
  email: 'ana@ufms.br',
  desativado: false,
};
const bia: Contato = {
  id: '2b3c4d5e-6f70-4a81-9b2c-3d4e5f6a7b8c',
  nome: 'Bia',
  email: 'bia@ufms.br',
  desativado: false,
};
const caio: Contato = {
  id: '3c4d5e6f-7081-4b92-8c3d-4e5f6a7b8c9d',
  nome: 'Caio',
  email: 'caio@ufms.br',
  desativado: true,
};
const contatos = [ana, bia, caio];

const evento = (type: string, payload: unknown): Event => ({
  id: '0b6f2f0e-6a1c-4c55-9a43-6f1f1b0c9e14',
  type,
  version: 1,
  occurredAt: '2026-11-01T03:00:00Z',
  payload,
});

const avisos = (event: Event, lista: readonly Contato[]) => {
  const result = avisosDoEvento(event);
  return result.ok ? ok(enderecar(result.value, lista)) : result;
};

// Intl puts a non-breaking space after R$.
const reais = (texto: string) => texto.replaceAll('\u00a0', ' ');

describe('avisos', () => {
  it('Valor da cota definido avisa todos os contatos com acesso ativo', () => {
    const result = avisos(
      evento('participation.contribution-amount-set', {
        contributionType: 'coffee-only',
        year: 2027,
        amountInCents: 2500,
      }),
      contatos,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.semContato).toEqual([]);
    expect(result.value.emails.map((e) => e.para)).toEqual(['ana@ufms.br', 'bia@ufms.br']);
    const [email] = result.value.emails;
    expect(email?.assunto).toBe('Valor da cota de 2027: Só café');
    expect(reais(email?.texto ?? '')).toContain(
      'O gestor definiu o valor da cota de 2027 para o tipo de cota Só café: R$ 25,00 por mês.',
    );
    expect(email?.texto).toMatch(/^Olá, Ana\./);
  });

  it('Pagamento recebido avisa o participante, com a forma do pagamento', () => {
    const payload = { paymentId: bia.id, participantId: ana.id, amountInCents: 18000 };
    const pix = avisos(evento('finance.payment-received', { ...payload, method: 'pix' }), contatos);
    const cash = avisos(
      evento('finance.payment-received', { ...payload, method: 'cash' }),
      contatos,
    );
    expect(pix.ok && pix.value.emails).toEqual([
      expect.objectContaining({ para: 'ana@ufms.br', assunto: 'Pagamento recebido' }),
    ]);
    expect(reais(pix.ok ? (pix.value.emails[0]?.texto ?? '') : '')).toContain(
      'O gestor recebeu o seu pagamento de R$ 180,00 por PIX.',
    );
    expect(reais(cash.ok ? (cash.value.emails[0]?.texto ?? '') : '')).toContain(
      'O gestor recebeu o seu pagamento de R$ 180,00 em dinheiro.',
    );
  });

  it('Complemento solicitado avisa cada participante da sua parte', () => {
    const result = avisos(
      evento('finance.top-up-requested', {
        topUpId: ana.id,
        totalAmountInCents: 1001,
        shares: [
          { participantId: ana.id, amountInCents: 501 },
          { participantId: bia.id, amountInCents: 500 },
        ],
      }),
      contatos,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.emails.map((e) => [e.para, e.assunto])).toEqual([
      ['ana@ufms.br', 'Complemento solicitado'],
      ['bia@ufms.br', 'Complemento solicitado'],
    ]);
    expect(reais(result.value.emails[1]?.texto ?? '')).toContain(
      'o gestor solicitou um complemento de R$ 10,01, dividido entre os participantes ativos. A sua parte é de R$ 5,00.',
    );
  });

  it('Reembolso feito avisa quem pagou o gasto do próprio bolso', () => {
    const result = avisos(
      evento('finance.reimbursement-made', {
        reimbursementId: ana.id,
        expenseId: bia.id,
        participantId: bia.id,
        amountInCents: 4590,
      }),
      contatos,
    );
    expect(result.ok && result.value.emails).toEqual([
      expect.objectContaining({ para: 'bia@ufms.br', assunto: 'Reembolso feito' }),
    ]);
    expect(reais(result.ok ? (result.value.emails[0]?.texto ?? '') : '')).toContain(
      'O gestor fez o reembolso de R$ 45,90 do gasto que você pagou do próprio bolso.',
    );
  });

  it('avisa o participante mesmo com o acesso desativado', () => {
    const result = avisos(
      evento('finance.payment-received', {
        paymentId: ana.id,
        participantId: caio.id,
        amountInCents: 100,
        method: 'cash',
      }),
      contatos,
    );
    expect(result.ok && result.value.emails.map((e) => e.para)).toEqual(['caio@ufms.br']);
  });

  it('separa quem não tem contato, sem e-mail', () => {
    const semCadastro = '4d5e6f70-8192-4a3b-9d4e-5f6a7b8c9d0e';
    const result = avisos(
      evento('finance.reimbursement-made', {
        reimbursementId: ana.id,
        expenseId: bia.id,
        participantId: semCadastro,
        amountInCents: 4590,
      }),
      contatos,
    );
    expect(result).toEqual({ ok: true, value: { emails: [], semContato: [semCadastro] } });
  });

  it('cumprimenta sem nome quando o contato não tem nome', () => {
    const result = avisos(
      evento('finance.payment-received', {
        paymentId: ana.id,
        participantId: ana.id,
        amountInCents: 100,
        method: 'pix',
      }),
      [{ ...ana, nome: '' }],
    );
    expect(result.ok && result.value.emails[0]?.texto).toMatch(/^Olá\./);
  });

  it.each([
    [
      'tipo de cota desconhecido',
      'participation.contribution-amount-set',
      { contributionType: 'x', year: 2027, amountInCents: 1 },
    ],
    [
      'ano antes de 2000',
      'participation.contribution-amount-set',
      { contributionType: 'full', year: 1999, amountInCents: 1 },
    ],
    [
      'ano não inteiro',
      'participation.contribution-amount-set',
      { contributionType: 'full', year: '2027', amountInCents: 1 },
    ],
    [
      'valor zero',
      'finance.payment-received',
      { participantId: ana.id, amountInCents: 0, method: 'pix' },
    ],
    [
      'forma desconhecida',
      'finance.payment-received',
      { participantId: ana.id, amountInCents: 1, method: 'boleto' },
    ],
    [
      'participante sem uuid',
      'finance.reimbursement-made',
      { participantId: '1', amountInCents: 1 },
    ],
    ['complemento sem partes', 'finance.top-up-requested', { totalAmountInCents: 1, shares: [] }],
    [
      'parte inválida',
      'finance.top-up-requested',
      { totalAmountInCents: 1, shares: [{ participantId: ana.id }] },
    ],
    ['evento desconhecido', 'finance.unknown', {}],
  ])('recusa payload inválido: %s', (_, type, payload) => {
    expect(avisos(evento(type, payload), contatos)).toEqual({
      ok: false,
      error: 'payload-invalido',
    });
  });
});

describe('proximaTentativa', () => {
  const agora = new Date('2026-11-01T03:00:00Z');
  const minutos = (tentativas: number) =>
    (proximaTentativa(tentativas, agora).getTime() - agora.getTime()) / 60_000;

  it('dobra a espera a cada tentativa, até uma hora', () => {
    expect([1, 2, 3, 6, 7, 20].map(minutos)).toEqual([1, 2, 4, 32, 60, 60]);
  });
});
