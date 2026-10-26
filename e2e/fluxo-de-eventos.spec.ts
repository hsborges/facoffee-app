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
const novoUsuario = async (): Promise<Usuario> => {
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
    const criado = await fetch(`${KEYCLOAK}/admin/realms/facoffee/users`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${(await admin.json()).access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        username: usuario,
        email,
        firstName: 'E2E',
        lastName: usuario,
        enabled: true,
        emailVerified: true,
        credentials: [{ type: 'password', value: usuario, temporary: false }],
      }),
    });
    expect(criado.status).toBe(201);
    return { usuario, nome: `E2E ${usuario}`, email };
  });
};

// Each person in their own browser context, logged in through the Keycloak like anyone else.
const entrarNoFacoffee = (browser: Browser, usuario: string, senha = usuario) =>
  test.step(`Entrar no FACOFFEE como ${usuario}`, async () => {
    const page = await (await browser.newContext()).newPage();
    page.on('dialog', (dialogo) => dialogo.accept());
    await page.goto('/');
    await page.locator('#username').fill(usuario);
    await page.locator('#password').fill(senha);
    await page.locator('#kc-login').click();
    await expect(page.getByRole('heading', { name: 'Minha situação' })).toBeVisible();
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

const linhaDe = (page: Page, nome: string) => page.getByRole('row').filter({ hasText: nome });

const participarNaTelaDoGestor = (gestor: Page, nome: string) =>
  test.step(`Esperar ${nome} como "Participa" na tela do gestor`, async () => {
    await gestor.goto('/participantes');
    await recarregarAte(gestor, linhaDe(gestor, nome).getByText('Participa', { exact: true }));
  });

const centavos = (reais: string) => Number(reais.replace(/\D/g, ''));

type Situacao = {
  readonly id: string;
  readonly ativo: boolean;
  readonly creditoEmCentavos: number;
  readonly pendenteEmCentavos: number;
};

// Leitura *Crédito e pendentes* of every participante, by id, with the gestor's session (the token
// the web keeps in sessionStorage). The page lists only who is a usuário, so it cannot tell who
// Financeiro counts as ativo.
const creditoEPendentes = async (gestor: Page) =>
  new Map(
    (
      await gestor.evaluate(async () => {
        const chave = Object.keys(sessionStorage).find((k) => k.startsWith('oidc.user:')) ?? '';
        const { access_token } = JSON.parse(sessionStorage.getItem(chave) ?? '{}');
        const r = await fetch('/api/financeiro/participante', {
          headers: { authorization: `Bearer ${access_token}` },
        });
        return (await r.json()) as Situacao[];
      })
    ).map((s) => [s.id, s]),
  );

const saldo = (s?: Situacao) => (s ? s.creditoEmCentavos - s.pendenteEmCentavos : Number.NaN);

const assuntosDosEmails = async (email: string): Promise<readonly string[]> => {
  const r = await fetch(
    `${MAILPIT}/api/v1/search?${new URLSearchParams({ query: `to:${email}` })}`,
  );
  return (await r.json()).messages.map((m: { Subject: string }) => m.Subject);
};

test('entrar, cota devida e pagamento recebido: crédito correto e e-mail enviado', async ({
  browser,
}) => {
  const pessoa = await novoUsuario();
  const participante = await entrarNoFacoffee(browser, pessoa.usuario);
  const gestor = await entrarNoFacoffee(browser, 'gestor');
  await pedirEntrada(participante, pessoa.usuario);

  await test.step('Gestor define o valor da cota Só café: R$ 20,00', async () => {
    await gestor.goto('/valor-da-cota');
    await gestor.getByLabel('Valor mensal (R$)').fill('20');
    await gestor.getByRole('button', { name: 'Definir valor da cota' }).click();
    await expect(gestor.getByText(/^Valor da cota Só café em \d+ definido\.$/)).toBeVisible();
  });

  const valorDaCota = await test.step('Todo início de mês: a cota fica devida', async () => {
    // The agendador fires *Todo início de mês* on start (ADR 0017); the trigger is internal.
    execFileSync('docker', ['restart', E2E_AGENDADOR]);
    const cotas = participante.getByRole('table', { name: 'Cotas' });
    await recarregarAte(participante, cotas);
    return (await cotas.locator('tbody td').nth(2).textContent()) ?? '';
  });

  await test.step(`${pessoa.usuario} vê o pendente: ${valorDaCota}`, () =>
    expect(participante.getByText(`Pendente: ${valorDaCota}`)).toBeVisible());

  await participarNaTelaDoGestor(gestor, pessoa.nome);
  const valorPago = ((centavos(valorDaCota) + 500) / 100).toFixed(2);
  await test.step(`Gestor recebe R$ ${valorPago} em dinheiro de ${pessoa.nome}`, async () => {
    await gestor.getByRole('combobox').selectOption({ label: pessoa.nome });
    await gestor.getByLabel('Valor (R$)').fill(valorPago);
    await gestor.getByLabel('Dinheiro').check();
    await gestor.getByRole('button', { name: 'Receber pagamento' }).click();
    await expect(gestor.getByText('Pagamento recebido.')).toBeVisible();
  });

  await test.step(`${pessoa.usuario} vê o crédito: R$ 5,00`, async () => {
    await participante.reload();
    await expect(participante.getByText(/Crédito: R\$\s5,00/)).toBeVisible();
  });
  await test.step(`E-mail "Pagamento recebido" chega a ${pessoa.email}`, () =>
    expect.poll(() => assuntosDosEmails(pessoa.email), ESPERA).toContain('Pagamento recebido'));
});

test('desativar acesso: participante saiu e fica fora dos participantes ativos', async ({
  browser,
}) => {
  const pessoa = await novoUsuario();
  const participante = await entrarNoFacoffee(browser, pessoa.usuario);
  const gestor = await entrarNoFacoffee(browser, 'gestor');
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
  const gestor = await entrarNoFacoffee(browser, 'gestor');
  const participantes: Page[] = [];
  for (const pessoa of [await novoUsuario(), await novoUsuario()]) {
    participantes.push(await entrarNoFacoffee(browser, pessoa.usuario));
    await pedirEntrada(participantes[participantes.length - 1], pessoa.usuario);
    await participarNaTelaDoGestor(gestor, pessoa.nome);
  }

  const antes = await creditoEPendentes(gestor);
  const ativos = [...antes.values()].filter((s) => s.ativo).length;
  const parte = 150;
  const total = ((parte * ativos) / 100).toFixed(2);
  await test.step(`Gestor solicita complemento de R$ ${total} para ${ativos} ativos`, async () => {
    await gestor.goto('/caixinha');
    await gestor.getByLabel('Valor total (R$)').fill(total);
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
