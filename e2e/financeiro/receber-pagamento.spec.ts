import {
  chamarApi,
  entrarNoFacoffee,
  expect,
  feito,
  irParaReceberPagamento,
  lerApi,
  naTelaDoGestor,
  novoUsuario,
  pedirEntrada,
  png,
  reais,
  receberEmDinheiro,
  semRolagemHorizontal,
  test,
} from '../apoio.ts';

test.describe('RF-FIN-01 Receber pagamento', () => {
  test('RN-FIN-01: só o gestor recebe pagamentos', async ({ browser }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    const { id } = await lerApi<{ id: string }>(participante, '/api/usuario/eu');

    await test.step('Um participante tenta registrar um pagamento: o pedido é recusado', async () => {
      const recebido = await chamarApi(participante, 'POST /api/financeiro/receber-pagamento', {
        participanteId: id,
        valorEmCentavos: 6000,
        forma: 'dinheiro',
      });
      expect(recebido).toMatchObject({ status: 403, corpo: { error: 'sem-permissao' } });
    });
  });

  test('RN-FIN-02: o pagamento por PIX é acompanhado de comprovante; em dinheiro, não', {
    tag: '@celular',
  }, async ({ browser }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
    await pedirEntrada(participante, pessoa.usuario);
    await naTelaDoGestor(gestor, pessoa.nome);

    await test.step(`Gestor recebe R$ 10,00 por PIX de ${pessoa.nome}, com o comprovante`, async () => {
      const recebimento = await irParaReceberPagamento(gestor);
      await recebimento.getByTestId('escolha-do-participante').selectOption({ label: pessoa.nome });
      await recebimento.getByTestId('valor').fill('10');
      await expect(recebimento.getByTestId('forma-pix')).toBeChecked();
      await recebimento.getByTestId('arquivo').setInputFiles(png('pix.png'));
      await semRolagemHorizontal(gestor);
      await recebimento.getByTestId('receber-pagamento').click();
      await feito(gestor);
    });

    await test.step('Em dinheiro, sem comprovante', async () => {
      const recebimento = await irParaReceberPagamento(gestor);
      await recebimento.getByTestId('forma-dinheiro').check();
      await expect(recebimento.getByTestId('arquivo')).toHaveCount(0);
    });
    await receberEmDinheiro(gestor, pessoa.nome, '5,00');

    await test.step('PIX sem comprovante: o pedido é recusado', async () => {
      const { id } = await lerApi<{ id: string }>(participante, '/api/usuario/eu');
      const recebido = await chamarApi(gestor, 'POST /api/financeiro/receber-pagamento', {
        participanteId: id,
        valorEmCentavos: 1000,
        forma: 'pix',
      });
      expect(recebido).toMatchObject({ status: 400, corpo: { error: 'pix-sem-comprovante' } });
    });

    await test.step(`${pessoa.usuario} vê os dois pagamentos: crédito de R$ 15,00`, async () => {
      await participante.reload();
      await expect(participante.getByTestId('credito')).toContainText(reais('15,00'));
    });
  });
});
