import { randomUUID } from 'node:crypto';
import {
  confirmacaoAberta,
  entrarNoFacoffee,
  expect,
  naTelaDoGestor,
  novoUsuario,
  pagina,
  pedirEntrada,
  pedirSaida,
  registrarGasto,
  semRolagemHorizontal,
  test,
} from './apoio.ts';

test.describe('Não funcionais', () => {
  test('RNF-01: mobile first, nenhuma tela rola na horizontal a 320 px', {
    tag: '@celular',
  }, async ({ browser }) => {
    // A new gestor per run, whose name has a word wider than 320 px: in the topo and the tables.
    const pessoa = await novoUsuario({
      sobrenome: `Wolfeschlegelsteinhausenbergerdorff${randomUUID().slice(0, 4)}`,
      gestor: true,
    });
    const gestor = await entrarNoFacoffee(browser, pessoa.usuario, 'participante');
    // Only who has pedido entrada has gastos.
    await pedirEntrada(gestor, pessoa.usuario);
    await naTelaDoGestor(gestor, pessoa.nome);
    await registrarGasto(gestor, { tipo: 'cafe', valor: '12,34', origem: 'proprio-bolso' });

    for (const [caminho, id] of [
      ['/', 'minha-situacao'],
      ['/enviar-comprovante', 'enviar-comprovante'],
      ['/desativar-meu-acesso', 'desativar-meu-acesso'],
      ['/caixinha', 'caixinha'],
      ['/caixinha/registrar-gasto', 'registrar-gasto'],
      ['/participantes', 'participantes'],
      ['/participantes/conferir-comprovante', 'conferir-comprovante'],
      ['/participantes/receber-pagamento', 'receber-pagamento'],
      ['/gastos', 'gastos'],
      ['/gastos/registrar-gasto', 'registrar-gasto'],
      ['/gastos/solicitar-complemento', 'solicitar-complemento'],
      ['/valor-da-cota', 'valor-da-cota'],
    ] as const)
      await test.step(`${caminho} não rola na horizontal`, async () => {
        await gestor.goto(caminho);
        await expect(pagina(gestor, id)).toBeVisible();
        await expect(gestor.getByTestId('carregando')).toHaveCount(0);
        await semRolagemHorizontal(gestor);
      });
  });

  test('RNF-12: ação crítica pede confirmação', { tag: '@celular' }, async ({ browser }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    await pedirEntrada(participante, pessoa.usuario);

    await test.step('Voltar ou Esc fecham a confirmação sem pedir a saída', async () => {
      const confirmacao = confirmacaoAberta(participante);
      await participante.getByTestId('pedir-saida').click();
      // The focus starts on Voltar: Enter does not confirm by accident.
      await expect(confirmacao.getByTestId('voltar')).toBeFocused();
      await confirmacao.getByTestId('voltar').click();
      await expect(confirmacao).toHaveCount(0);
      await participante.getByTestId('pedir-saida').click();
      await expect(confirmacao).toBeVisible();
      await participante.keyboard.press('Escape');
      await expect(confirmacao).toHaveCount(0);
      await participante.reload();
      await expect(participante.getByTestId('participando')).toBeVisible();
    });

    // Confirmed, the action is done.
    await pedirSaida(participante, pessoa.usuario);
  });
});
