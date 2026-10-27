import type { Page } from '@playwright/test';
import {
  entrarNoFacoffee,
  expect,
  feito,
  lerApi,
  naTelaDoGestor,
  novoUsuario,
  pedirEntrada,
  reais,
  type Situacao,
  test,
} from '../apoio.ts';

// Leitura *Crédito e pendentes* of every participante, by id, with the gestor's session. The page
// lists only who is a usuário, so it cannot tell who Financeiro counts as ativo.
const creditoEPendentes = async (gestor: Page) =>
  new Map((await lerApi<Situacao[]>(gestor, '/api/financeiro/participante')).map((s) => [s.id, s]));

const saldo = (s?: Situacao) => (s ? s.creditoEmCentavos - s.pendenteEmCentavos : Number.NaN);

test.describe('RF-FIN-05 Solicitar complemento', () => {
  test('RN-FIN-28: o complemento é dividido em partes iguais entre os participantes ativos', async ({
    browser,
  }) => {
    const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
    const participantes: Page[] = [];
    for (const pessoa of [await novoUsuario(), await novoUsuario()]) {
      const participante = await entrarNoFacoffee(browser, pessoa.usuario);
      await pedirEntrada(participante, pessoa.usuario);
      await naTelaDoGestor(gestor, pessoa.nome);
      participantes.push(participante);
    }

    const antes = await creditoEPendentes(gestor);
    const ativos = [...antes.values()].filter((s) => s.ativo).length;
    const parte = 150;
    const total = ((parte * ativos) / 100).toFixed(2);
    await test.step(`Gestor solicita complemento de R$ ${total} para ${ativos} ativos`, async () => {
      await gestor.goto('/gastos');
      const complemento = gestor.getByTestId('complemento');
      await complemento.getByTestId('valor').fill(total);
      await complemento.getByTestId('solicitar-complemento').click();
      await feito(complemento);
    });

    await test.step(`Cada um dos ${ativos} ativos deve R$ 1,50 a mais, e os inativos nada`, async () => {
      const depois = await creditoEPendentes(gestor);
      for (const [id, situacao] of antes) {
        expect(saldo(depois.get(id)), id).toBe(saldo(situacao) - (situacao.ativo ? parte : 0));
      }
    });
    await test.step('Os novos participantes veem a parte de R$ 1,50', async () => {
      for (const participante of participantes) {
        await participante.reload();
        await expect(participante.getByTestId('complemento')).toContainText(reais('1,50'));
      }
    });
  });
});
