import {
  chamarApi,
  entrarNoFacoffee,
  expect,
  naTelaDoGestor,
  novoUsuario,
  participando,
  pedirEntrada,
  pedirSaida,
  semRolagemHorizontal,
  test,
} from '../apoio.ts';

test.describe('RF-PAR-01 Entrar na copa', () => {
  test('RN-PAR-01: quem entra escolhe um tipo de cota', { tag: '@celular' }, async ({
    browser,
  }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    await expect(participante.getByTestId('nao-participa')).toBeVisible();
    await semRolagemHorizontal(participante);
    await pedirEntrada(participante, pessoa.usuario, 'completa');
    await semRolagemHorizontal(participante);
    await naTelaDoGestor(await entrarNoFacoffee(browser, 'gestor', 'gestor'), pessoa.nome);
  });

  test('RN-PAR-02: quem já participa não entra de novo', async ({ browser }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    await pedirEntrada(participante, pessoa.usuario);

    await test.step('A página não oferece mais a entrada', () =>
      expect(participante.getByTestId('pedir-entrada')).toHaveCount(0));
    await test.step('O pedido de entrada repetido é recusado', async () => {
      const repetido = await chamarApi(participante, 'POST /api/participacao/entrar', {
        tipoDeCota: 'completa',
      });
      expect(repetido).toMatchObject({ status: 409, corpo: { error: 'ja-participando' } });
      await participante.reload();
      await expect(participando(participante, 'so-cafe')).toBeVisible();
    });
  });

  test('RN-PAR-03: retornar é entrar de novo, com qualquer tipo de cota', async ({ browser }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
    await pedirEntrada(participante, pessoa.usuario, 'completa');
    await pedirSaida(participante, pessoa.usuario);
    await naTelaDoGestor(gestor, pessoa.nome, 'saiu');

    await pedirEntrada(participante, pessoa.usuario, 'so-cafe');
    await naTelaDoGestor(gestor, pessoa.nome);
  });
});
