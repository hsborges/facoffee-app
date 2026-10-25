import { describe, expect, it } from 'vitest';
import {
  type Armazem,
  type Arquivo,
  baixarComprovante,
  baixarNota,
  guardarComprovante,
  guardarNota,
} from './arquivos.js';

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

const emMemoria = () => {
  const arquivos = new Map<string, Arquivo>();
  const armazem: Armazem = {
    guardar: async (chave, arquivo) => {
      arquivos.set(chave, arquivo);
    },
    obter: async (chave) => arquivos.get(chave),
  };
  return { armazem, arquivos };
};

const newId = () => 'arquivo-1';
const gestor = { id: 'gestor-1', perfis: ['participante', 'gestor'] };
const participante = { id: 'participante-1', perfis: ['participante'] };

describe('guardarComprovante', () => {
  it('guarda the comprovante of the participante, sent by the gestor', async () => {
    const { armazem, arquivos } = emMemoria();
    expect(await guardarComprovante(armazem, newId)(gestor, participante.id, PDF)).toEqual({
      ok: true,
      value: 'arquivo-1',
    });
    expect(arquivos.get('comprovante/arquivo-1')).toEqual({
      tipo: 'application/pdf',
      conteudo: PDF,
      participanteId: participante.id,
    });
  });

  it('refuses whoever is not the gestor', async () => {
    const { armazem, arquivos } = emMemoria();
    expect(await guardarComprovante(armazem, newId)(participante, participante.id, PDF)).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
    expect(arquivos.size).toBe(0);
  });

  it('refuses an arquivo of another type', async () => {
    const { armazem } = emMemoria();
    const html = new TextEncoder().encode('<html>');
    expect(await guardarComprovante(armazem, newId)(gestor, participante.id, html)).toEqual({
      ok: false,
      error: 'tipo-nao-aceito',
    });
  });
});

describe('baixarComprovante', () => {
  const guardado = async () => {
    const { armazem } = emMemoria();
    await guardarComprovante(armazem, newId)(gestor, participante.id, PDF);
    return baixarComprovante(armazem);
  };

  it('gives the comprovante to its participante and to the gestor', async () => {
    const baixar = await guardado();
    expect(await baixar(participante, 'arquivo-1')).toMatchObject({ ok: true });
    expect(await baixar(gestor, 'arquivo-1')).toMatchObject({ ok: true });
  });

  it('hides it from other participantes as if it did not exist', async () => {
    const baixar = await guardado();
    const outro = { id: 'outro', perfis: ['participante'] };
    expect(await baixar(outro, 'arquivo-1')).toEqual({ ok: false, error: 'nao-encontrado' });
    expect(await baixar(gestor, 'outro-arquivo')).toEqual({ ok: false, error: 'nao-encontrado' });
  });
});

describe('nota', () => {
  it('is guardada by any participante and seen by all', async () => {
    const { armazem } = emMemoria();
    expect(await guardarNota(armazem, newId)(PDF)).toEqual({ ok: true, value: 'arquivo-1' });
    expect(await baixarNota(armazem)('arquivo-1')).toEqual({
      ok: true,
      value: { tipo: 'application/pdf', conteudo: PDF },
    });
  });

  it('is not found under the comprovantes, nor the other way round', async () => {
    const { armazem } = emMemoria();
    await guardarNota(armazem, newId)(PDF);
    expect(await baixarComprovante(armazem)(gestor, 'arquivo-1')).toEqual({
      ok: false,
      error: 'nao-encontrado',
    });
  });

  it('refuses an empty arquivo', async () => {
    const { armazem } = emMemoria();
    expect(await guardarNota(armazem, newId)(new Uint8Array())).toEqual({
      ok: false,
      error: 'arquivo-vazio',
    });
  });
});
