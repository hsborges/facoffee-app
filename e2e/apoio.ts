import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { type Browser, test as base, expect, type Locator, type Page } from '@playwright/test';

export { expect };

// Ports of the stack started in global-setup.ts.
const { E2E_PORTA_WEB, E2E_PORTA_KEYCLOAK, E2E_PORTA_MAILPIT, E2E_AGENDADOR = '' } = process.env;
const KEYCLOAK = `http://127.0.0.1:${E2E_PORTA_KEYCLOAK}`;
const MAILPIT = `http://127.0.0.1:${E2E_PORTA_MAILPIT}`;

/** How long to wait for what arrives through the events, asynchronously. */
export const ESPERA = { timeout: 30_000 };

/**
 * The Playwright `test` on the test stack: the browser keeps the addresses of the local stack,
 * which the web and the tokens carry (http://localhost and the Keycloak at http://localhost:8080),
 * sent to the test stack's ports.
 */
export const test = base.extend({
  launchOptions: [
    {
      args: [
        `--host-resolver-rules=MAP localhost:80 127.0.0.1:${E2E_PORTA_WEB}, MAP localhost:8080 127.0.0.1:${E2E_PORTA_KEYCLOAK}`,
      ],
    },
    { scope: 'worker' },
  ],
});

/** A usuário of the Keycloak: the username, which is also the password, the name and the e-mail. */
export type Usuario = { readonly usuario: string; readonly nome: string; readonly email: string };

