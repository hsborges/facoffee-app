import { describe, expect, it } from 'vitest';
import {
  dataEmCampoGrande,
  emCentavos,
  emReais,
  iniciais,
  mascaraDeReais,
  mesEmCampoGrande,
  mesPorExtenso,
  nomeDe,
  nomeDoMes,
  outroMes,
  primeiroNome,
} from './formato';

describe('iniciais', () => {
  it('takes the first and the last name', () => {
    expect(iniciais('ana maria de souza')).toBe('AS');
    expect(iniciais('  Bruno  ')).toBe('B');
    expect(iniciais('')).toBe('');
  });
});

describe('nomeDe', () => {
  it('is the nome of the usuário, or the e-mail when the nome is empty', () => {
    expect(nomeDe({ nome: 'Ana Souza', email: 'ana@ufms.br' })).toBe('Ana Souza');
    expect(nomeDe({ nome: '', email: 'ana@ufms.br' })).toBe('ana@ufms.br');
  });
});

describe('primeiroNome', () => {
  it('takes the first name, ignoring spaces around it', () => {
    expect(primeiroNome('Ana Maria Souza')).toBe('Ana');
    expect(primeiroNome('  Bruno ')).toBe('Bruno');
    expect(primeiroNome('ana@ufms.br')).toBe('ana@ufms.br');
  });
});

describe('emReais', () => {
  it('shows centavos as reais', () => {
    expect(emReais(3000)).toBe('R$\u00a030,00');
    expect(emReais(123456)).toBe('R$\u00a01.234,56');
    expect(emReais(-1500)).toBe('-R$\u00a015,00');
  });
});

describe('emCentavos', () => {
  it('reads a valor field as centavos: its digits, the last two the centavos', () => {
    expect(emCentavos('R$\u00a030,00')).toBe(3000);
    expect(emCentavos('R$\u00a01.234,56')).toBe(123456);
    expect(emCentavos('45,90')).toBe(4590);
    expect(emCentavos('')).toBe(0);
  });
});

describe('mascaraDeReais', () => {
  it('fills the valor from the centavos as the digits are typed', () => {
    expect(['4', '45', '459', '4590'].map(mascaraDeReais)).toEqual([
      'R$\u00a00,04',
      'R$\u00a00,45',
      'R$\u00a04,59',
      'R$\u00a045,90',
    ]);
  });

  it('takes the valor typed or pasted with separators, and leaves out what is not a digit', () => {
    expect(mascaraDeReais('30,00')).toBe('R$\u00a030,00');
    expect(mascaraDeReais('1.234,56')).toBe('R$\u00a01.234,56');
    expect(mascaraDeReais('R$ 12a3')).toBe('R$\u00a01,23');
  });

  it('erases back from the centavos', () => {
    expect(mascaraDeReais('R$\u00a030,0')).toBe('R$\u00a03,00');
  });

  it('is empty without a valor, so a required field asks for one', () => {
    expect(mascaraDeReais('')).toBe('');
    expect(mascaraDeReais('R$\u00a00,0')).toBe('');
    expect(mascaraDeReais('abc')).toBe('');
  });

  it('stops at the most the API takes', () => {
    expect(mascaraDeReais('99999999999')).toBe('R$\u00a021.474.836,47');
  });
});

describe('mesPorExtenso', () => {
  it('shows an AAAA-MM month by name, whatever the browser time zone', () => {
    expect(mesPorExtenso('2026-01')).toBe('janeiro de 2026');
    expect(mesPorExtenso('2026-12')).toBe('dezembro de 2026');
  });
});

describe('dataEmCampoGrande', () => {
  it('shows the day in Campo Grande, where the copa is', () => {
    expect(dataEmCampoGrande('2026-11-21T02:00:00.000Z')).toBe('20/11/2026');
  });
});

describe('mesEmCampoGrande', () => {
  it('RNF-03: turns the month at midnight in Campo Grande, not in UTC', () => {
    expect(mesEmCampoGrande(new Date('2026-11-01T03:59:59Z'))).toBe('2026-10');
    expect(mesEmCampoGrande(new Date('2026-11-01T04:00:00Z'))).toBe('2026-11');
  });
});

describe('nomeDoMes', () => {
  it('names only the month of an AAAA-MM', () => {
    expect(nomeDoMes('2026-10')).toBe('outubro');
  });
});

describe('outroMes', () => {
  it('moves an AAAA-MM month back and forth, across years', () => {
    expect(outroMes('2026-10', 1)).toBe('2026-11');
    expect(outroMes('2026-12', 1)).toBe('2027-01');
    expect(outroMes('2026-01', -1)).toBe('2025-12');
  });
});
