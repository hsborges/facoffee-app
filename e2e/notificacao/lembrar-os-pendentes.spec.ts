import {
  assuntosDosEmails,
  cotas,
  ESPERA,
  entrarNoFacoffee,
  expect,
  garantirValorDaCota,
  iniciarOMes,
  naTelaDoGestor,
  novoUsuario,
  pedirEntrada,
  recarregarAte,
  receberEmDinheiro,
  test,
} from '../apoio.ts';

const COTA_DEVIDA = expect.stringMatching(/^Cota de /);

test.describe('RF-NOT-02 Lembrar os pendentes', () => {
  test('RN-NOT-07: no início do mês, quem fica com a cota pendente é avisado da cota devida; quem tem a cota abatida do crédito, não', async ({
    browser,
  }) => {
    const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
    await garantirValorDaCota(gestor);
    const [pendente, comCredito] = [await novoUsuario(), await novoUsuario()];
    const paginas = [];
    for (const pessoa of [pendente, comCredito]) {
      const page = await entrarNoFacoffee(browser, pessoa.usuario);
      await pedirEntrada(page, pessoa.usuario);
      await naTelaDoGestor(gestor, pessoa.nome);
      paginas.push(page);
    }
    await receberEmDinheiro(gestor, comCredito.nome, '50,00');

    await iniciarOMes();
    await test.step('A cota do mês fica devida para os dois', async () => {
      for (const page of paginas) await recarregarAte(page, cotas(page));
    });
    // The agendador asks Notificação right after *Todo início de mês*, before Financeiro has the
    // cota; the next run avisa it (ADR 0027).
    await iniciarOMes();

    await test.step(`${pendente.email}, pendente, recebe o aviso da cota devida`, () =>
      expect
        .poll(() => assuntosDosEmails(pendente.email), ESPERA)
        .toEqual(expect.arrayContaining([COTA_DEVIDA])));
    await test.step(`${comCredito.email}, com crédito, não recebe`, async () =>
      expect(await assuntosDosEmails(comCredito.email)).not.toEqual(
        expect.arrayContaining([COTA_DEVIDA]),
      ));
  });
});
