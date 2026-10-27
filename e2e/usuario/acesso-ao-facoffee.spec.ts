import type { Page } from '@playwright/test';
import {
  abrirConta,
  chamarApi,
  entrarNoFacoffee,
  expect,
  lerApi,
  linhaDe,
  naTelaDoGestor,
  novoUsuario,
  pagina,
  paginasDoMenu,
  pedirEntrada,
  recarregarAte,
  semRolagemHorizontal,
  test,
} from '../apoio.ts';

// The gestor desativa or reativa the acesso of `nome`, in *Participantes*.
const mudarAcesso = (gestor: Page, nome: string, para: 'desativado' | 'ativo') =>
  test.step(`Gestor deixa o acesso de ${nome} ${para}`, async () => {
    await gestor.goto('/participantes');
    const linha = linhaDe(gestor, nome);
    await linha.getByTestId(para === 'desativado' ? 'desativar-acesso' : 'reativar-acesso').click();
    await expect(linha).toHaveAttribute('data-acesso', para);
  });

test.describe('RF-USU-01 Acesso ao FACOFFEE', () => {
  test('RN-USU-01: o acesso é desativado pelo gestor ou a pedido da própria pessoa; só o gestor desativa outra', async ({
    browser,
  }) => {
    const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
    const ana = await novoUsuario();
    await entrarNoFacoffee(browser, ana.usuario);
    await naTelaDoGestor(gestor, ana.nome, 'nunca-participou');
    await mudarAcesso(gestor, ana.nome, 'desativado');

    const bia = await novoUsuario();
    const propria = await entrarNoFacoffee(browser, bia.usuario);
    await test.step(`${bia.usuario} desativa o próprio acesso`, async () => {
      await propria.getByTestId('desativar-meu-acesso').click();
      await expect(propria.getByTestId('entrar')).toBeVisible();
      await gestor.reload();
      await expect(linhaDe(gestor, bia.nome)).toHaveAttribute('data-acesso', 'desativado');
    });

    await test.step('Um participante tenta desativar outra pessoa: o pedido é recusado', async () => {
      const caio = await entrarNoFacoffee(browser, (await novoUsuario()).usuario);
      const { id } = await lerApi<{ id: string }>(gestor, '/api/usuario/eu');
      const desativado = await chamarApi(caio, `POST /api/usuario/${id}/desativar`);
      expect(desativado).toMatchObject({ status: 403, corpo: { error: 'sem-permissao' } });
    });
  });

  test('RN-USU-02: quem está desativado não acessa o FACOFFEE', { tag: '@celular' }, async ({
    browser,
  }) => {
    const pessoa = await novoUsuario();
    const desativada = await entrarNoFacoffee(browser, pessoa.usuario);
    await mudarAcesso(
      await entrarNoFacoffee(browser, 'gestor', 'gestor'),
      pessoa.nome,
      'desativado',
    );

    await test.step(`${pessoa.usuario} abre o FACOFFEE: nenhum pedido passa do gateway`, async () => {
      await desativada.reload();
      await expect(desativada.getByTestId('acesso-desativado')).toBeVisible();
      await semRolagemHorizontal(desativada);
      expect(await chamarApi(desativada, 'GET /api/financeiro/caixinha')).toMatchObject({
        status: 403,
        corpo: { error: 'acesso-desativado' },
      });
    });
  });

  test('RN-USU-04: só o gestor reativa o acesso, e reativar não devolve a participação', async ({
    browser,
  }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
    await pedirEntrada(participante, pessoa.usuario);
    await naTelaDoGestor(gestor, pessoa.nome);
    const { id } = await lerApi<{ id: string }>(participante, '/api/usuario/eu');
    await mudarAcesso(gestor, pessoa.nome, 'desativado');

    await test.step('A própria pessoa tenta reativar: o pedido é recusado', async () => {
      const reativado = await chamarApi(participante, `POST /api/usuario/${id}/reativar`);
      expect(reativado.status).toBe(403);
    });

    await mudarAcesso(gestor, pessoa.nome, 'ativo');
    await test.step(`${pessoa.usuario} volta a acessar, mas ainda não participa`, () =>
      recarregarAte(participante, participante.getByTestId('nao-participa')));
  });

  test('RN-USU-05: o usuário é registrado no primeiro acesso, com nome, e-mail e perfis', {
    tag: '@celular',
  }, async ({ browser }) => {
    const pessoa = await novoUsuario();
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);

    await test.step(`${pessoa.usuario} fica registrado com o nome e o e-mail`, async () => {
      expect(await lerApi(participante, '/api/usuario/eu')).toMatchObject({
        nome: pessoa.nome,
        email: pessoa.email,
        perfis: [],
      });
      await naTelaDoGestor(
        await entrarNoFacoffee(browser, 'gestor', 'gestor'),
        pessoa.nome,
        'nunca-participou',
      );
    });

    await test.step('Sem o perfil de gestor, vê só as páginas do participante', async () => {
      expect(await paginasDoMenu(participante)).toEqual(['minha-situacao', 'caixinha']);
      const conta = await abrirConta(participante);
      await expect(conta).toContainText(pessoa.nome);
      await expect(conta.getByTestId('trocar-visao')).toHaveCount(0);
      await expect(conta.getByTestId('sair')).toBeVisible();
      await participante.keyboard.press('Escape');
      await expect(conta).toBeHidden();
      await participante.goto('/gastos');
      await expect(pagina(participante, 'nao-encontrada')).toBeVisible();
      await participante.getByTestId('ir-ao-inicio').click();
      await expect(pagina(participante, 'minha-situacao')).toBeVisible();
    });

    const comPerfil = await novoUsuario({ gestor: true });
    const gestor = await entrarNoFacoffee(browser, comPerfil.usuario, 'participante');
    await test.step('Com o perfil de gestor, troca de visão pelo menu: cada uma só com as suas páginas', async () => {
      expect(await lerApi(gestor, '/api/usuario/eu')).toMatchObject({ perfis: ['gestor'] });
      expect(await paginasDoMenu(gestor)).toEqual(['minha-situacao', 'caixinha']);
      const conta = await abrirConta(gestor);
      await semRolagemHorizontal(gestor);
      await conta.getByTestId('trocar-visao').click();
      await expect(conta).toBeHidden();
      await expect(pagina(gestor, 'participantes')).toBeVisible();
      expect(await paginasDoMenu(gestor)).toEqual(['participantes', 'gastos', 'valor-da-cota']);
      await expect((await abrirConta(gestor)).getByTestId('trocar-visao')).toBeVisible();
      await gestor.keyboard.press('Escape');
      await gestor.getByTestId('menu-gastos').click();
      await expect(pagina(gestor, 'gastos')).toBeVisible();
      await gestor.getByTestId('ir-ao-inicio').click();
      await expect(pagina(gestor, 'participantes')).toBeVisible();
    });
  });
});
