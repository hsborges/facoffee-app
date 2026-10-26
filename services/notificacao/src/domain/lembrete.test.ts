import { describe, expect, it } from 'vitest';
import { diaEmCampoGrande, lembretesDevidos, type Pendente, pendentesDe } from './lembrete.js';

const ana = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';
const bia = '2b3c4d5e-6f70-4a81-9b2c-3d4e5f6a7b8c';

const comCotaDoMes: Pendente = {
  id: ana,
  pendenteEmCentavos: 2500,
  cota: { mes: '2026-11', valorEmCentavos: 3000 },
};
const deAntes: Pendente = {
  id: bia,
  pendenteEmCentavos: 3000,
  cota: { mes: '2026-10', valorEmCentavos: 3000 },
};

// Intl puts a non-breaking space after R$.
const reais = (texto: string | undefined) => texto?.replaceAll('\u00a0', ' ');

describe('diaEmCampoGrande', () => {
  it('vira o mês à meia-noite de Campo Grande, não de UTC', () => {
    expect(diaEmCampoGrande(new Date('2026-11-01T03:59:00Z'))).toEqual({ mes: '2026-10', dia: 31 });
    expect(diaEmCampoGrande(new Date('2026-11-01T04:00:00Z'))).toEqual({ mes: '2026-11', dia: 1 });
  });
});

describe('lembretesDevidos', () => {
  it('no início do mês avisa a cota devida só a quem tem a cota do mês pendente', () => {
    const lembretes = lembretesDevidos([comCotaDoMes, deAntes], '2026-11', 1, []);
    expect(lembretes).toEqual([
      {
        participanteId: ana,
        tipo: 'cota-devida',
        aviso: {
          participanteId: ana,
          assunto: 'Cota de novembro de 2026',
          texto: expect.any(String),
        },
      },
    ]);
    expect(reais(lembretes[0]?.aviso?.texto)).toBe(
      'A cota de novembro de 2026, de R$ 30,00, já está devida. Hoje, você tem R$ 25,00 pendente. ' +
        'Quando puder, acerte com o gestor, por PIX ou em dinheiro.',
    );
  });

  it('a partir do dia 10 lembra cada pendente uma vez no mês, sem expor ninguém', () => {
    const lembretes = lembretesDevidos([comCotaDoMes, deAntes], '2026-11', 10, [
      { participanteId: ana, tipo: 'cota-devida' },
    ]);
    expect(lembretes.map(({ participanteId, tipo }) => [participanteId, tipo])).toEqual([
      [ana, 'lembrete'],
      [bia, 'lembrete'],
    ]);
    expect(lembretes[1]?.aviso?.participanteId).toBe(bia);
    expect(reais(lembretes[1]?.aviso?.texto)).toBe(
      'Só um lembrete: você tem R$ 30,00 pendente. Quando puder, acerte com o gestor, ' +
        'por PIX ou em dinheiro. Se já acertou, desconsidere este e-mail.',
    );
  });

  it('não repete o que já foi registrado no mês', () => {
    const registrados = [
      { participanteId: ana, tipo: 'cota-devida' as const },
      { participanteId: ana, tipo: 'lembrete' as const },
    ];
    expect(lembretesDevidos([comCotaDoMes], '2026-11', 20, registrados)).toEqual([]);
  });

  it('a cota devida avisada a partir do dia 10 já é o lembrete do mês: um e-mail só', () => {
    const lembretes = lembretesDevidos([comCotaDoMes], '2026-11', 15, []);
    expect(lembretes.map(({ tipo, aviso }) => [tipo, aviso?.assunto])).toEqual([
      ['cota-devida', 'Cota de novembro de 2026'],
      ['lembrete', undefined],
    ]);
  });

  it('lembra também quem está pendente sem cota, por um complemento', () => {
    const soComplemento = { id: ana, pendenteEmCentavos: 500, cota: null };
    expect(lembretesDevidos([soComplemento], '2026-11', 1, [])).toEqual([]);
    expect(lembretesDevidos([soComplemento], '2026-11', 10, [])).toMatchObject([
      { participanteId: ana, tipo: 'lembrete' },
    ]);
  });
});

describe('pendentesDe', () => {
  it('aceita a resposta de Financeiro', () => {
    const resposta = [
      { ...comCotaDoMes, cota: { ...comCotaDoMes.cota, tipoDeCota: 'completa' } },
      { id: bia, pendenteEmCentavos: 500, cota: null },
    ];
    expect(pendentesDe(resposta)).toEqual(resposta);
  });

  it.each([
    {},
    [{ id: 'abc', pendenteEmCentavos: 1, cota: null }],
    [{ id: ana, pendenteEmCentavos: 0, cota: null }],
    [{ id: ana, pendenteEmCentavos: 1 }],
    [{ id: ana, pendenteEmCentavos: 1, cota: { mes: 'nov', valorEmCentavos: 1 } }],
  ])('recusa resposta fora do formato: %j', (resposta) => {
    expect(pendentesDe(resposta)).toBeUndefined();
  });
});
