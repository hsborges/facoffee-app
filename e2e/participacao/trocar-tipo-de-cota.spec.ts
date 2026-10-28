import {
  chamarApi,
  comDados,
  confirmarAcao,
  cotas,
  entrarNoFacoffee,
  expect,
  garantirValorDaCota,
  iniciarOMes,
  naTelaDoGestor,
  novoUsuario,
  participando,
  pedirEntrada,
  pedirSaida,
  reais,
  recarregarAte,
  semRolagemHorizontal,
  type TipoDeCota,
  test,
  VALOR_DA_COTA,
} from '../apoio.ts';

test.describe('RF-PAR-02 Trocar tipo de cota', () => {
  test('RN-PAR-05: a troca de tipo só vale a partir do mês seguinte', {
    tag: '@celular',
  }, async ({ browser }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
    await garantirValorDaCota(gestor);
    await pedirEntrada(participante, pessoa.usuario, 'so-cafe');
    await naTelaDoGestor(gestor, pessoa.nome);

    const trocaParaCompleta = comDados(participante, 'troca-de-tipo-de-cota', {
      'tipo-de-cota': 'completa',
    });
    // The button trocar-tipo-de-cota offers the other tipo de cota, and asks for confirmação (RNF-12).
    const trocar = (tipo: TipoDeCota) =>
      test.step(`${pessoa.usuario} troca para ${tipo}`, async () => {
        await participante.getByTestId('trocar-tipo-de-cota').click();
        await confirmarAcao(participante);
      });

    await trocar('completa');
    await test.step('A troca espera o mês seguinte', async () => {
      await expect(trocaParaCompleta).toBeVisible();
      await expect(participando(participante, 'so-cafe')).toBeVisible();
      await semRolagemHorizontal(participante);
    });

    await iniciarOMes();
    await test.step('A cota deste mês é de Só café', async () => {
      await recarregarAte(participante, cotas(participante));
      await expect(cotas(participante)).toHaveCount(1);
      await expect(cotas(participante)).toHaveAttribute('data-tipo-de-cota', 'so-cafe');
      await expect(cotas(participante)).toContainText(reais(VALOR_DA_COTA['so-cafe']));
    });

    await test.step('Pedir o tipo atual cancela a troca que espera', async () => {
      await trocar('so-cafe');
      await expect(trocaParaCompleta).toHaveCount(0);
      await participante.reload();
      await expect(participando(participante, 'so-cafe')).toBeVisible();
      await expect(participante.getByTestId('troca-de-tipo-de-cota')).toHaveCount(0);
    });
  });

  test('RN-PAR-06: só quem participa troca de tipo', async ({ browser }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    await pedirEntrada(participante, pessoa.usuario);
    await pedirSaida(participante, pessoa.usuario);

    await test.step('Quem saiu não vê a troca, e o pedido é recusado', async () => {
      await expect(participante.getByTestId('trocar-tipo-de-cota')).toHaveCount(0);
      const troca = await chamarApi(participante, 'POST /api/participacao/trocar-tipo-de-cota', {
        tipoDeCota: 'completa',
      });
      expect(troca).toMatchObject({ status: 409, corpo: { error: 'nao-participando' } });
    });
  });
});
