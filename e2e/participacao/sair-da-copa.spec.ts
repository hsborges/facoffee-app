import {
  chamarApi,
  entrarNoFacoffee,
  expect,
  feito,
  linhaDe,
  naTelaDoGestor,
  novoUsuario,
  pedirEntrada,
  pedirSaida,
  test,
} from '../apoio.ts';

test.describe('RF-PAR-03 Sair da copa', () => {
  test('RN-PAR-07: deixa de participar quem pede a saída', async ({ browser }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
    await pedirEntrada(participante, pessoa.usuario);
    await naTelaDoGestor(gestor, pessoa.nome);

    await pedirSaida(participante, pessoa.usuario);
    await naTelaDoGestor(gestor, pessoa.nome, 'saiu');

    await test.step('Quem não participa não sai', async () => {
      const saida = await chamarApi(participante, 'POST /api/participacao/sair');
      expect(saida).toMatchObject({ status: 409, corpo: { error: 'nao-participando' } });
    });
  });

  test('RN-PAR-08: o acesso desativado encerra a participação', async ({ browser }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
    await pedirEntrada(participante, pessoa.usuario);
    await naTelaDoGestor(gestor, pessoa.nome);

    await test.step(`Gestor desativa o acesso de ${pessoa.nome}`, async () => {
      await linhaDe(gestor, pessoa.nome).getByTestId('desativar-acesso').click();
      await feito(gestor);
    });
    await naTelaDoGestor(gestor, pessoa.nome, 'saiu');
    await expect(linhaDe(gestor, pessoa.nome)).toHaveAttribute('data-acesso', 'desativado');
  });
});
