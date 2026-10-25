import { readConfig } from './infra/config.js';
import { createLogger } from './infra/logger.js';
import { startService } from './service.js';

const config = readConfig(process.env);
if (!config.ok) {
  createLogger(process.env.SERVICE ?? 'service').error('invalid configuration', {
    errors: config.error,
  });
  process.exit(1);
}

const logger = createLogger(config.value.service);
const service = await startService(config.value, logger);

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    logger.info('shutting down', { signal });
    service.stop().then(
      () => process.exit(0),
      (error) => {
        logger.error('failed to shut down', { error });
        process.exit(1);
      },
    );
  });
}
