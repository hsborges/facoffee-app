import { describe, expect, it } from 'vitest';
import type { ComprovanteEnviado } from '../domain/comprovante-enviado.js';
import type { Event } from '../domain/event.js';
import type { Pagamento } from '../domain/pagamento.js';
import { fail, ok } from '../domain/result.js';
import {
  type ComprovantesEnviados,
  cancelarComprovante,
  confirmarComprovante,
  editarComprovante,
  enviarComprovante,
  listarComprovantesAConfirmar,
  listarMeusComprovantes,
  recusarComprovante,
} from './comprovantes-enviados.js';

const participante = { id: 'participante-1', perfis: ['participante'] };
const outro = { id: 'outro', perfis: ['participante'] };
const gestor = { id: 'gestor-1', perfis: ['participante', 'gestor'] };
const now = new Date('2026-11-10T15:00:00Z');
// Arquivos guardados, by id, with their participante.
const arquivos = new Map([
  ['arquivo-1', participante.id],
  ['arquivo-2', participante.id],
  ['arquivo-do-outro', outro.id],
]);

const inMemory = () => {
  const salvos = new Map<string, ComprovanteEnviado>();
  const pagamentos: Pagamento[] = [];
  const events: Event[] = [];
  const usado = (c: ComprovanteEnviado) =>
    [...salvos.values()].some((s) => s.comprovanteId === c.comprovanteId && s.id !== c.id);
  const aConfirmar = (id: string) => salvos.get(id)?.situacao === 'a-confirmar';
  const repositorio: ComprovantesEnviados = {
    buscar: async (id) => salvos.get(id),
    aConfirmar: async () => [...salvos.values()].filter((c) => c.situacao === 'a-confirmar'),
    doParticipante: async (id) => [...salvos.values()].filter((c) => c.participanteId === id),
    salvar: async (comprovante) => {
      if (usado(comprovante)) return fail('comprovante-ja-usado');
      salvos.set(comprovante.id, comprovante);
      return ok(undefined);
    },
    editar: async (comprovante) => {
      if (!aConfirmar(comprovante.id)) return fail('comprovante-ja-analisado');
      if (usado(comprovante)) return fail('comprovante-ja-usado');
      salvos.set(comprovante.id, comprovante);
      return ok(undefined);
    },
    recusar: async (comprovante) => {
      if (!aConfirmar(comprovante.id)) return fail('comprovante-ja-analisado');
      salvos.set(comprovante.id, comprovante);
      return ok(undefined);
    },
    remover: async (id) => {
      if (!aConfirmar(id)) return fail('comprovante-ja-analisado');
      salvos.delete(id);
      return ok(undefined);
    },
    confirmar: async (comprovante, pagamento, newEvents) => {
      if (!aConfirmar(comprovante.id)) return fail('comprovante-ja-analisado');
      if (salvos.get(comprovante.id)?.comprovanteId !== comprovante.comprovanteId) {
        return fail('comprovante-alterado');
      }
      salvos.set(comprovante.id, comprovante);
      pagamentos.push(pagamento);
      events.push(...newEvents);
      return ok(undefined);
    },
  };
  let n = 0;
  const clock = { now: () => now, newId: () => `id-${++n}` };
  const doParticipante = async (participanteId: string, id: string) =>
    arquivos.get(id) === participanteId;
  return {
    salvos,
    pagamentos,
    events,
    repositorio,
    enviar: enviarComprovante(repositorio, doParticipante, clock),
    editar: editarComprovante(repositorio, doParticipante),
    cancelar: cancelarComprovante(repositorio),
    confirmar: confirmarComprovante(repositorio, clock),
    recusar: recusarComprovante(repositorio),
  };
};

const pedido = { comprovanteId: 'arquivo-1', valorEmCentavos: 3000 };
const confirmacao = (valorConfirmadoEmCentavos: number) => ({
  valorConfirmadoEmCentavos,
  comprovanteId: 'arquivo-1',
});

describe('enviarComprovante', () => {
  it('saves the comprovante a confirmar, without any pagamento', async () => {
    const { salvos, pagamentos, enviar } = inMemory();
    expect(await enviar(participante, pedido)).toEqual({ ok: true, value: 'id-1' });
    expect(salvos.get('id-1')).toEqual({
      id: 'id-1',
      participanteId: participante.id,
      ...pedido,
      enviadoEm: now,
      situacao: 'a-confirmar',
    });
    expect(pagamentos).toEqual([]);
  });

  it('refuses an arquivo not guardado for the participante', async () => {
    const { salvos, enviar } = inMemory();
    for (const comprovanteId of ['arquivo-do-outro', 'nao-existe']) {
      expect(await enviar(participante, { ...pedido, comprovanteId })).toEqual({
        ok: false,
        error: 'comprovante-nao-encontrado',
      });
    }
    expect(salvos.size).toBe(0);
  });

  it('refuses an arquivo already sent', async () => {
    const { enviar } = inMemory();
    await enviar(participante, pedido);
    expect(await enviar(participante, pedido)).toEqual({
      ok: false,
      error: 'comprovante-ja-usado',
    });
  });
});

