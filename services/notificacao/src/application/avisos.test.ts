import { describe, expect, it } from 'vitest';
import type { Contato, Email } from '../domain/aviso.js';
import type { Event } from '../domain/event.js';
import { avisar } from './avisos.js';

const ana: Contato = {
  id: '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d',
  nome: 'Ana',
  email: 'ana@ufms.br',
  desativado: false,
};
const semContato = '2b3c4d5e-6f70-4a81-9b2c-3d4e5f6a7b8c';

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
  it('guarda os e-mails do evento e devolve quem ficou sem contato', async () => {
    const { guardados, guardar } = fila();
    const result = await avisar(async () => [ana], guardar)(complemento);
    expect(result).toEqual({ ok: true, value: [semContato] });
    expect(guardados).toEqual([
      { eventoId: complemento.id, emails: [expect.objectContaining({ para: 'ana@ufms.br' })] },
    ]);
  });

  it('não guarda nada nem busca contatos com payload inválido', async () => {
    const { guardados, guardar } = fila();
    let buscas = 0;
    const buscar = async () => {
      buscas += 1;
      return [ana];
    };
    const result = await avisar(buscar, guardar)({ ...complemento, payload: {} });
    expect(result).toEqual({ ok: false, error: 'payload-invalido' });
    expect(guardados).toEqual([]);
    expect(buscas).toBe(0);
  });

  it('falha quando os contatos não estão disponíveis, para o evento ser tentado de novo', async () => {
    const { guardar } = fila();
    const indisponivel = async () => {
      throw new Error('usuario fora do ar');
    };
    await expect(avisar(indisponivel, guardar)(complemento)).rejects.toThrow('usuario fora do ar');
  });
});
