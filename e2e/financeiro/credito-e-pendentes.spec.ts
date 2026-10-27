import type { Browser, Page } from '@playwright/test';
import {
  chamarApi,
  cotas,
  entrarNoFacoffee,
  expect,
  garantirValorDaCota,
  iniciarOMes,
  naTelaDoGestor,
  novoUsuario,
  pedirEntrada,
  reais,
  recarregarAte,
  receberEmDinheiro,
  semRolagemHorizontal,
  test,
} from '../apoio.ts';

// A new participante of the cota Só café (R$ 20,00), known to Financeiro, and the gestor.
const participanteEGestor = async (browser: Browser) => {
  const pessoa = await novoUsuario();
  const participante = await entrarNoFacoffee(browser, pessoa.usuario);
  const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
  await garantirValorDaCota(gestor);
  await pedirEntrada(participante, pessoa.usuario);
  await naTelaDoGestor(gestor, pessoa.nome);
  return { pessoa, participante, gestor };
};

const deverACota = (participante: Page) =>
  test.step('A cota do mês, de R$ 20,00, fica devida', async () => {
    await iniciarOMes();
    await recarregarAte(participante, cotas(participante));
    await expect(cotas(participante)).toContainText(reais('20,00'));
  });

test.describe('RF-FIN-03 Crédito e pendentes', () => {
  test('RN-FIN-15: o que for pago a mais vira crédito', { tag: '@celular' }, async ({
    browser,
  }) => {
    const { pessoa, participante, gestor } = await participanteEGestor(browser);
    await deverACota(participante);
    await expect(participante.getByTestId('pendente')).toContainText(reais('20,00'));

    await receberEmDinheiro(gestor, pessoa.nome, '25,00');
    await test.step(`${pessoa.usuario} vê o crédito: R$ 5,00`, async () => {
      await participante.reload();
      await expect(participante.getByTestId('credito')).toContainText(reais('5,00'));
      await semRolagemHorizontal(participante);
    });
  });

  test('RN-FIN-16: o crédito abate automaticamente as próximas cotas e complementos', async ({
    browser,
  }) => {
    const { pessoa, participante, gestor } = await participanteEGestor(browser);
    await receberEmDinheiro(gestor, pessoa.nome, '25,00');
    await participante.reload();
    await expect(participante.getByTestId('credito')).toContainText(reais('25,00'));

    await deverACota(participante);
    await test.step('A cota é abatida do crédito: R$ 5,00, sem pendência', async () => {
      await expect(participante.getByTestId('credito')).toContainText(reais('5,00'));
      await expect(participante.getByTestId('pendente')).toHaveCount(0);
    });
  });

  test('RN-FIN-20: cada participante vê só a própria situação', async ({ browser }) => {
    const { participante } = await participanteEGestor(browser);
    await deverACota(participante);
    await test.step('Vê o que está pendente, com as cotas devidas', () =>
      expect(participante.getByTestId('pendente')).toContainText(reais('20,00')));
    await test.step('A situação de todos é recusada', async () => {
      const todos = await chamarApi(participante, 'GET /api/financeiro/participante');
      expect(todos).toMatchObject({ status: 403, corpo: { error: 'sem-permissao' } });
    });
  });
});
