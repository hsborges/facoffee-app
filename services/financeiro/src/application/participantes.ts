import type { Event } from '../domain/event.js';
import {
  deverCota,
  entrar,
  type Participante,
  sair,
  type TipoDeCota,
} from '../domain/participante.js';
import { fail, ok, type Result } from '../domain/result.js';

/** Persistence of participantes. */
export type Repository = {
  readonly buscar: (id: string) => Promise<Participante | undefined>;
  /** Saves the participante; cotas already saved are kept as they are. */
  readonly salvar: (participante: Participante) => Promise<void>;
  /** Leitura *Participantes ativos*: ids of who entered and has not left. */
  readonly ativos: () => Promise<readonly string[]>;
};

/** Why an event from Participação was refused. */
export type PayloadInvalido = 'payload-invalido';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const DOS_CONTRATOS: ReadonlyMap<unknown, TipoDeCota> = new Map([
  ['coffee-only', 'so-cafe'],
  ['full', 'completa'],
]);

const participantId = (event: Event) => {
  const id = (event.payload as { participantId?: unknown }).participantId;
  return typeof id === 'string' && UUID.test(id) ? id : undefined;
};

// Bounded by the postgres integer column.
const inteiroPositivo = (valor: unknown): valor is number =>
  Number.isInteger(valor) && (valor as number) > 0 && (valor as number) <= 2_147_483_647;

const atualizar =
  (repository: Repository, mudar: (atual: Participante | undefined, id: string) => Participante) =>
  async (event: Event): Promise<Result<void, PayloadInvalido>> => {
    const id = participantId(event);
    if (!id) return fail('payload-invalido');
    await repository.salvar(mudar(await repository.buscar(id), id));
    return ok(undefined);
  };

/** Handler for *Participante entrou* (`participation.participant-joined.v1`). */
export const registrarEntrada = (repository: Repository) => atualizar(repository, entrar);

/** Handler for *Participante saiu* (`participation.participant-left.v1`). */
export const registrarSaida = (repository: Repository) => atualizar(repository, sair);

/**
 * Handler for *Cota devida* (`participation.contribution-due.v1`). A repeated cota for the same
 * month is ignored. The payload comes from the broker, so it is validated here.
 */
export const registrarCotaDevida =
  (repository: Repository) =>
  async (event: Event): Promise<Result<void, PayloadInvalido>> => {
    const { month, contributionType, amountInCents } = event.payload as Record<string, unknown>;
    const tipoDeCota = DOS_CONTRATOS.get(contributionType);
    const valido =
      typeof month === 'string' && MES.test(month) && tipoDeCota && inteiroPositivo(amountInCents);
    if (!valido) return fail('payload-invalido');
    const cota = { mes: month, tipoDeCota, valorEmCentavos: amountInCents };
    return atualizar(repository, (atual, id) => deverCota(atual, id, cota))(event);
  };