describe('editarComprovante and cancelarComprovante', () => {
  it('edit valor and arquivo while a confirmar', async () => {
    const { salvos, enviar, editar } = inMemory();
    await enviar(participante, pedido);
    const editado = { comprovanteId: 'arquivo-2', valorEmCentavos: 2500 };
    expect(await editar(participante, 'id-1', editado)).toEqual({ ok: true, value: undefined });
    expect(salvos.get('id-1')).toMatchObject(editado);
  });

  it('refuses an arquivo of someone else and an unknown comprovante', async () => {
    const { enviar, editar, cancelar } = inMemory();
    await enviar(participante, pedido);
    expect(
      await editar(participante, 'id-1', { ...pedido, comprovanteId: 'arquivo-do-outro' }),
    ).toEqual({ ok: false, error: 'comprovante-nao-encontrado' });
    expect(await editar(participante, 'nao-existe', pedido)).toEqual({
      ok: false,
      error: 'comprovante-enviado-nao-encontrado',
    });
    expect(await cancelar(outro, 'id-1')).toEqual({
      ok: false,
      error: 'comprovante-enviado-nao-encontrado',
    });
  });

  it('cancel removes the comprovante a confirmar', async () => {
    const { salvos, enviar, cancelar } = inMemory();
    await enviar(participante, pedido);
    expect(await cancelar(participante, 'id-1')).toEqual({ ok: true, value: undefined });
    expect(salvos.size).toBe(0);
  });

  it('refuses both once the comprovante is confirmado or recusado', async () => {
    const { enviar, editar, cancelar, confirmar, recusar } = inMemory();
    await enviar(participante, pedido);
    await enviar(participante, { ...pedido, comprovanteId: 'arquivo-2' });
    await confirmar(gestor, 'id-1', confirmacao(3000));
    await recusar(gestor, 'id-2', 'Ilegível');
    for (const id of ['id-1', 'id-2']) {
      expect(await editar(participante, id, pedido)).toEqual({
        ok: false,
        error: 'comprovante-ja-analisado',
      });
      expect(await cancelar(participante, id)).toEqual({
        ok: false,
        error: 'comprovante-ja-analisado',
      });
    }
  });
});

describe('confirmarComprovante', () => {
  it('receives the pagamento with the valor confirmado and stores Pagamento recebido', async () => {
    const { salvos, pagamentos, events, enviar, confirmar } = inMemory();
    await enviar(participante, pedido);
    expect(await confirmar(gestor, 'id-1', confirmacao(2000))).toEqual({ ok: true, value: 'id-2' });
    expect(salvos.get('id-1')).toMatchObject({
      situacao: 'confirmado',
      valorConfirmadoEmCentavos: 2000,
    });
    expect(pagamentos).toEqual([
      {
        id: 'id-2',
        participanteId: participante.id,
        valorEmCentavos: 2000,
        forma: 'pix',
        comprovanteId: 'arquivo-1',
        recebidoEm: now,
      },
    ]);
    expect(events).toMatchObject([
      { id: 'id-3', type: 'finance.payment-received', payload: { amountInCents: 2000 } },
    ]);
  });

  it('confirms once only', async () => {
    const { pagamentos, enviar, confirmar, recusar } = inMemory();
    await enviar(participante, pedido);
    await confirmar(gestor, 'id-1', confirmacao(3000));
    expect(await confirmar(gestor, 'id-1', confirmacao(3000))).toEqual({
      ok: false,
      error: 'comprovante-ja-analisado',
    });
    expect(await recusar(gestor, 'id-1', 'Ilegível')).toEqual({
      ok: false,
      error: 'comprovante-ja-analisado',
    });
    expect(pagamentos).toHaveLength(1);
  });

  it('refuses an arquivo the participante changed after the gestor saw it', async () => {
    const { pagamentos, enviar, editar, confirmar } = inMemory();
    await enviar(participante, pedido);
    await editar(participante, 'id-1', { ...pedido, comprovanteId: 'arquivo-2' });
    expect(await confirmar(gestor, 'id-1', confirmacao(3000))).toEqual({
      ok: false,
      error: 'comprovante-alterado',
    });
    expect(pagamentos).toEqual([]);
  });

  it('refuses someone other than the gestor before looking for the comprovante', async () => {
    const { enviar, confirmar, recusar } = inMemory();
    await enviar(participante, pedido);
    for (const id of ['id-1', 'nao-existe']) {
      expect(await confirmar(participante, id, confirmacao(3000))).toEqual({
        ok: false,
        error: 'sem-permissao',
      });
      expect(await recusar(participante, id, 'Ilegível')).toEqual({
        ok: false,
        error: 'sem-permissao',
      });
    }
    expect(await confirmar(gestor, 'nao-existe', confirmacao(3000))).toEqual({
      ok: false,
      error: 'comprovante-enviado-nao-encontrado',
    });
  });
});

describe('recusarComprovante', () => {
  it('keeps the motivo and receives no pagamento', async () => {
    const { salvos, pagamentos, enviar, recusar } = inMemory();
    await enviar(participante, pedido);
    expect(await recusar(gestor, 'id-1', '')).toEqual({ ok: false, error: 'recusa-sem-motivo' });
    expect(await recusar(gestor, 'id-1', 'Ilegível')).toEqual({ ok: true, value: undefined });
    expect(salvos.get('id-1')).toMatchObject({ situacao: 'recusado', motivo: 'Ilegível' });
    expect(pagamentos).toEqual([]);
  });
});

describe('leituras', () => {
  it('gives the gestor only the comprovantes a confirmar, and each participante their own', async () => {
    const { repositorio, enviar, confirmar } = inMemory();
    await enviar(participante, pedido);
    await enviar(participante, { ...pedido, comprovanteId: 'arquivo-2' });
    await confirmar(gestor, 'id-1', confirmacao(3000));

    expect(await listarComprovantesAConfirmar(repositorio.aConfirmar)(gestor)).toMatchObject({
      ok: true,
      value: [{ id: 'id-2' }],
    });
    expect(await listarComprovantesAConfirmar(repositorio.aConfirmar)(participante)).toEqual({
      ok: false,
      error: 'sem-permissao',
    });
    expect(await listarMeusComprovantes(repositorio.doParticipante)(participante)).toHaveLength(2);
    expect(await listarMeusComprovantes(repositorio.doParticipante)(outro)).toEqual([]);
  });
});
