import { mesDe } from '../domain/calendario.js';
import type { Event } from '../domain/event.js';
import {
  type EntrarErro,
  entrar,
  type NaoParticipando,
  type Participante,
  participanteNoMes,
  sair,
  type TipoDeCota,
  trocarTipoDeCota,
} from '../domain/participante.js';
import { fail, ok, type Result } from '../domain/result.js';

/** Persistence of participantes. */
export type Repository = {
  readonly buscar: (id: string) => Promise<Participante | undefined>;
  /** Everyone who ever participated, whoever left included. */
  readonly listar: () => Promise<readonly Participante[]>;
  /**
   * Persists the entrada and its events (outbox) in the same transaction, unless the person is
   * already participando; resolves `false` then, without saving anything.
   */
  readonly salvarEntrada: (
    participante: Participante,
    events: readonly Event[],
  ) => Promise<boolean>;
  /** Persists a troca de tipo de cota, unless the person left meanwhile; resolves `false` then. */
  readonly salvarTroca: (participante: Participante) => Promise<boolean>;
  /**
   * Persists the saída and its events (outbox) in the same transaction, unless the person already
   * left; resolves `false` then, without saving anything.
   */
  readonly salvarSaida: (participante: Participante, events: readonly Event[]) => Promise<boolean>;
};

/** Source of time and ids, kept out of the domain so tests are deterministic. */
export type Clock = { readonly now: () => Date; readonly newId: () => string };

/** Use case: *Pedir entrada e escolher tipo de cota*; stores *Participante entrou* in the outbox. */
export const pedirEntrada =
  (repository: Repository, clock: Clock) =>
  async (id: string, tipoDeCota: TipoDeCota): Promise<Result<void, EntrarErro>> => {
    const result = entrar(
      await repository.buscar(id),
      { id, tipoDeCota },
      { eventId: clock.newId(), agora: clock.now() },
    );
    if (!result.ok) return result;
    const salvo = await repository.salvarEntrada(result.value.participante, [result.value.evento]);
    return salvo ? ok(undefined) : fail('ja-participando');
  };

/** Use case: *Trocar tipo de cota*, from the next month on; publishes nothing. */
export const trocarTipo =
  (repository: Repository, clock: Clock) =>
  async (id: string, tipoDeCota: TipoDeCota): Promise<Result<void, NaoParticipando>> => {
    const result = trocarTipoDeCota(await repository.buscar(id), tipoDeCota, clock.now());
    if (!result.ok) return result;
    return (await repository.salvarTroca(result.value)) ? ok(undefined) : fail('nao-participando');
  };

/** Use case: *Pedir saída*; stores *Participante saiu* in the outbox. */
export const pedirSaida =
  (repository: Repository, clock: Clock) =>
  async (id: string): Promise<Result<void, NaoParticipando>> => {
    const result = sair(await repository.buscar(id), {
      eventId: clock.newId(),
      agora: clock.now(),
    });
    if (!result.ok) return result;
    const salvo = await repository.salvarSaida(result.value.participante, [result.value.evento]);
    return salvo ? ok(undefined) : fail('nao-participando');
  };

/**
 * Leitura of the logged-in person's participação: the tipo de cota in effect now and the troca
 * still waiting, if any.
 */
export const consultarParticipante =
  (repository: Pick<Repository, 'buscar'>, clock: Pick<Clock, 'now'>) =>
  async (id: string): Promise<Result<Participante, 'participante-nao-encontrado'>> => {
    const participante = await repository.buscar(id);
    return participante
      ? ok(participanteNoMes(participante, mesDe(clock.now())))
      : fail('participante-nao-encontrado');
  };

/**
 * Leitura *Participantes*, only for the gestor: everyone who ever participated, with the tipo de
 * cota in effect now and the troca still waiting, if any.
 */
export const listarParticipantes =
  (repository: Pick<Repository, 'listar'>, clock: Pick<Clock, 'now'>) =>
  async (solicitante: {
    readonly perfis: readonly string[];
  }): Promise<Result<readonly Participante[], 'sem-permissao'>> => {
    if (!solicitante.perfis.includes('gestor')) return fail('sem-permissao');
    const mes = mesDe(clock.now());
    return ok((await repository.listar()).map((p) => participanteNoMes(p, mes)));
  };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Handler for *Usuário desativado* (`user.user-deactivated.v1`): translates it into a saída, so
 * *Participante saiu* is stored in the outbox. Whoever is not participando is ignored.
 * The payload comes from the broker, so it is validated here.
 */
export const encerrarAoDesativarAcesso =
  (repository: Repository, clock: Clock) =>
  async (event: Event): Promise<Result<void, 'payload-invalido'>> => {
    const id = (event.payload as { userId?: unknown }).userId;
    if (typeof id !== 'string' || !UUID.test(id)) return fail('payload-invalido');
    await pedirSaida(repository, clock)(id);
    return ok(undefined);
  };
