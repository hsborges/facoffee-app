import { describe, expect, it } from 'vitest';
import { podeGuardarComprovante, podeVerComprovante, TAMANHO_MAXIMO, validar } from './arquivo.js';

const bytes = (...inicio: number[]) => new Uint8Array([...inicio, 0, 0, 0]);

describe('validar', () => {
  it('accepts PDF, JPEG and PNG by their content, not by what the client says', () => {
    expect(validar(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toEqual({
      ok: true,
      value: 'application/pdf',
    });
    expect(validar(bytes(0xff, 0xd8, 0xff))).toEqual({ ok: true, value: 'image/jpeg' });
    expect(validar(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toEqual({
      ok: true,
      value: 'image/png',
    });
  });

  it('refuses any other type', () => {
    expect(validar(new TextEncoder().encode('<html>'))).toEqual({
      ok: false,
      error: 'tipo-nao-aceito',
    });
  });

  it('refuses an empty arquivo', () => {
    expect(validar(new Uint8Array())).toEqual({ ok: false, error: 'arquivo-vazio' });
  });

  it('accepts up to 5 MB', () => {
    const limite = new Uint8Array(TAMANHO_MAXIMO);
    limite.set([0xff, 0xd8, 0xff]);
    expect(TAMANHO_MAXIMO).toBe(5 * 1024 * 1024);
    expect(validar(limite).ok).toBe(true);
    expect(validar(new Uint8Array(TAMANHO_MAXIMO + 1))).toEqual({
      ok: false,
      error: 'arquivo-grande-demais',
    });
  });
});

describe('comprovante', () => {
  const participanteId = 'participante-1';

  it('is guardado by the gestor for anyone, and by the participante only for themself', () => {
    const gestor = { id: 'gestor-1', perfis: ['participante', 'gestor'] };
    expect(podeGuardarComprovante(gestor, participanteId)).toBe(true);
    expect(podeGuardarComprovante({ id: participanteId, perfis: [] }, participanteId)).toBe(true);
    expect(podeGuardarComprovante({ id: 'outro', perfis: ['participante'] }, participanteId)).toBe(
      false,
    );
  });

  it('is seen by its participante and by the gestor only', () => {
    expect(podeVerComprovante({ id: participanteId, perfis: [] }, participanteId)).toBe(true);
    expect(podeVerComprovante({ id: 'gestor-1', perfis: ['gestor'] }, participanteId)).toBe(true);
    expect(podeVerComprovante({ id: 'outro', perfis: ['participante'] }, participanteId)).toBe(
      false,
    );
  });
});
