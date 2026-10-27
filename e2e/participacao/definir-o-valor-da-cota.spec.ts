import {
  chamarApi,
  entrarNoFacoffee,
  expect,
  feito,
  garantirValorDaCota,
  novoUsuario,
  reais,
  semRolagemHorizontal,
  test,
  VALOR_DA_COTA,
} from '../apoio.ts';

test.describe('RF-PAR-05 Definir o valor da cota', () => {
  // Not @celular: a valor is defined once per year, and both projects share the stack.
  test('RN-PAR-13: só o gestor define o valor da cota', async ({ browser }) => {
    const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
    // Once this year's is defined, the page defines the next year's, defined only here.
    await garantirValorDaCota(gestor);
    const ano = new Date().getFullYear() + 1;

    await test.step(`Gestor define R$ 25,00 e R$ 35,00 para as cotas de ${ano}`, async () => {
      await gestor.goto('/valor-da-cota');
      const definicao = gestor.getByTestId('definicao-do-valor-da-cota');
      await expect(definicao).toHaveAttribute('data-ano', String(ano));
      await definicao.getByTestId('valor-so-cafe').fill('25');
      await definicao.getByTestId('valor-completa').fill('35');
      await semRolagemHorizontal(gestor);
      await definicao.getByTestId('definir-valor-da-cota').click();
      await feito(gestor);
    });

    await test.step('Um participante tenta definir: o pedido é recusado', async () => {
      const pessoa = await novoUsuario();
      const participante = await entrarNoFacoffee(browser, pessoa.usuario);
      const definido = await chamarApi(
        participante,
        'POST /api/participacao/definir-valor-da-cota',
        {
          tipoDeCota: 'so-cafe',
          ano,
          valorEmCentavos: 3000,
        },
      );
      expect(definido).toMatchObject({ status: 403, corpo: { error: 'sem-permissao' } });
    });
  });

  test('RN-PAR-16: todos veem o valor de cada tipo de cota do ano', {
    tag: '@celular',
  }, async ({ browser }) => {
    await garantirValorDaCota(await entrarNoFacoffee(browser, 'gestor', 'gestor'));
    // Not even a participante yet: anyone with access sees it.
    const pessoa = await novoUsuario();
    const page = await entrarNoFacoffee(browser, pessoa.usuario);
    await page.goto('/caixinha');
    const valores = page.getByTestId('valores-da-cota');
    await expect(valores).toHaveAttribute('data-ano', String(new Date().getFullYear()));
    for (const [tipo, valor] of Object.entries(VALOR_DA_COTA))
      await expect(valores.getByTestId(`valor-da-cota-${tipo}`)).toHaveText(reais(valor));
    await semRolagemHorizontal(page);
  });
});
