import { describe, expect, it } from 'vitest';
import type { Contato, Email } from '../domain/aviso.js';
import type { Event } from '../domain/event.js';
import { avisar } from './avisos.js';

const ana: Contato = {
  id: '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d',
  nome: 'Ana',
  email: 'ana@ufms.br',
};
const semContato = '2b3c4d5e-6f70-4a81-9b2c-3d4e5f6a7b8c';
const gestor: Contato = {
  id: '9e8d7c6b-5a49-4382-a716-151413121110',
  nome: 'Gestor',
  email: 'gestor@ufms.br',
};

const complemento: Event = {
  id: '0b6f2f0e-6a1c-4c55-9a43-6f1f1b0c9e16',
  type: 'finance.top-up-requested',
  version: 1,
  occurredAt: '2026-11-01T03:00:00Z',
  payload: {
    topUpId: '5c4b3a29-1817-4615-a413-121110090807',
    totalAmountInCents: 1001,
    shares: [
      { participantId: ana.id, amountInCents: 501 },
      { participantId: semContato, amountInCents: 500 },
    ],
  },
};

const usuario = () => {
  const buscados: string[] = [];
  return {
    buscados,
    buscar: async (id: string) => {
      buscados.push(id);
      return id === ana.id ? ana : undefined;
    },
    gestores: async () => {
      buscados.push('gestores');
      return [gestor];
    },
  };
};

const fila = () => {
  const guardados: { eventoId: string; emails: readonly Email[] }[] = [];
  return {
    guardados,
    guardar: async (eventoId: string, emails: readonly Email[]) => {
      guardados.push({ eventoId, emails });
    },
  };
};

describe('avisar', () => {
  it('busca o contato de cada participante, guarda os e-mails e devolve quem ficou sem contato', async () => {
    const { guardados, guardar } = fila();
    const { buscados, buscar, gestores } = usuario();
    const result = await avisar(buscar, gestores, guardar)(complemento);
    expect(result).toEqual({ ok: true, value: { semContato: [semContato], semGestor: false } });
    expect(buscados).toEqual([ana.id, semContato]);
    expect(guardados).toEqual([
      { eventoId: complemento.id, emails: [expect.objectContaining({ para: 'ana@ufms.br' })] },
    ]);
  });

  it('não guarda nada nem busca contatos com payload inválido', async () => {
    const { guardados, guardar } = fila();
    const { buscados, buscar, gestores } = usuario();
    const result = await avisar(buscar, gestores, guardar)({ ...complemento, payload: {} });
    expect(result).toEqual({ ok: false, error: 'payload-invalido' });
    expect(guardados).toEqual([]);
    expect(buscados).toEqual([]);
  });

  it('não busca contatos quando o evento não tem aviso', async () => {
    const { buscados, buscar, gestores } = usuario();
    const valorDaCota = {
      ...complemento,
      type: 'participation.contribution-amount-set',
      payload: { contributionType: 'full', year: 2027, amountInCents: 3000 },
    };
    expect(await avisar(buscar, gestores, fila().guardar)(valorDaCota)).toEqual({
      ok: true,
      value: { semContato: [], semGestor: false },
    });
    expect(buscados).toEqual([]);
  });

  it('falha quando Usuário não responde, para o evento ser tentado de novo', async () => {
    const { guardar } = fila();
    const indisponivel = async () => {
      throw new Error('usuario fora do ar');
    };
    await expect(avisar(indisponivel, indisponivel, guardar)(complemento)).rejects.toThrow(
      'usuario fora do ar',
    );
  });

  it('busca os gestores e quem enviou para avisar o comprovante enviado', async () => {
    const { guardados, guardar } = fila();
    const { buscados, buscar, gestores } = usuario();
    const enviado = {
      ...complemento,
      type: 'finance.receipt-sent',
      payload: { receiptId: semContato, participantId: ana.id, amountInCents: 3000 },
    };
    const result = await avisar(buscar, gestores, guardar)(enviado);
    expect(result).toEqual({ ok: true, value: { semContato: [], semGestor: false } });
    expect(buscados.sort()).toEqual([ana.id, 'gestores'].sort());
    expect(guardados).toEqual([
      {
        eventoId: enviado.id,
        emails: [
          expect.objectContaining({
            para: 'gestor@ufms.br',
            texto: expect.stringContaining('Ana enviou'),
          }),
        ],
      },
    ]);
  });
});
