import {
  chamarApi,
  entrarNoFacoffee,
  expect,
  gastoDe,
  lerApi,
  naTelaDoGestor,
  novoUsuario,
  pedirEntrada,
  reembolsar,
  registrarGasto,
  registrarGastoPelaApi,
  saldoDaCaixinha,
  semRolagemHorizontal,
  test,
} from '../apoio.ts';

type Gasto = { readonly id: string; readonly participanteId: string };

test.describe('RF-FIN-04 Registrar gasto e reembolsar', () => {
  test('RN-FIN-24: gasto pago do próprio bolso gera reembolso, e só sai da caixinha no reembolso', {
    tag: '@celular',
  }, async ({ browser }) => {
    // A new gestor, who participates: only who has pedido entrada has gastos.
    const pessoa = await novoUsuario({ gestor: true });
    const gestor = await entrarNoFacoffee(browser, pessoa.usuario, 'participante');
    await pedirEntrada(gestor, pessoa.usuario);
    await naTelaDoGestor(gestor, pessoa.nome);

    let saldo = await saldoDaCaixinha(gestor);
    await registrarGasto(gestor, { tipo: 'cafe', valor: '12,34', origem: 'proprio-bolso' });
    await test.step('O saldo da caixinha continua o mesmo', async () => {
      await expect(gastoDe(gestor, pessoa.nome, '12,34').getByTestId('reembolsar')).toBeVisible();
      expect(await saldoDaCaixinha(gestor)).toBe(saldo);
      await semRolagemHorizontal(gestor);
    });

    await reembolsar(gestor, pessoa.nome, '12,34');
    await test.step('No reembolso, R$ 12,34 saem da caixinha', () =>
      expect.poll(() => saldoDaCaixinha(gestor)).toBe(saldo - 1234));

    saldo = await saldoDaCaixinha(gestor);
    await registrarGasto(gestor, { tipo: 'cafe', valor: '5,00', origem: 'caixinha' });
    await test.step('Pago pela caixinha: sai na hora e não tem reembolso', async () => {
      const gasto = gastoDe(gestor, pessoa.nome, '5,00');
      await expect(gasto).toHaveAttribute('data-origem', 'caixinha');
      await expect(gasto.getByTestId('reembolsar')).toHaveCount(0);
      await expect.poll(() => saldoDaCaixinha(gestor)).toBe(saldo - 500);
    });
  });

  test('RN-FIN-25: só o gestor reembolsa, uma vez por gasto', async ({ browser }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
    await pedirEntrada(participante, pessoa.usuario);
    await naTelaDoGestor(gestor, pessoa.nome);
    expect(await registrarGastoPelaApi(participante, 789)).toBe(201);
    const { id: participanteId } = await lerApi<{ id: string }>(participante, '/api/usuario/eu');
    const gastos = await lerApi<Gasto[]>(gestor, '/api/financeiro/gasto');
    const reembolso = `POST /api/financeiro/gasto/${gastos.find((g) => g.participanteId === participanteId)?.id}/reembolsar`;

    await test.step('Um participante tenta reembolsar: o pedido é recusado', async () => {
      const feito = await chamarApi(participante, reembolso);
      expect(feito).toMatchObject({ status: 403, corpo: { error: 'sem-permissao' } });
    });

    await reembolsar(gestor, pessoa.nome, '7,89');
    await test.step('O segundo reembolso é recusado', async () => {
      const segundo = await chamarApi(gestor, reembolso);
      expect(segundo).toMatchObject({ status: 409, corpo: { error: 'gasto-ja-reembolsado' } });
    });
  });

  test('RN-FIN-26: qualquer participante registra um gasto', async ({ browser }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
    await pedirEntrada(participante, pessoa.usuario);
    await naTelaDoGestor(gestor, pessoa.nome);

    await test.step(`${pessoa.usuario}, participante, registra um gasto de café do próprio bolso`, async () =>
      expect(await registrarGastoPelaApi(participante, 4590)).toBe(201));
    await test.step(`O gasto fica registrado em nome de ${pessoa.nome}`, async () => {
      await gestor.goto('/gastos');
      const gasto = gastoDe(gestor, pessoa.nome, '45,90');
      await expect(gasto).toHaveAttribute('data-tipo', 'cafe');
      await expect(gasto).toHaveAttribute('data-origem', 'proprio-bolso');
      await expect(gasto.getByTestId('reembolsar')).toBeVisible();
    });
  });
});
