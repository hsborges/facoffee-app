import { describe, expect, it } from 'vitest';
import { recusadoPeloDestinatario } from './envio.js';

const erro = (campos: Record<string, unknown>) => Object.assign(new Error('smtp'), campos);

describe('recusadoPeloDestinatario', () => {
  it('só a recusa permanente do destinatário (5xx no RCPT TO)', () => {
    expect(
      recusadoPeloDestinatario(erro({ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550 })),
    ).toBe(true);
  });

  it.each([
    ['recusa temporária', { code: 'EENVELOPE', command: 'RCPT TO', responseCode: 450 }],
    ['remetente recusado', { code: 'EENVELOPE', command: 'MAIL FROM', responseCode: 550 }],
    ['senha errada', { code: 'EAUTH', command: 'AUTH PLAIN', responseCode: 535 }],
    ['servidor fora do ar', { code: 'ECONNECTION' }],
  ])('tenta de novo: %s', (_, campos) => {
    expect(recusadoPeloDestinatario(erro(campos))).toBe(false);
  });

  it('tenta de novo o que não é erro do SMTP', () => {
    expect(recusadoPeloDestinatario('boom')).toBe(false);
    expect(recusadoPeloDestinatario(undefined)).toBe(false);
  });
});
