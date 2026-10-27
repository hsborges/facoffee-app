import type { Browser } from '@playwright/test';
import {
  aConfirmar,
  chamarApi,
  conferir,
  conferirComprovantes,
  confirmarAcao,
  confirmarComprovante,
  entrarNoFacoffee,
  enviadoDe,
  enviados,
  enviarComprovante,
  expect,
  feito,
  lerApi,
  naTelaDoGestor,
  novoUsuario,
  pedirEntrada,
  png,
  reais,
  recusarComprovante,
  saldoDaCaixinha,
  saldoDe,
  semRolagemHorizontal,
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

test.describe('RF-FIN-02 Enviar comprovante', () => {
  test('RN-FIN-07: comprovante a confirmar não é pagamento', async ({ browser }) => {
    const { participante } = await participanteEGestor(browser);
    const antes = {
      saldo: await saldoDe(participante),
      caixinha: await saldoDaCaixinha(participante),
    };

    await enviarComprovante(participante, '30,00');
    await test.step('Nem a situação do participante nem o saldo da caixinha mudam', async () => {
      await participante.reload();
      await expect(enviadoDe(participante, '30,00')).toHaveAttribute(
        'data-situacao',
        'a-confirmar',
      );
      expect(await saldoDe(participante)).toBe(antes.saldo);
      expect(await saldoDaCaixinha(participante)).toBe(antes.caixinha);
    });
  });

  test('RN-FIN-09: ao confirmar, o gestor recebe o pagamento e vale o valor confirmado', {
    tag: '@celular',
  }, async ({ browser }) => {
    const { pessoa, participante, gestor } = await participanteEGestor(browser);
    await enviarComprovante(participante, '25,00');
    const antes = await saldoDe(participante);

    await conferirComprovantes(gestor);
    await semRolagemHorizontal(gestor);
    await confirmarComprovante(gestor, pessoa.nome, '25,00', '20,00');
    await feito(gestor);
    await expect(aConfirmar(gestor, pessoa.nome, '25,00')).toHaveCount(0);

    await test.step(`${pessoa.usuario} vê o valor confirmado, e só R$ 20,00 conta`, async () => {
      await participante.reload();
      const confirmado = enviadoDe(participante, '25,00');
      await expect(confirmado).toHaveAttribute('data-situacao', 'confirmado');
      await expect(confirmado.getByTestId('situacao')).toContainText(reais('20,00'));
      expect(await saldoDe(participante)).toBe(antes + 2000);
      await semRolagemHorizontal(participante);
    });
  });

  test('RN-FIN-10: a recusa tem motivo, que o participante vê', async ({ browser }) => {
    const { pessoa, participante, gestor } = await participanteEGestor(browser);
    await enviarComprovante(participante, '10,00');
    const antes = await saldoDe(participante);

    await conferirComprovantes(gestor);
    await recusarComprovante(gestor, pessoa.nome, '10,00', 'Não achei o PIX');

    await test.step(`${pessoa.usuario} vê o motivo, e nenhum pagamento é recebido`, async () => {
      await participante.reload();
      const recusado = enviadoDe(participante, '10,00');
      await expect(recusado).toHaveAttribute('data-situacao', 'recusado');
      await expect(recusado.getByTestId('situacao')).toContainText('Não achei o PIX');
      expect(await saldoDe(participante)).toBe(antes);
    });
  });

  test('RN-FIN-11: enquanto a confirmar, o participante edita ou cancela o envio; depois, não', {
    tag: '@celular',
  }, async ({ browser }) => {
    const { pessoa, participante, gestor } = await participanteEGestor(browser);
    await enviarComprovante(participante, '30,00');
    await enviarComprovante(participante, '10,00');

    await test.step(`${pessoa.usuario} corrige o de R$ 30,00 para R$ 25,00`, async () => {
      const comprovante = enviadoDe(participante, '30,00');
      await comprovante.getByTestId('editar-comprovante').click();
      const edicao = comprovante.getByTestId('edicao-de-comprovante');
      await edicao.getByTestId('valor').fill('25');
      await edicao.getByTestId('salvar').click();
      await expect(enviadoDe(participante, '25,00')).toHaveAttribute(
        'data-situacao',
        'a-confirmar',
      );
      await expect(enviadoDe(participante, '30,00')).toHaveCount(0);
      await semRolagemHorizontal(participante);
    });

    await test.step(`${pessoa.usuario} cancela o envio do de R$ 10,00`, async () => {
      await enviadoDe(participante, '10,00').getByTestId('cancelar-envio').click();
      await confirmarAcao(participante);
      await expect(enviadoDe(participante, '10,00')).toHaveCount(0);
    });

    const [enviado] = await lerApi<{ id: string }[]>(
      participante,
      '/api/financeiro/comprovante-enviado/eu',
    );
    await test.step('O gestor não cancela o envio de outra pessoa', async () => {
      const cancelado = await chamarApi(
        gestor,
        `POST /api/financeiro/comprovante-enviado/${enviado?.id}/cancelar`,
      );
      expect(cancelado.status).toBe(404);
    });

    await conferirComprovantes(gestor);
    await confirmarComprovante(gestor, pessoa.nome, '25,00');
    await feito(gestor);

    await test.step('Depois da análise, o participante não edita nem cancela', async () => {
      await participante.reload();
      await expect(enviadoDe(participante, '25,00')).toHaveAttribute('data-situacao', 'confirmado');
      await expect(enviados(participante).getByTestId('editar-comprovante')).toHaveCount(0);
      await expect(enviados(participante).getByTestId('cancelar-envio')).toHaveCount(0);
      const cancelado = await chamarApi(
        participante,
        `POST /api/financeiro/comprovante-enviado/${enviado?.id}/cancelar`,
      );
      expect(cancelado).toMatchObject({
        status: 409,
        corpo: { error: 'comprovante-ja-analisado' },
      });
    });
  });

  test('RN-FIN-12: o gestor só confirma o arquivo que conferiu', async ({ browser }) => {
    const { pessoa, participante, gestor } = await participanteEGestor(browser);
    await enviarComprovante(participante, '40,00');

    await test.step('Gestor abre o comprovante', async () => {
      await conferirComprovantes(gestor);
      const conferencia = await conferir(gestor, pessoa.nome, '40,00');
      const [aba] = await Promise.all([
        gestor.waitForEvent('popup'),
        conferencia.getByTestId('ver-comprovante').click(),
      ]);
      await expect.poll(() => aba.url()).toMatch(/^blob:/);
      await aba.close();
    });

    await test.step(`${pessoa.usuario} troca o arquivo em seguida`, async () => {
      const comprovante = enviadoDe(participante, '40,00');
      await comprovante.getByTestId('editar-comprovante').click();
      const edicao = comprovante.getByTestId('edicao-de-comprovante');
      await edicao.getByTestId('arquivo').setInputFiles(png('outro.png'));
      await edicao.getByTestId('salvar').click();
      await feito(participante.getByTestId('comprovantes'));
    });

    await confirmarComprovante(gestor, pessoa.nome, '40,00');
    await test.step('A confirmação é recusada, e o comprovante continua a confirmar', async () => {
      await expect(gestor.getByTestId('aviso-falha')).toBeVisible();
      await expect(aConfirmar(gestor, pessoa.nome, '40,00')).toBeVisible();
      await participante.reload();
      await expect(enviadoDe(participante, '40,00')).toHaveAttribute(
        'data-situacao',
        'a-confirmar',
      );
    });
  });

  test('RN-FIN-14: o gestor vê os comprovantes a confirmar; o participante, só os próprios', async ({
    browser,
  }) => {
    const ana = await participanteEGestor(browser);
    const bia = await participanteEGestor(browser);
    await enviarComprovante(ana.participante, '11,00');
    await enviarComprovante(bia.participante, '12,00');
    const { gestor } = ana;

    await conferirComprovantes(gestor);
    await expect(aConfirmar(gestor, ana.pessoa.nome, '11,00')).toBeVisible();
    await confirmarComprovante(gestor, bia.pessoa.nome, '12,00');
    await feito(gestor);

    await test.step('O gestor vê só o comprovante a confirmar', async () => {
      await expect(aConfirmar(gestor, ana.pessoa.nome, '11,00')).toBeVisible();
      await expect(aConfirmar(gestor, bia.pessoa.nome, '12,00')).toHaveCount(0);
    });
    await test.step('Cada participante vê só o seu, com a situação', async () => {
      for (const { participante, valor, situacao } of [
        { participante: ana.participante, valor: '11,00', situacao: 'a-confirmar' },
        { participante: bia.participante, valor: '12,00', situacao: 'confirmado' },
      ]) {
        await participante.reload();
        await expect(enviados(participante)).toHaveCount(1);
        await expect(enviadoDe(participante, valor)).toHaveAttribute('data-situacao', situacao);
      }
    });
  });

  test('RN-FIN-36: o gestor confere o comprovante com uma lista e recusa com um motivo comum', {
    tag: '@celular',
  }, async ({ browser }) => {
    const { pessoa, participante, gestor } = await participanteEGestor(browser);
    await enviarComprovante(participante, '13,00');

    await conferirComprovantes(gestor);
    await test.step('O gestor vê a lista do que conferir', async () => {
      const conferencia = await conferir(gestor, pessoa.nome, '13,00');
      await expect(conferencia.getByTestId('item-a-conferir')).toHaveCount(3);
      await semRolagemHorizontal(gestor);
    });
    await recusarComprovante(gestor, pessoa.nome, '13,00', 'Comprovante de outro mês', {
      comum: true,
    });

    await test.step(`${pessoa.usuario} vê o motivo comum`, async () => {
      await participante.reload();
      const recusado = enviadoDe(participante, '13,00');
      await expect(recusado).toHaveAttribute('data-situacao', 'recusado');
      await expect(recusado.getByTestId('situacao')).toContainText('Comprovante de outro mês');
    });
  });
});