/** A new usuário per test, so the tests do not depend on each other. */
export const novoUsuario = async ({
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
        // Fixed in infra/docker-compose.dev.yml (ADR 0038).
        username: 'admin',
        password: 'admin',
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

/** WCAG 1.4.10 (ADR 0028): the page never scrolls sideways, not even at 320 px. */
export const semRolagemHorizontal = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBe(0);

const PAGINA_INICIAL = { participante: 'minha-situacao', gestor: 'participantes' } as const;

/**
 * Each person in their own browser context, logged in through the Keycloak like anyone else; the
 * gestor chooses the visão, by keyboard (ADR 0029). The login form is the Keycloak's, found by its
 * own ids.
 */
export const entrarNoFacoffee = (
  browser: Browser,
  usuario: string,
  visao?: keyof typeof PAGINA_INICIAL,
) =>
  test.step(`Entrar no FACOFFEE como ${usuario}`, async () => {
    const page = await (await browser.newContext()).newPage();
    await page.goto('/');
    await semRolagemHorizontal(page);
    await page.getByTestId('entrar').click();
    await expect(page.locator('#username')).toBeVisible();
    await semRolagemHorizontal(page);
    await page.locator('#username').fill(usuario);
    await page.locator('#password').fill(usuario);
    await page.locator('#kc-login').click();
    if (visao) {
      const escolha = page.getByTestId(`visao-${visao}`);
      await expect(escolha).toBeVisible();
      await semRolagemHorizontal(page);
      await escolha.focus();
      await page.keyboard.press('Enter');
    }
    await expect(pagina(page, PAGINA_INICIAL[visao ?? 'participante'])).toBeVisible();
    return page;
  });

/** The title of the page `id` (`minha-situacao`, `participantes`, `nao-encontrada`...). */
export const pagina = (page: Page, id: string) => page.getByTestId(`pagina-${id}`);

/**
 * The elements of `testId` whose `data-*` attributes have the values in `dados`, like
 * `{ participacao: 'saiu' }`.
 */
export const comDados = (
  escopo: Page | Locator,
  testId: string,
  dados: Readonly<Record<string, string>>,
) =>
  escopo.locator(
    [
      `[data-testid="${testId}"]`,
      ...Object.entries(dados).map(([k, v]) => `[data-${k}="${v}"]`),
    ].join(''),
  );

/** A valor like `20,00` as the web writes it: `R$ 20,00`. */
export const reais = (valor: string) => `R$\u00a0${valor}`;

/** Tipo de cota, as the API names it. */
export type TipoDeCota = 'so-cafe' | 'completa';

/** The participante's participação, when participating with `tipo`. */
export const participando = (page: Page, tipo: TipoDeCota) =>
  comDados(page, 'participando', { 'tipo-de-cota': tipo });

/** The participante pede entrada in *Minha situação*. */
export const pedirEntrada = (page: Page, usuario: string, tipo: TipoDeCota = 'so-cafe') =>
  test.step(`${usuario} pede entrada com a cota ${tipo}`, async () => {
    await page.getByTestId(`tipo-de-cota-${tipo}`).check();
    await page.getByTestId('pedir-entrada').click();
    await confirmarAcao(page);
    await expect(participando(page, tipo)).toBeVisible();
  });

/** The participante pede a saída in *Minha situação*. */
export const pedirSaida = (page: Page, usuario: string) =>
  test.step(`${usuario} pede a saída`, async () => {
    await page.getByTestId('pedir-saida').click();
    await confirmarAcao(page);
    await expect(page.getByTestId('nao-participa')).toBeVisible();
  });

/** The events reach the other contexts asynchronously: reload until the page shows them. */
export const recarregarAte = (page: Page, esperado: Locator) =>
  expect(async () => {
    await page.reload();
    await expect(esperado).toBeVisible({ timeout: 2_000 });
  }).toPass(ESPERA);

/** The pages in the main navigation, by id. */
export const paginasDoMenu = (page: Page) =>
  page
    .getByTestId(/^menu-/)
    .evaluateAll((links) => links.map((a) => (a as HTMLElement).dataset.testid?.slice(5)));

/** The avatar opens the menu da conta, with the troca de visão of the gestor and Sair (ADR 0029). */
export const abrirConta = async (page: Page) => {
  await page.getByTestId('abrir-conta').click();
  const conta = page.getByTestId('conta');
  await expect(conta).toBeVisible();
  return conta;
};

/** The row of `nome` in the gestor's *Crédito e pendentes*. */
export const linhaDe = (gestor: Page, nome: string) =>
  gestor.getByTestId('participante').filter({ hasText: nome });

/** Participação of a usuário, as the gestor's *Crédito e pendentes* tells it. */
export type Participacao = 'participa' | 'saiu' | 'nunca-participou';

/** Waits until the gestor's *Participantes* shows `nome` with the `participacao`. */
export const naTelaDoGestor = (
  gestor: Page,
  nome: string,
  participacao: Participacao = 'participa',
) =>
  test.step(`Esperar ${nome} como "${participacao}" na tela do gestor`, async () => {
    await gestor.goto('/participantes');
    await recarregarAte(
      gestor,
      comDados(gestor, 'participante', { participacao }).filter({ hasText: nome }),
    );
  });

/** The confirmação open on the page: a page may have more than one, closed. */
export const confirmacaoAberta = (page: Page) =>
  page.getByTestId('confirmacao').filter({ visible: true });

/** Confirms the critical action asked in the confirmação that just opened. */
export const confirmarAcao = async (page: Page) => {
  const confirmacao = confirmacaoAberta(page);
  await expect(confirmacao).toBeVisible();
  await confirmacao.getByTestId('confirmar-acao').click();
  await expect(confirmacao).toHaveCount(0);
};

/** The comando of the page (or of `escopo`) is done: its aviso is filled, and no falha. */
export const feito = async (escopo: Page | Locator) => {
  await expect(escopo.getByTestId('aviso-feito')).not.toBeEmpty();
  await expect(escopo.getByTestId('aviso-falha')).toHaveCount(0);
};

/** Answer of the API to a request: the status and the JSON body, if any. */
export type Resposta = { readonly status: number; readonly corpo: unknown };

/**
 * Calls the API with the page's session (the token the web keeps in sessionStorage), for what
 * the web does not show or does not let the person try: `pedido` is like `POST /api/usuario`.
 */
export const chamarApi = (page: Page, pedido: string, corpo?: unknown): Promise<Resposta> => {
  const [metodo, caminho] = pedido.split(' ');
  return page.evaluate(
    async ({ metodo, caminho, corpo }) => {
      const chave = Object.keys(sessionStorage).find((k) => k.startsWith('oidc.user:')) ?? '';
      const { access_token } = JSON.parse(sessionStorage.getItem(chave) ?? '{}');
      const r = await fetch(caminho ?? '', {
        method: metodo ?? 'GET',
        headers: {
          authorization: `Bearer ${access_token}`,
          ...(corpo === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: corpo === undefined ? null : JSON.stringify(corpo),
      });
      return { status: r.status, corpo: await r.json().catch(() => undefined) };
    },
    { metodo, caminho, corpo },
  );
};

/** Reads a recurso of the API with the page's session. */
export const lerApi = async <T>(page: Page, caminho: string) =>
  (await chamarApi(page, `GET ${caminho}`)).corpo as T;

/** A participante's crédito or pendência, as read from the API. */
export type Situacao = {
  readonly id: string;
  readonly participando: boolean;
  readonly creditoEmCentavos: number;
  readonly pendenciaEmCentavos: number;
  readonly cotas: readonly { readonly mes: string; readonly valorEmCentavos: number }[];
};

/** The logged-in participante's crédito minus pendência, in centavos. */
export const saldoDe = async (page: Page) => {
  const s = await lerApi<Situacao>(page, '/api/financeiro/participante/eu');
  return s.creditoEmCentavos - s.pendenciaEmCentavos;
};

/** The saldo da caixinha, in centavos. */
export const saldoDaCaixinha = async (page: Page) =>
  (await lerApi<{ saldoEmCentavos: number }>(page, '/api/financeiro/caixinha')).saldoEmCentavos;

/** A valor in centavos as the web writes it, like `R$ 20,00`. */
export const emReais = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);

/** Subjects of the e-mails to `email`, only those mentioning every one of `textos`. */
export const assuntosDosEmails = async (
  email: string,
  ...textos: readonly string[]
): Promise<readonly string[]> => {
  const query = [`to:${email}`, ...textos.map((t) => `"${t}"`)].join(' ');
  const r = await fetch(`${MAILPIT}/api/v1/search?${new URLSearchParams({ query })}`);
  return (await r.json()).messages.map((m: { Subject: string }) => m.Subject);
};

/** The valor of each tipo de cota of the year in the tests. */
export const VALOR_DA_COTA: Readonly<Record<TipoDeCota, string>> = {
  'so-cafe': '20,00',
  completa: '30,00',
};

/**
 * The gestor defines the valor of each tipo de cota of the year as {@link VALOR_DA_COTA}. Once per
 * ano: another test, on the same stack, may have defined it already.
 */
export const garantirValorDaCota = (gestor: Page) =>
  test.step('Valor da cota do ano: Só café R$ 20,00 e Completa R$ 30,00', async () => {
    await gestor.goto('/valor-da-cota');
    const definicao = gestor.getByTestId('definicao-do-valor-da-cota');
    const ano = String(new Date().getFullYear());
    // Once this year's and the next's are defined, the page has nothing left to define.
    await expect(definicao.or(gestor.getByTestId('valores-definidos'))).toBeVisible();
    // While a tipo de cota of this year is missing, the page defines this year's.
    if ((await definicao.count()) > 0 && (await definicao.getAttribute('data-ano')) === ano) {
      for (const [tipo, valor] of Object.entries(VALOR_DA_COTA)) {
        const campo = definicao.getByTestId(`valor-${tipo}`);
        if (await campo.isVisible()) await campo.fill(valor);
      }
      await definicao.getByTestId('definir-valor-da-cota').click();
      await confirmarAcao(gestor);
      await feito(gestor);
      // Then the next year's, empty: not with the valores just typed.
      await expect(definicao).toHaveAttribute('data-ano', String(Number(ano) + 1));
      for (const tipo of Object.keys(VALOR_DA_COTA))
        await expect(definicao.getByTestId(`valor-${tipo}`)).toHaveValue('');
    }
    await gestor.goto('/caixinha');
    const valores = gestor.getByTestId('valores-da-cota');
    await expect(valores).toHaveAttribute('data-ano', ano);
    for (const [tipo, valor] of Object.entries(VALOR_DA_COTA))
      await expect(valores.getByTestId(`valor-da-cota-${tipo}`)).toHaveText(reais(valor));
  });

/** The cotas of the logged-in participante, in *Minha situação*. */
export const cotas = (participante: Page) => participante.getByTestId('cota');

/**
 * *Todo início de mês*: the agendador fires it on start (ADR 0017); the trigger is internal. Then
 * it asks Notificação to avisar the pendentes, before Financeiro has the cotas (ADR 0027).
 */
export const iniciarOMes = () =>
  test.step('Todo início de mês: reiniciar o agendador', () => {
    execFileSync('docker', ['restart', E2E_AGENDADOR]);
  });

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];

/** A PNG to upload: the headless Chromium downloads a PDF instead of opening it. */
export const png = (name: string) => ({ name, mimeType: 'image/png', buffer: Buffer.from(PNG) });

/** The gestor opens *Receber pagamento*, under *Participantes*. */
export const irParaReceberPagamento = async (gestor: Page) => {
  await gestor.goto('/participantes/receber-pagamento');
  const recebimento = gestor.getByTestId('recebimento');
  await expect(recebimento).toBeVisible();
  return recebimento;
};

/** The gestor receives a pagamento em dinheiro from `nome`, in *Receber pagamento*. */
export const receberEmDinheiro = (gestor: Page, nome: string, valor: string) =>
  test.step(`Gestor recebe R$ ${valor} em dinheiro de ${nome}`, async () => {
    await irParaReceberPagamento(gestor);
    const recebimento = gestor.getByTestId('recebimento');
    await recebimento.getByTestId('escolha-do-participante').selectOption({ label: nome });
    await recebimento.getByTestId('valor').fill(valor);
    await recebimento.getByTestId('forma-dinheiro').check();
    await recebimento.getByTestId('receber-pagamento').click();
    await feito(gestor);
  });

/** The participante's *Comprovantes*, once Financeiro has learned of the entrada. */
export const comprovantesDe = async (participante: Page) => {
  const comprovantes = participante.getByTestId('comprovantes');
  await recarregarAte(participante, comprovantes);
  return comprovantes;
};

/** The participante's comprovantes enviados. */
export const enviados = (participante: Page) => participante.getByTestId('comprovante-enviado');

/** The comprovante enviado of `valor` (like `30,00`). */
export const enviadoDe = (participante: Page, valor: string) =>
  enviados(participante).filter({ hasText: reais(valor) });

/**
 * The participante envia a comprovante of `valor` (like `30,00`) in *Enviar comprovante*, and is
 * back in *Minha situação*.
 */
export const enviarComprovante = (participante: Page, valor: string) =>
  test.step(`Participante envia um comprovante de R$ ${valor}`, async () => {
    await comprovantesDe(participante);
    await participante.getByTestId('ir-enviar-comprovante').click();
    const envio = participante.getByTestId('envio-de-comprovante');
    await envio.getByTestId('valor').fill(valor);
    await envio.getByTestId('arquivo').setInputFiles(png('pix.png'));
    await envio.getByTestId('enviar-comprovante').click();
    await expect(enviadoDe(participante, valor)).toHaveAttribute('data-situacao', 'a-confirmar');
  });

/** The gestor opens *Conferir comprovante*, with every comprovante a confirmar. */
export const conferirComprovantes = (gestor: Page) =>
  gestor.goto('/participantes/conferir-comprovante');

/** The comprovante a confirmar of `nome` and `valor`, in the gestor's *Conferir comprovante*. */
export const aConfirmar = (gestor: Page, nome: string, valor: string) =>
  gestor
    .getByTestId('comprovante-a-confirmar')
    .filter({ hasText: nome })
    .filter({ hasText: reais(valor) });

/**
 * The gestor, in *Conferir comprovante*, picks the comprovante of `nome` and `valor`: its
 * conferência, as loaded when the page opened.
 */
export const conferir = async (gestor: Page, nome: string, valor: string) => {
  const comprovante = aConfirmar(gestor, nome, valor);
  await comprovante.getByTestId('conferir').click();
  // The conferência changes with the one picked, marked in the list.
  await expect(comprovante).toHaveAttribute('data-atual', 'sim');
  return gestor.getByTestId('conferencia');
};

/** The gestor confirma the comprovante of `nome` and `valor`, with the valor `confirmado`. */
export const confirmarComprovante = (
  gestor: Page,
  nome: string,
  valor: string,
  confirmado = valor,
) =>
  test.step(`Gestor confirma o comprovante de R$ ${valor} com R$ ${confirmado}`, async () => {
    const conferencia = await conferir(gestor, nome, valor);
    await conferencia.getByTestId('valor').fill(confirmado);
    // After the valor: correcting it unchecks its step (RN-FIN-36).
    for (const item of await conferencia.getByTestId('item-a-conferir').all()) await item.check();
    await conferencia.getByTestId('confirmar').click();
  });

/**
 * The gestor recusa the comprovante of `nome` and `valor`, with the `motivo`: typed, or picked
 * among the motivos comuns.
 */
export const recusarComprovante = (
  gestor: Page,
  nome: string,
  valor: string,
  motivo: string,
  { comum = false } = {},
) =>
  test.step(`Gestor recusa o comprovante de R$ ${valor}: ${motivo}`, async () => {
    const conferencia = await conferir(gestor, nome, valor);
    await conferencia.getByTestId('abrir-recusa').click();
    if (comum) await conferencia.getByTestId('motivo-comum').filter({ hasText: motivo }).click();
    else await conferencia.getByTestId('motivo').fill(motivo);
    await expect(conferencia.getByTestId('motivo')).toHaveValue(motivo);
    await conferencia.getByTestId('recusar').click();
    await feito(gestor);
    await expect(aConfirmar(gestor, nome, valor)).toHaveCount(0);
  });

/** Tipo de gasto, as the API names it. */
export type TipoDeGasto = 'cafe' | 'outros-itens' | 'conserto-e-manutencao' | 'reposicao';

/** The gestor registers a gasto in *Registrar gasto*, with a nota, and is back in *Gastos*. */
export const registrarGasto = (
  gestor: Page,
  {
    tipo,
    valor,
    origem,
  }: {
    readonly tipo: TipoDeGasto;
    readonly valor: string;
    readonly origem: 'caixinha' | 'proprio-bolso';
  },
) =>
  test.step(`Gestor registra um gasto de R$ ${valor} (${tipo}) pago com ${origem}`, async () => {
    await gestor.goto('/gastos');
    await expect(pagina(gestor, 'gastos')).toBeVisible();
    await expect(gestor.getByTestId('carregando')).toHaveCount(0);
    const antes = await gestor.getByTestId('gasto').count();
    await gestor.goto('/gastos/registrar-gasto');
    const registro = gestor.getByTestId('registro-de-gasto');
    await registro.getByTestId('tipo-de-gasto').selectOption(tipo);
    await registro.getByTestId('valor').fill(valor);
    await registro.getByTestId(`origem-${origem}`).check();
    await registro.getByTestId('arquivo').setInputFiles(png('nota.png'));
    await registro.getByTestId('registrar-gasto').click();
    await feito(gestor);
    await expect(gestor.getByTestId('gasto')).toHaveCount(antes + 1);
  });

/** The gasto of `valor` (like `12,34`) paid by `nome`, in the gestor's *Gastos*. */
export const gastoDe = (gestor: Page, nome: string, valor: string) =>
  gestor
    .getByTestId('gasto')
    .filter({ hasText: nome })
    .filter({ hasText: reais(valor) });

/** The gestor reembolsa the gasto of `valor` paid by `nome` do próprio bolso. */
export const reembolsar = (gestor: Page, nome: string, valor: string) =>
  test.step(`Gestor reembolsa o gasto de R$ ${valor} de ${nome}`, async () => {
    await gestor.goto('/gastos');
    const gasto = gastoDe(gestor, nome, valor);
    await gasto.getByTestId('reembolsar').click();
    await confirmarAcao(gestor);
    await expect(gasto).toHaveAttribute('data-reembolsado', 'true');
  });

/**
 * A participante registers a gasto pago do próprio bolso through the API, to set up a test. The
 * status of the registro.
 */
export const registrarGastoPelaApi = async (participante: Page, valorEmCentavos: number) => {
  const notaId = await participante.evaluate(async (bytes) => {
    const chave = Object.keys(sessionStorage).find((k) => k.startsWith('oidc.user:')) ?? '';
    const { access_token } = JSON.parse(sessionStorage.getItem(chave) ?? '{}');
    const nota = new FormData();
    nota.append('arquivo', new File([new Uint8Array(bytes)], 'nota.png', { type: 'image/png' }));
    const guardada = await fetch('/api/financeiro/guardar-nota', {
      method: 'POST',
      headers: { authorization: `Bearer ${access_token}` },
      body: nota,
    });
    return (await guardada.json()).id;
  }, PNG);
  const { status } = await chamarApi(participante, 'POST /api/financeiro/registrar-gasto', {
    valorEmCentavos,
    origem: 'proprio-bolso',
    tipo: 'cafe',
    notaId,
  });
  return status;
};
