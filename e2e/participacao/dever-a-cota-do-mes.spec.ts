import {
  cotas,
  entrarNoFacoffee,
  expect,
  garantirValorDaCota,
  iniciarOMes,
  lerApi,
  naTelaDoGestor,
  novoUsuario,
  pedirEntrada,
  pedirSaida,
  reais,
  recarregarAte,
  type Situacao,
  test,
  VALOR_DA_COTA,
} from '../apoio.ts';

test.describe('RF-PAR-04 Dever a cota do mês', () => {
  test('RN-PAR-09: a cota é devida todo início de mês enquanto a pessoa participa', async ({
    browser,
  }) => {
    const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
    await garantirValorDaCota(gestor);
    const quemParticipa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, quemParticipa.usuario);
    await pedirEntrada(participante, quemParticipa.usuario);
    await naTelaDoGestor(gestor, quemParticipa.nome);

    const quemSaiu = await novoUsuario();
    const saiu = await entrarNoFacoffee(browser, quemSaiu.usuario);
    await pedirEntrada(saiu, quemSaiu.usuario);
    await pedirSaida(saiu, quemSaiu.usuario);
    await naTelaDoGestor(gestor, quemSaiu.nome, 'saiu');

    await iniciarOMes();
    await test.step(`${quemParticipa.usuario}, que participa, deve a cota do mês`, async () => {
      await recarregarAte(participante, cotas(participante));
      await expect(cotas(participante)).toHaveCount(1);
    });
    await test.step(`${quemSaiu.usuario}, que saiu, não deve`, async () => {
      expect((await lerApi<Situacao>(saiu, '/api/financeiro/participante/eu')).cotas).toEqual([]);
      await saiu.reload();
      await expect(saiu.getByTestId('em-dia')).toBeVisible();
      await expect(cotas(saiu)).toHaveCount(0);
    });
  });

  test('RN-PAR-11: o valor da cota é o do tipo de cota do participante, conforme o valor do ano', async ({
    browser,
  }) => {
    const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
    await garantirValorDaCota(gestor);
    const participantes = [];
    for (const tipo of ['so-cafe', 'completa'] as const) {
      const pessoa = await novoUsuario();
      const page = await entrarNoFacoffee(browser, pessoa.usuario);
      await pedirEntrada(page, pessoa.usuario, tipo);
      await naTelaDoGestor(gestor, pessoa.nome);
      participantes.push({ page, tipo });
    }

    await iniciarOMes();
    for (const { page, tipo } of participantes)
      await test.step(`Quem é ${tipo} deve R$ ${VALOR_DA_COTA[tipo]}, a cota de ${tipo}`, async () => {
        await recarregarAte(page, cotas(page));
        await expect(cotas(page)).toHaveAttribute('data-tipo-de-cota', tipo);
        await expect(cotas(page)).toContainText(reais(VALOR_DA_COTA[tipo]));
      });
  });
});
