import { type Aviso, emReais } from './aviso.js';

/** A participante ativo who is pendente, as told by Financeiro, with their most recent cota. */
export type Pendente = {
  readonly id: string;
  readonly pendenteEmCentavos: number;
  readonly cota: { readonly mes: string; readonly valorEmCentavos: number } | null;
};

/** The aviso of the cota devida of the month, or the lembrete of the month (ADR 0027). */
export type TipoDeLembrete = 'cota-devida' | 'lembrete';

/** A lembrete registered for a participante in a month; each one is registered once. */
export type Registro = { readonly participanteId: string; readonly tipo: TipoDeLembrete };

/** A lembrete due now; without `aviso`, it is registered but sends nothing. */
export type Lembrete = Registro & { readonly aviso?: Aviso };

/** From this day of the month on, the pendentes are lembrados. */
export const DIA_DO_LEMBRETE = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const positivo = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

/** Validates the pendentes Financeiro answered; undefined when the answer breaks the format. */
export const pendentesDe = (resposta: unknown): readonly Pendente[] | undefined => {
  const valido =
    Array.isArray(resposta) &&
    resposta.every(
      (p) =>
        typeof p?.id === 'string' &&
        UUID.test(p.id) &&
        positivo(p.pendenteEmCentavos) &&
        (p.cota === null ||
          (typeof p.cota?.mes === 'string' &&
            MES.test(p.cota.mes) &&
            positivo(p.cota.valorEmCentavos))),
    );
  return valido ? resposta : undefined;
};

// Months turn at midnight in Campo Grande, where the copa is (ADR 0015).
const formatoDoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Campo_Grande',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const formatoDoMes = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});

/** The month (`AAAA-MM`) and the day of the month of an instant, in Campo Grande time. */
export const diaEmCampoGrande = (agora: Date): { readonly mes: string; readonly dia: number } => {
  const data = formatoDoDia.format(agora);
  return { mes: data.slice(0, 7), dia: Number(data.slice(8)) };
};

const ACERTAR = 'Quando puder, acerte com o gestor, por PIX ou em dinheiro.';

const avisoDaCota = (id: string, pendenteEmCentavos: number, mes: string, valor: number) => {
  const mesPorExtenso = formatoDoMes.format(new Date(`${mes}-15T00:00:00Z`));
  return {
    participanteId: id,
    assunto: `Cota de ${mesPorExtenso}`,
    texto:
      `A cota de ${mesPorExtenso}, de ${emReais(valor)}, já está devida. ` +
      `Hoje, você tem ${emReais(pendenteEmCentavos)} pendente. ${ACERTAR}`,
  };
};

const lembrete = (id: string, pendenteEmCentavos: number) => ({
  participanteId: id,
  assunto: 'Lembrete da copa',
  texto:
    `Só um lembrete: você tem ${emReais(pendenteEmCentavos)} pendente. ${ACERTAR} ` +
    'Se já acertou, desconsidere este e-mail.',
});

/**
 * The lembretes due on `dia` of `mes`, each to the participante pendente only, and not
 * `registrados` yet in the month. The cota devida is avisada once Financeiro counts the cota of
 * the month and the participante is still pendente: whoever has it abatida from the crédito is not.
 * From the {@link DIA_DO_LEMBRETE} on, each pendente is lembrado once a month; a cota devida
 * avisada that late is already the lembrete of the month, so only one e-mail goes.
 */
export const lembretesDevidos = (
  pendentes: readonly Pendente[],
  mes: string,
  dia: number,
  registrados: readonly Registro[],
): readonly Lembrete[] => {
  const registrado = (participanteId: string, tipo: TipoDeLembrete) =>
    registrados.some((r) => r.participanteId === participanteId && r.tipo === tipo);
  return pendentes.flatMap(({ id, pendenteEmCentavos, cota }): Lembrete[] => {
    const lembrar = dia >= DIA_DO_LEMBRETE && !registrado(id, 'lembrete');
    if (cota?.mes === mes && !registrado(id, 'cota-devida'))
      return [
        {
          participanteId: id,
          tipo: 'cota-devida',
          aviso: avisoDaCota(id, pendenteEmCentavos, mes, cota.valorEmCentavos),
        },
        ...(lembrar ? [{ participanteId: id, tipo: 'lembrete' as const }] : []),
      ];
    return lembrar
      ? [{ participanteId: id, tipo: 'lembrete', aviso: lembrete(id, pendenteEmCentavos) }]
      : [];
  });
};
