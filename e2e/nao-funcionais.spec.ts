import { randomUUID } from 'node:crypto';
import {
  entrarNoFacoffee,
  expect,
  naTelaDoGestor,
  novoUsuario,
  pagina,
  pedirEntrada,
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
      ['/caixinha', 'caixinha'],
      ['/participantes', 'participantes'],
      ['/gastos', 'gastos'],
      ['/valor-da-cota', 'valor-da-cota'],
    ] as const)
      await test.step(`${caminho} não rola na horizontal`, async () => {
        await gestor.goto(caminho);
        await expect(pagina(gestor, id)).toBeVisible();
        await expect(gestor.getByTestId('carregando')).toHaveCount(0);
        await semRolagemHorizontal(gestor);
      });
  });
});
