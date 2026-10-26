import { describe, expect, it } from 'vitest';
import type { Contato } from '../domain/aviso.js';
import type { Pendente } from '../domain/lembrete.js';
import { lembrarPendentes, type Registrar } from './lembretes.js';

const ana: Contato = {
  id: '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d',
  nome: 'Ana',
  email: 'ana@ufms.br',
};
const semContato = '2b3c4d5e-6f70-4a81-9b2c-3d4e5f6a7b8c';
const pendentes: Pendente[] = [
  { id: ana.id, pendenteEmCentavos: 3000, cota: { mes: '2026-11', valorEmCentavos: 3000 } },
  { id: semContato, pendenteEmCentavos: 3000, cota: { mes: '2026-11', valorEmCentavos: 3000 } },
];
// 10 de novembro, 9h em Campo Grande.
const dia10 = new Date('2026-11-10T13:00:00Z');

const buscarContato = async (id: string) => (id === ana.id ? ana : undefined);

describe('lembrarPendentes', () => {
  it('registra os lembretes do mês, com o e-mail de quem tem contato', async () => {
    const chamadas: Parameters<Registrar>[] = [];
    const registrar: Registrar = async (...args) => {
      chamadas.push(args);
      return args[1].length;
    };
    const lembrar = lembrarPendentes(
      async () => pendentes,
      async () => [{ participanteId: ana.id, tipo: 'cota-devida' }],
      buscarContato,
      registrar,
    );

    expect(await lembrar(dia10)).toEqual({ lembretes: 3, semContato: [semContato] });
    expect(chamadas).toEqual([
      [
        '2026-11',
        [
          {
            participanteId: ana.id,
            tipo: 'lembrete',
            email: expect.objectContaining({ para: 'ana@ufms.br', assunto: 'Lembrete da copa' }),
          },
          { participanteId: semContato, tipo: 'cota-devida', email: undefined },
          { participanteId: semContato, tipo: 'lembrete', email: undefined },
        ],
      ],
    ]);
  });

  it('falha quando Financeiro não responde, sem registrar nada', async () => {
    const lembrar = lembrarPendentes(
      async () => {
        throw new Error('financeiro fora do ar');
      },
      async () => [],
      buscarContato,
      async () => {
        throw new Error('não devia registrar');
      },
    );
    await expect(lembrar(dia10)).rejects.toThrow('financeiro fora do ar');
  });
});
