import amqp, { type AmqpConnectionManager } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import type { Event } from '../domain/event.js';
import type { Logger } from './logger.js';

/** Topic exchange of all domain events (ADR 0006). */
export const EXCHANGE = 'facoffee.events';
/** Routing key of an event: `<type>.v<version>` (ADR 0006). */
export const routingKey = (event: Pick<Event, 'type' | 'version'>) =>
  `${event.type}.v${event.version}`;

/** Connection to RabbitMQ that reconnects on its own and logs connects and disconnects. */
export const connectRabbitmq = (url: string, logger: Logger) => {
  const connection = amqp.connect([url]);
  connection.on('connect', () => logger.info('connected to rabbitmq'));
  connection.on('disconnect', ({ err }) =>
    logger.warn('disconnected from rabbitmq', { error: err }),
  );
  return connection;
};

/**
 * Publishes persistent JSON events to {@link EXCHANGE}.
 * Publisher confirms: the promise resolves only after the broker acknowledges the message.
 */
export const createPublisher = (connection: AmqpConnectionManager) => {
  const channel = connection.createChannel({
    publishTimeout: 5000,
    setup: (ch: ConfirmChannel) => ch.assertExchange(EXCHANGE, 'topic', { durable: true }),
  });
  return {
    publish: async (rk: string, event: unknown) => {
      const { id, type } = event as Event;
      await channel.publish(EXCHANGE, rk, Buffer.from(JSON.stringify(event)), {
        persistent: true,
        contentType: 'application/json',
        messageId: id,
        type,
      });
    },
    close: () => channel.close(),
  };
};
