import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { type Browser, expect, type Locator, type Page, test } from '@playwright/test';

// Ports of the stack started in global-setup.ts.
const { E2E_PORTA_WEB, E2E_PORTA_KEYCLOAK, E2E_PORTA_MAILPIT, E2E_AGENDADOR = '' } = process.env;
const KEYCLOAK = `http://127.0.0.1:${E2E_PORTA_KEYCLOAK}`;
const MAILPIT = `http://127.0.0.1:${E2E_PORTA_MAILPIT}`;
const ESPERA = { timeout: 30_000 };

// The browser keeps the addresses of the local stack, which the web and the tokens carry
// (http://localhost and the Keycloak at http://localhost:8080), sent to the test stack's ports.
test.use({
  launchOptions: {
    args: [
      `--host-resolver-rules=MAP localhost:80 127.0.0.1:${E2E_PORTA_WEB}, MAP localhost:8080 127.0.0.1:${E2E_PORTA_KEYCLOAK}`,
    ],
  },
});

type Usuario = { readonly usuario: string; readonly nome: string; readonly email: string };

// A new usuário per test, so the tests do not depend on each other.
const novoUsuario = async ({
  sobrenome,
  gestor = false,
}: {
  readonly sobrenome?: string;
  readonly gestor?: boolean;
} = {}): Promise<Usuario> => {
  const usuario = `e2e-${randomUUID().slice(0, 8)}`;
  const email = `${usuario}@facoffee.local`;
  return test.step(`Criar o usuário ${usuario} no Keycloak`, async () => {
    const admin = await fetch(`${KEYCLOAK}/realms/master/protocol/openid-connect/token`, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: process.env.KEYCLOAK_ADMIN ?? 'admin',
        password: process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin',
      }),
    });
    const headers = {
      authorization: `Bearer ${(await admin.json()).access_token}`,
      'content-type': 'application/json',
    };
    const criado = await fetch(`${KEYCLOAK}/admin/realms/facoffee/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username: usuario,
        email,
        firstName: 'E2E',
        lastName: sobrenome ?? usuario,
        enabled: true,
        emailVerified: true,
        credentials: [{ type: 'password', value: usuario, temporary: false }],
      }),
    });
    expect(criado.status).toBe(201);
    if (gestor) {
      const papel = await fetch(`${KEYCLOAK}/admin/realms/facoffee/roles/gestor`, { headers });
      const id = criado.headers.get('location')?.split('/').pop();
      const mapeado = await fetch(
        `${KEYCLOAK}/admin/realms/facoffee/users/${id}/role-mappings/realm`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify([await papel.json()]),
        },
      );
      expect(mapeado.status).toBe(204);
    }
    return { usuario, nome: `E2E ${sobrenome ?? usuario}`, email };
  });
};

// WCAG 1.4.10 (ADR 0028): the page never scrolls sideways, not even at 320 px.
const semRolagemHorizontal = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBe(0);

const PAGINA_INICIAL = { participante: 'Minha situação', gestor: 'Participantes' } as const;

// Each person in their own browser context, logged in through the Keycloak like anyone else; the
// gestor chooses the visão, by keyboard (ADR 0029).
const entrarNoFacoffee = (browser: Browser, usuario: string, visao?: keyof typeof PAGINA_INICIAL) =>
  test.step(`Entrar no FACOFFEE como ${usuario}`, async () => {
    const page = await (await browser.newContext()).newPage();
    page.on('dialog', (dialogo) => dialogo.accept());
    await page.goto('/');
    await semRolagemHorizontal(page);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('#username')).toBeVisible();
    await semRolagemHorizontal(page);
    await page.locator('#username').fill(usuario);
    await page.locator('#password').fill(usuario);
    await page.locator('#kc-login').click();
    if (visao) {
      const escolha = page.getByRole('button', { name: `Visão do ${visao}` });
      await expect(escolha).toBeVisible();
      await semRolagemHorizontal(page);
      await escolha.focus();
      await page.keyboard.press('Enter');
    }
    await expect(
      page.getByRole('heading', { name: PAGINA_INICIAL[visao ?? 'participante'] }),
    ).toBeVisible();
    return page;
  });

const pedirEntrada = (page: Page, usuario: string) =>
  test.step(`${usuario} pede entrada com a cota Só café`, async () => {
    await page.getByLabel('Só café').check();
    await page.getByRole('button', { name: 'Pedir entrada' }).click();
    await expect(page.getByText('Entrada pedida.')).toBeVisible();
  });

// The events reach the other contexts asynchronously: reload until the page shows them.
const recarregarAte = (page: Page, esperado: Locator) =>
  expect(async () => {
    await page.reload();
    await expect(esperado).toBeVisible({ timeout: 2_000 });
  }).toPass(ESPERA);

const menu = (page: Page) => page.getByRole('navigation', { name: 'Principal' }).getByRole('link');

// The avatar opens the menu da conta, with the troca de visão of the gestor and Sair (ADR 0029).
const abrirConta = async (page: Page) => {
  await page.getByRole('button', { name: /, conta de / }).click();
  const conta = page.locator('#conta');
  await expect(conta).toBeVisible();
  return conta;
};

const linhaDe = (page: Page, nome: string) => page.getByRole('row').filter({ hasText: nome });

const participarNaTelaDoGestor = (gestor: Page, nome: string) =>
  test.step(`Esperar ${nome} como "Participa" na tela do gestor`, async () => {
    await gestor.goto('/participantes');
    await recarregarAte(gestor, linhaDe(gestor, nome).getByText('Participa', { exact: true }));
  });

type Situacao = {
  readonly id: string;
  readonly ativo: boolean;
  readonly creditoEmCentavos: number;
  readonly pendenteEmCentavos: number;
};

// Reads the API with the page's session (the token the web keeps in sessionStorage).
const lerApi = <T>(page: Page, caminho: string) =>
  page.evaluate(async (caminho) => {
    const chave = Object.keys(sessionStorage).find((k) => k.startsWith('oidc.user:')) ?? '';
    const { access_token } = JSON.parse(sessionStorage.getItem(chave) ?? '{}');
    const r = await fetch(caminho, { headers: { authorization: `Bearer ${access_token}` } });
    return r.json();
  }, caminho) as Promise<T>;

// Leitura *Crédito e pendentes* of every participante, by id, with the gestor's session. The page
// lists only who is a usuário, so it cannot tell who Financeiro counts as ativo.
const creditoEPendentes = async (gestor: Page) =>
  new Map((await lerApi<Situacao[]>(gestor, '/api/financeiro/participante')).map((s) => [s.id, s]));

const saldo = (s?: Situacao) => (s ? s.creditoEmCentavos - s.pendenteEmCentavos : Number.NaN);

const assuntosDosEmails = async (email: string): Promise<readonly string[]> => {
  const r = await fetch(
    `${MAILPIT}/api/v1/search?${new URLSearchParams({ query: `to:${email}` })}`,
  );
  return (await r.json()).messages.map((m: { Subject: string }) => m.Subject);
};

test('entrar, cota devida e pagamento recebido: crédito correto e e-mail enviado', {
  tag: '@celular',
}, async ({ browser }) => {
  const pessoa = await novoUsuario();
  const participante = await entrarNoFacoffee(browser, pessoa.usuario);
  const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
  await pedirEntrada(participante, pessoa.usuario);

  await test.step(`${pessoa.usuario} vê só as páginas do participante`, async () => {
    await expect(menu(participante)).toHaveText(['Minha situação', 'Caixinha']);
    const conta = await abrirConta(participante);
    await expect(conta.getByRole('link')).toHaveCount(0);
    await expect(conta.getByRole('button', { name: 'Sair' })).toBeVisible();
    await participante.keyboard.press('Escape');
    await expect(conta).toBeHidden();
    await participante.goto('/gastos');
    await expect(
      participante.getByRole('heading', { name: 'Página não encontrada' }),
    ).toBeVisible();
    await participante.goto('/');
  });

  await test.step('Gestor define o valor da cota Só café: R$ 20,00', async () => {
    // Once per ano: the other project's run of this test, on the same stack, may have defined it.
    await gestor.goto('/caixinha');
    const soCafe = gestor
      .getByRole('table', { name: /^Valor da cota em \d+$/ })
      .getByRole('row')
      .filter({ hasText: 'Só café' });
    const indefinido = gestor.getByText('O valor da cota deste ano ainda não foi definido.');
    await expect(soCafe.or(indefinido)).toBeVisible();
    if (await soCafe.isVisible()) return expect(soCafe).toContainText(/R\$\s20,00/);
    await gestor.goto('/valor-da-cota');
    await gestor.getByLabel('Valor mensal (R$)').fill('20');
    await gestor.getByRole('button', { name: 'Definir valor da cota' }).click();
    await expect(gestor.getByText(/^Valor da cota Só café em \d+ definido\.$/)).toBeVisible();
  });

  await test.step('Todo início de mês: a cota de R$ 20,00 fica devida', async () => {
    // The agendador fires *Todo início de mês* on start (ADR 0017); the trigger is internal.
    execFileSync('docker', ['restart', E2E_AGENDADOR]);
    const cotas = participante.getByRole('table', { name: 'Cotas' });
    await recarregarAte(participante, cotas);
    await expect(cotas.locator('tbody td').nth(2)).toHaveText(/^R\$\s20,00$/);
  });

  await test.step(`${pessoa.usuario} vê o pendente: R$ 20,00`, () =>
    expect(participante.getByText(/Pendente: R\$\s20,00/)).toBeVisible());

  await test.step(`Lembrar os pendentes: e-mail da cota devida chega a ${pessoa.email}`, async () => {
    // The agendador asks Notificação right after *Todo início de mês*, before Financeiro has the
    // cota; the next run avisa it (ADR 0027).
    execFileSync('docker', ['restart', E2E_AGENDADOR]);
    await expect
      .poll(() => assuntosDosEmails(pessoa.email), ESPERA)
      .toEqual(expect.arrayContaining([expect.stringMatching(/^Cota de /)]));
  });

  await participarNaTelaDoGestor(gestor, pessoa.nome);
  await test.step(`Gestor recebe R$ 25,00 em dinheiro de ${pessoa.nome}`, async () => {
    await gestor.getByRole('combobox').selectOption({ label: pessoa.nome });
    await gestor.getByLabel('Valor (R$)').fill('25');
    await gestor.getByLabel('Dinheiro').check();
    await gestor.getByRole('button', { name: 'Receber pagamento' }).click();
    await expect(gestor.getByText('Pagamento recebido.')).toBeVisible();
  });

  await test.step(`${pessoa.usuario} vê o crédito: R$ 5,00`, async () => {
    await participante.reload();
    await expect(participante.getByText(/Crédito: R\$\s5,00/)).toBeVisible();
    await semRolagemHorizontal(participante);
  });
  await test.step(`E-mail "Pagamento recebido" chega a ${pessoa.email}`, () =>
    expect.poll(() => assuntosDosEmails(pessoa.email), ESPERA).toContain('Pagamento recebido'));

  await test.step(`${pessoa.usuario} vê de onde vem o valor da cota`, async () => {
    await participante.goto('/caixinha');
    const valores = participante.getByRole('table', { name: /^Valor da cota em \d+$/ });
    await expect(valores.getByRole('row').filter({ hasText: 'Só café' })).toContainText(
      /R\$\s20,00/,
    );
    // A new stack has no gasto in the year before.
    const gastos = participante.getByRole('table', { name: 'Gastos do ano anterior' });
    await expect(gastos.getByRole('row').filter({ hasText: 'Total' })).toContainText(/R\$\s0,00/);
    await semRolagemHorizontal(participante);
  });
});

test('telas do gestor: gasto do próprio bolso e nenhuma tela rola na horizontal', {
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

  await test.step('Gestor troca de visão pelo menu: cada uma só com as suas páginas', async () => {
    await expect(menu(gestor)).toHaveText(['Minha situação', 'Caixinha']);
    const conta = await abrirConta(gestor);
    await semRolagemHorizontal(gestor);
    await conta.getByRole('link', { name: 'Trocar para Gestor' }).click();
    await expect(conta).toBeHidden();
    await expect(gestor.getByRole('heading', { name: 'Participantes' })).toBeVisible();
    await expect(menu(gestor)).toHaveText(['Participantes', 'Gastos', 'Valor da cota']);
    await expect(
      (await abrirConta(gestor)).getByRole('link', { name: 'Trocar para Participante' }),
    ).toBeVisible();
    await gestor.keyboard.press('Escape');
  });
  await participarNaTelaDoGestor(gestor, pessoa.nome);

  await test.step('Gestor registra um gasto de R$ 12,34 pago do próprio bolso', async () => {
    await gestor.goto('/gastos');
    await gestor.getByLabel('Tipo').selectOption({ label: 'Café' });
    await gestor
      .getByRole('region', { name: 'Registrar gasto' })
      .getByLabel('Valor total (R$)')
      .fill('12.34');
    await gestor.getByLabel('Próprio bolso').check();
    await gestor.getByLabel(/^Nota/).setInputFiles({
      name: 'nota.png',
      mimeType: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]),
    });
    await gestor.getByRole('button', { name: 'Registrar gasto' }).click();
    await expect(gestor.getByText('Gasto registrado.', { exact: true })).toBeVisible();
    await expect(
      linhaDe(gestor, pessoa.nome).getByRole('button', { name: /^Reembolsar R\$\s12,34 a / }),
    ).toBeVisible();
  });

  for (const caminho of ['/', '/caixinha', '/participantes', '/gastos', '/valor-da-cota'])
    await test.step(`${caminho} não rola na horizontal`, async () => {
      await gestor.goto(caminho);
      await expect(gestor.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(gestor.getByText('Carregando…')).toHaveCount(0);
      await semRolagemHorizontal(gestor);
    });
});

test('desativar acesso: participante saiu e fica fora dos participantes ativos', async ({
  browser,
}) => {
  const pessoa = await novoUsuario();
  const participante = await entrarNoFacoffee(browser, pessoa.usuario);
  const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
  await pedirEntrada(participante, pessoa.usuario);
  await participarNaTelaDoGestor(gestor, pessoa.nome);

  await test.step(`Gestor desativa o acesso de ${pessoa.nome}`, async () => {
    await gestor.getByRole('button', { name: `Desativar acesso de ${pessoa.nome}` }).click();
    await expect(gestor.getByText(`Acesso de ${pessoa.nome} desativado.`)).toBeVisible();
  });
  await test.step(`Esperar ${pessoa.nome} como "Saiu" na tela do gestor`, () =>
    recarregarAte(gestor, linhaDe(gestor, pessoa.nome).getByText('Saiu', { exact: true })));
});

test('complemento: parte igual para cada participante ativo', async ({ browser }) => {
  const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
  const participantes: Page[] = [];
  for (const pessoa of [await novoUsuario(), await novoUsuario()]) {
    const participante = await entrarNoFacoffee(browser, pessoa.usuario);
    await pedirEntrada(participante, pessoa.usuario);
    await participarNaTelaDoGestor(gestor, pessoa.nome);
    participantes.push(participante);
  }

  const antes = await creditoEPendentes(gestor);
  const ativos = [...antes.values()].filter((s) => s.ativo).length;
  const parte = 150;
  const total = ((parte * ativos) / 100).toFixed(2);
  await test.step(`Gestor solicita complemento de R$ ${total} para ${ativos} ativos`, async () => {
    await gestor.goto('/gastos');
    await gestor
      .getByRole('region', { name: 'Solicitar complemento' })
      .getByLabel('Valor total (R$)')
      .fill(total);
    await gestor.getByRole('button', { name: 'Solicitar complemento' }).click();
    await expect(gestor.getByText('Complemento solicitado.')).toBeVisible();
  });

  await test.step(`Cada um dos ${ativos} ativos deve R$ 1,50 a mais, e os inativos nada`, async () => {
    const depois = await creditoEPendentes(gestor);
    for (const [id, situacao] of antes) {
      expect(saldo(depois.get(id)), id).toBe(saldo(situacao) - (situacao.ativo ? parte : 0));
    }
  });
  await test.step('Os novos participantes veem a parte de R$ 1,50', async () => {
    for (const participante of participantes) {
      await participante.reload();
      const complementos = participante.getByRole('table', { name: 'Complementos' });
      await expect(complementos.locator('tbody td').nth(1)).toHaveText(/^R\$\s1,50$/);
    }
  });
});

test('comprovante enviado: o gestor confirma com outro valor ou recusa com o motivo', {
  tag: '@celular',
}, async ({ browser }) => {
  const pessoa = await novoUsuario();
  const participante = await entrarNoFacoffee(browser, pessoa.usuario);
  const gestor = await entrarNoFacoffee(browser, 'gestor', 'gestor');
  await pedirEntrada(participante, pessoa.usuario);
  // Financeiro learns of the entrada asynchronously; then the participante can send comprovantes.
  const comprovantes = participante.getByRole('region', { name: 'Comprovantes' });
  await recarregarAte(participante, comprovantes);
  // PNG: the headless Chromium downloads a PDF instead of opening it.
  const pix = {
    name: 'pix.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]),
  };
  const enviados = comprovantes.getByRole('table', { name: 'Comprovantes enviados' });
  const situacao = () =>
    lerApi<{ creditoEmCentavos: number; pendenteEmCentavos: number }>(
      participante,
      '/api/financeiro/participante/eu',
    ).then((s) => s.creditoEmCentavos - s.pendenteEmCentavos);

  for (const valor of ['30', '10'])
    await test.step(`${pessoa.usuario} envia um comprovante de R$ ${valor},00`, async () => {
      // The first form is the envio; the others edit each comprovante a confirmar.
      const envio = comprovantes.locator('form').first();
      await envio.getByLabel('Valor pago (R$)').fill(valor);
      await envio.getByLabel(/^Comprovante do PIX/).setInputFiles(pix);
      await envio.getByRole('button', { name: 'Enviar comprovante' }).click();
      await expect(participante.getByText(/^Comprovante enviado\./)).toBeVisible();
      await expect(
        enviados.getByRole('row').filter({ hasText: `R$\u00a0${valor},00` }),
      ).toContainText('A confirmar');
    });

  await test.step(`${pessoa.usuario} corrige o de R$ 30,00 para R$ 25,00`, async () => {
    await enviados.getByLabel(/^Editar comprovante de R\$\s30,00/).click();
    const edicao = enviados
      .getByRole('row')
      .filter({ hasText: /R\$\s30,00/ })
      .locator('form');
    await edicao.getByLabel('Valor pago (R$)').fill('25');
    await edicao.getByRole('button', { name: 'Salvar' }).click();
    await expect(participante.getByText('Comprovante editado.')).toBeVisible();
    await expect(enviados.getByRole('row').filter({ hasText: /R\$\s25,00/ })).toBeVisible();
    await semRolagemHorizontal(participante);
  });
  const antes = await situacao();

  const aConfirmar = gestor.getByRole('region', { name: 'Comprovantes a confirmar' });
  const doComprovante = (valor: string) =>
    aConfirmar.getByRole('row').filter({ hasText: pessoa.nome }).filter({ hasText: valor });
  await test.step('Gestor vê os comprovantes a confirmar e abre o arquivo', async () => {
    await gestor.goto('/participantes');
    await expect(doComprovante('25,00')).toBeVisible();
    const [aba] = await Promise.all([
      gestor.waitForEvent('popup'),
      doComprovante('25,00')
        .getByRole('button', { name: /^Ver o comprovante/ })
        .click(),
    ]);
    await expect.poll(() => aba.url()).toMatch(/^blob:/);
    await aba.close();
  });

  await test.step('Gestor confirma o de R$ 25,00 com R$ 20,00', async () => {
    await doComprovante('25,00')
      .getByLabel(/^Confirmar ou recusar/)
      .click();
    await doComprovante('25,00').getByLabel('Valor confirmado (R$)').fill('20');
    await semRolagemHorizontal(gestor);
    await doComprovante('25,00').getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(gestor.getByText('Comprovante confirmado: pagamento recebido.')).toBeVisible();
  });

  await test.step('Gestor recusa o de R$ 10,00 com o motivo', async () => {
    await doComprovante('10,00')
      .getByLabel(/^Confirmar ou recusar/)
      .click();
    await doComprovante('10,00').getByLabel('Motivo da recusa').fill('Não achei o PIX');
    await doComprovante('10,00').getByRole('button', { name: 'Recusar', exact: true }).click();
    await expect(gestor.getByText('Comprovante recusado.')).toBeVisible();
    await expect(doComprovante(pessoa.nome)).toHaveCount(0);
  });

  await test.step(`${pessoa.usuario} vê o valor confirmado e o motivo, e só R$ 20,00 conta`, async () => {
    await participante.reload();
    await expect(enviados.getByRole('row').filter({ hasText: /R\$\s25,00/ })).toContainText(
      /Confirmado: R\$\s20,00/,
    );
    await expect(enviados.getByRole('row').filter({ hasText: /R\$\s10,00/ })).toContainText(
      'Recusado: Não achei o PIX',
    );
    await expect(enviados.getByRole('button', { name: /^Cancelar o envio/ })).toHaveCount(0);
    expect(await situacao()).toBe(antes + 2000);
    await semRolagemHorizontal(participante);
  });
  await test.step(`E-mail "Pagamento recebido" chega a ${pessoa.email}`, () =>
    expect.poll(() => assuntosDosEmails(pessoa.email), ESPERA).toContain('Pagamento recebido'));
});
