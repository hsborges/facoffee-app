import amqp from 'amqp-connection-manager';
import type { Logger } from './logger.js';

/** Topic exchange of all domain events (ADR 0006). */
export const EXCHANGE = 'facoffee.events';

/** Connection to RabbitMQ that reconnects on its own and logs connects and disconnects. */
export const connectRabbitmq = (url: string, logger: Logger) => {
  const connection = amqp.connect([url]);
  connection.on('connect', () => logger.info('connected to rabbitmq'));
  connection.on('disconnect', ({ err }) =>
    logger.warn('disconnected from rabbitmq', { error: err }),
  );
  return connection;
};
