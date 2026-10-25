import amqp, { type AmqpConnectionManager } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import type { Event } from '../domain/event.js';
import type { Logger } from './logger.js';

// Topology from ADR 0004.
export const EXCHANGE = 'facoffee.eventos';
export const routingKey = (event: Pick<Event, 'tipo' | 'versao'>) =>
  `${event.tipo}.v${event.versao}`;

export const connectRabbitmq = (url: string, logger: Logger) => {
  const connection = amqp.connect([url]);
  connection.on('connect', () => logger.info('connected to rabbitmq'));
  connection.on('disconnect', ({ err }) =>
    logger.warn('disconnected from rabbitmq', { error: err }),
  );
  return connection;
};

// Publisher confirms: the promise resolves only after the broker acknowledges the message.
export const createPublisher = (connection: AmqpConnectionManager) => {
  const channel = connection.createChannel({
    publishTimeout: 5000,
    setup: (ch: ConfirmChannel) => ch.assertExchange(EXCHANGE, 'topic', { durable: true }),
  });
  return {
    publish: async (rk: string, event: unknown) => {
      const { id, tipo } = event as Event;
      await channel.publish(EXCHANGE, rk, Buffer.from(JSON.stringify(event)), {
        persistent: true,
        contentType: 'application/json',
        messageId: id,
        type: tipo,
      });
    },
    close: () => channel.close(),
  };
};
