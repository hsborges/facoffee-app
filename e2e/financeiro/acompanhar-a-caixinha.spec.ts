import {
  emReais,
  entrarNoFacoffee,
  expect,
  lerApi,
  naTelaDoGestor,
  novoUsuario,
  pedirEntrada,
  receberEmDinheiro,
  registrarGasto,
  semRolagemHorizontal,
  type TipoDeGasto,
  test,
} from '../apoio.ts';

type CaixinhaDoAno = {
  readonly recebidoEmCentavos: number;
  readonly gastosPorTipoEmCentavos: Readonly<Record<TipoDeGasto, number>>;
  readonly saldoNoFimEmCentavos: number;
};

const anoEmCampoGrande = () =>
  Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Campo_Grande', year: 'numeric' }).format(
      new Date(),
    ),
  );

const TIPOS_DE_GASTO: readonly TipoDeGasto[] = [
  'cafe',
  'outros-itens',
  'conserto-e-manutencao',
  'reposicao',
];

test.describe('RF-FIN-06 Acompanhar a caixinha', () => {
  test('RN-FIN-32: a caixinha do ano mostra a todos o que entrou, o que saiu por tipo de gasto e o que sobrou, sem a situação de ninguém', {
    tag: '@celular',
  }, async ({ browser }) => {
    // A new gestor, who participates: pays and registers a gasto pago pela caixinha.
    const quemPaga = await novoUsuario({ gestor: true });
    const gestor = await entrarNoFacoffee(browser, quemPaga.usuario, 'participante');
    await pedirEntrada(gestor, quemPaga.usuario);
    await naTelaDoGestor(gestor, quemPaga.nome);
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    const ano = anoEmCampoGrande();
    const antes = await lerApi<CaixinhaDoAno>(participante, `/api/financeiro/caixinha/${ano}`);

    await receberEmDinheiro(gestor, quemPaga.nome, '7,00');
    await registrarGasto(gestor, { tipo: 'reposicao', valor: '3,00', origem: 'caixinha' });

    await test.step(`${pessoa.usuario} vê o resumo do ano`, async () => {
      await participante.goto('/caixinha');
      const caixinha = participante.getByTestId('caixinha-do-ano');
      await expect(caixinha.getByTestId('recebido')).toHaveText(
        emReais(antes.recebidoEmCentavos + 700),
      );
      for (const tipo of TIPOS_DE_GASTO)
        await expect(caixinha.getByTestId(`saiu-${tipo}`)).toHaveText(
          emReais(antes.gastosPorTipoEmCentavos[tipo] + (tipo === 'reposicao' ? 300 : 0)),
        );
      await expect(caixinha.getByTestId('saldo-no-inicio')).toBeVisible();
      await expect(caixinha.getByTestId('saldo-no-fim')).toHaveText(
        emReais(antes.saldoNoFimEmCentavos + 400),
      );
      await semRolagemHorizontal(participante);
    });
    await test.step('Sem ver quem pagou nem quem está pendente', () =>
      expect(participante.getByTestId('conteudo')).not.toContainText(quemPaga.nome));
  });

  test('RN-FIN-33: os gastos do ano anterior, por tipo de gasto, ficam visíveis a todos', {
    tag: '@celular',
  }, async ({ browser }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    await participante.goto('/caixinha');
    await participante.getByTestId('ver-gastos-do-ano-anterior').click();
    const gastos = participante.getByTestId('gastos-do-ano-anterior');
    // A new stack has no gasto in the year before.
    for (const tipo of TIPOS_DE_GASTO)
      await expect(gastos.getByTestId(`gasto-do-ano-anterior-${tipo}`)).toHaveText(emReais(0));
    await expect(gastos.getByTestId('total-do-ano-anterior')).toHaveText(emReais(0));
    await semRolagemHorizontal(participante);
  });
});
