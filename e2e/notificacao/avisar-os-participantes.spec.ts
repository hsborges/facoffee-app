import type { Browser } from '@playwright/test';
import {
  assuntosDosEmails,
  conferirComprovantes,
  confirmarComprovante,
  ESPERA,
  entrarNoFacoffee,
  enviarComprovante,
  expect,
  naTelaDoGestor,
  novoUsuario,
  pedirEntrada,
  receberEmDinheiro,
  recusarComprovante,
  reembolsar,
  registrarGastoPelaApi,
  test,
} from '../apoio.ts';

// A new participante, known to Financeiro, and the gestor.
const participanteEGestor = async (browser: Browser) => {
  const pessoa = await novoUsuario();
  const participante = await entrarNoFacoffee(browser, pessoa.usuario);
  const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
  await pedirEntrada(participante, pessoa.usuario);
  await naTelaDoGestor(gestor, pessoa.nome);
  return { pessoa, participante, gestor };
};

const chega = (email: string, assunto: string, ...textos: readonly string[]) =>
  test.step(`E-mail "${assunto}" chega a ${email} com ${textos.join(' e ')}`, () =>
    expect.poll(() => assuntosDosEmails(email, ...textos), ESPERA).toContain(assunto));

test.describe('RF-NOT-01 Avisar os participantes', () => {
  test('RN-NOT-02: pagamento recebido avisa o participante, com o valor e a forma', async ({
    browser,
  }) => {
    const { pessoa, participante, gestor } = await participanteEGestor(browser);
    await receberEmDinheiro(gestor, pessoa.nome, '25,00');
    await chega(pessoa.email, 'Pagamento recebido', '25,00 em dinheiro');

    // Also the comprovante confirmado, with the valor confirmado.
    await enviarComprovante(participante, '30,00');
    await conferirComprovantes(gestor);
    await confirmarComprovante(gestor, pessoa.nome, '30,00', '20,00');
    await chega(pessoa.email, 'Pagamento recebido', '20,00 por PIX');
  });

  test('RN-NOT-04: reembolso feito avisa quem pagou o gasto do próprio bolso', async ({
    browser,
  }) => {
    const { pessoa, participante, gestor } = await participanteEGestor(browser);
    expect(await registrarGastoPelaApi(participante, 4590)).toBe(201);
    await reembolsar(gestor, pessoa.nome, '45,90');
    await chega(pessoa.email, 'Reembolso feito', '45,90');
  });

  test('RN-NOT-05: comprovante enviado avisa cada gestor, com quem enviou e o valor', async ({
    browser,
  }) => {
    const { pessoa, participante } = await participanteEGestor(browser);
    await enviarComprovante(participante, '30,00');
    await chega('gestor@facoffee.local', 'Comprovante enviado', pessoa.nome, '30,00');
  });

  test('RN-NOT-06: comprovante recusado avisa o participante, com o valor e o motivo', async ({
    browser,
  }) => {
    const { pessoa, participante, gestor } = await participanteEGestor(browser);
    await enviarComprovante(participante, '10,00');
    await conferirComprovantes(gestor);
    await recusarComprovante(gestor, pessoa.nome, '10,00', 'Não achei o PIX');
    await chega(pessoa.email, 'Comprovante recusado', '10,00', 'Não achei o PIX');
  });
});
