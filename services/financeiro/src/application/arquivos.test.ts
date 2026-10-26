import { describe, expect, it } from 'vitest';
import {
  type Armazem,
  type Arquivo,
  baixarComprovante,
  baixarNota,
  guardarComprovante,
  guardarNota,
  notaDoParticipante,
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
  it('RN-FIN-13: guarda the comprovante of the participante, sent by the gestor', async () => {
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

  it('RN-FIN-13: guarda the comprovante the participante sends for themself', async () => {
    const { armazem, arquivos } = emMemoria();
    expect(await guardarComprovante(armazem, newId)(participante, participante.id, PDF)).toEqual({
      ok: true,
      value: 'arquivo-1',
    });
    expect(arquivos.get('comprovante/arquivo-1')?.participanteId).toBe(participante.id);
  });

  it('RN-FIN-13: refuses a participante guardando for someone else', async () => {
    const { armazem, arquivos } = emMemoria();
    expect(await guardarComprovante(armazem, newId)(participante, gestor.id, PDF)).toEqual({
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

  it('RN-FIN-04: gives the comprovante to its participante and to the gestor', async () => {
    const baixar = await guardado();
    expect(await baixar(participante, 'arquivo-1')).toMatchObject({ ok: true });
    expect(await baixar(gestor, 'arquivo-1')).toMatchObject({ ok: true });
  });

  it('RN-FIN-04: hides it from other participantes as if it did not exist', async () => {
    const baixar = await guardado();
    const outro = { id: 'outro', perfis: ['participante'] };
    expect(await baixar(outro, 'arquivo-1')).toEqual({ ok: false, error: 'nao-encontrado' });
    expect(await baixar(gestor, 'outro-arquivo')).toEqual({ ok: false, error: 'nao-encontrado' });
  });
});

describe('nota', () => {
  it('RN-FIN-23: is guardada by any participante and seen by all', async () => {
    const { armazem } = emMemoria();
    expect(await guardarNota(armazem, newId)(participante, PDF)).toEqual({
      ok: true,
      value: 'arquivo-1',
    });
    expect(await baixarNota(armazem)('arquivo-1')).toEqual({
      ok: true,
      value: { tipo: 'application/pdf', conteudo: PDF, participanteId: participante.id },
    });
  });

  it('RN-FIN-06: is not found under the comprovantes, nor the other way round', async () => {
    const { armazem } = emMemoria();
    await guardarNota(armazem, newId)(participante, PDF);
    expect(await baixarComprovante(armazem)(gestor, 'arquivo-1')).toEqual({
      ok: false,
      error: 'nao-encontrado',
    });
  });

  it('belongs to the participante who guardou it', async () => {
    const { armazem } = emMemoria();
    await guardarNota(armazem, newId)(participante, PDF);
    expect(await notaDoParticipante(armazem)(participante.id, 'arquivo-1')).toBe(true);
    expect(await notaDoParticipante(armazem)(gestor.id, 'arquivo-1')).toBe(false);
    expect(await notaDoParticipante(armazem)(participante.id, 'nao-existe')).toBe(false);
  });

  it('refuses an empty arquivo', async () => {
    const { armazem } = emMemoria();
    expect(await guardarNota(armazem, newId)(participante, new Uint8Array())).toEqual({
      ok: false,
      error: 'arquivo-vazio',
    });
  });
});
