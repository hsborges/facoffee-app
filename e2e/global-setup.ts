import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DockerComposeEnvironment } from 'testcontainers';

const INFRA = fileURLToPath(new URL('../infra', import.meta.url));
const RESULTADOS = fileURLToPath(new URL('../test-results', import.meta.url));

// A new stack per run, from infra/docker-compose.test.yml (business services behind the gateway).
// The tests get its ports and the agendador from the environment, inherited by the workers.
// Fixed, so each run reuses the images (named after the project) instead of piling up new ones.
const projeto = 'facoffee-e2e';

const log = (mensagem: string) => console.log(`[e2e] ${mensagem}`);

// Kept for a failure, since the stack is gone after the run.
const guardarLogs = () => {
  mkdirSync(RESULTADOS, { recursive: true });
  writeFileSync(
    `${RESULTADOS}/compose.log`,
    execFileSync('docker', ['compose', '-p', projeto, 'logs', '--no-color'], {
      maxBuffer: 256 * 1024 * 1024,
    }),
  );
};

export default async () => {
  const inicio = Date.now();
  // An interrupted run (Ctrl+C, a crash) leaves the volumes behind; the tests need a clean stack.
  log(`Removendo o que sobrou de uma execução anterior de ${projeto}...`);
  execFileSync('docker', ['compose', '-p', projeto, 'down', '-v', '--remove-orphans'], {
    stdio: 'ignore',
  });
  log(`Subindo a stack ${projeto} (build das imagens e healthchecks, cerca de 2 minutos)...`);
  const stack = await new DockerComposeEnvironment(INFRA, [
    'docker-compose.dev.yml',
    'docker-compose.test.yml',
  ])
    .withProjectName(projeto)
    .withBuild()
    // Waits for the healthchecks, as docker compose up --wait.
    .withClientOptions({ commandOptions: ['--wait'] })
    .up()
    .catch((erro) => {
      // A container that never got healthy: its logs say why. Ryuk removes the stack.
      log('A stack não subiu; os logs dos contêineres ficam em test-results/compose.log');
      guardarLogs();
      throw erro;
    });
  process.env.E2E_PORTA_WEB = String(stack.getContainer('gateway-1').getMappedPort(80));
  process.env.E2E_PORTA_KEYCLOAK = String(stack.getContainer('keycloak-1').getMappedPort(8080));
  process.env.E2E_PORTA_MAILPIT = String(stack.getContainer('mailpit-1').getMappedPort(8025));
  process.env.E2E_AGENDADOR = stack.getContainer('agendador-1').getId();
  log(`Stack pronta em ${Math.round((Date.now() - inicio) / 1000)}s:`);
  log(
    `  gateway  http://127.0.0.1:${process.env.E2E_PORTA_WEB} (no Chromium do teste, http://localhost)`,
  );
  log(`  Keycloak http://127.0.0.1:${process.env.E2E_PORTA_KEYCLOAK}`);
  log(`  Mailpit  http://127.0.0.1:${process.env.E2E_PORTA_MAILPIT}`);

  return async () => {
    log('Removendo a stack; os logs dos contêineres ficam em test-results/compose.log');
    try {
      guardarLogs();
    } finally {
      await stack.down();
    }
    log('Stack removida');
  };
};
