import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import amqp, {
  AmqpConnectionManager,
  ChannelWrapper,
} from "amqp-connection-manager";
import type { ConsumeMessage } from "amqplib";
import { loadRabbitMqConfig } from "./rabbitmq.config";
import type { EventRoutingKey } from "../events/routing-keys";

export type EventHandler<T = unknown> = (
  payload: T,
  routingKey: string,
) => Promise<void>;

/**
 * Thin wrapper around a durable RabbitMQ topic exchange (`mms.events`).
 * Publishers call `publish()` and never know or care who is listening
 * (per the brief's event-bus principle). Consumers call `subscribe()` with
 * their own durable, named queue — so if a service is down when an event is
 * published, the event waits in its queue until the service reconnects
 * (NFR-3 resilience). Contains no domain/business logic.
 */
@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private connection!: AmqpConnectionManager;
  private publishChannel!: ChannelWrapper;
  private readonly exchange: string;

  constructor() {
    this.exchange = loadRabbitMqConfig().exchange;
  }

  async onModuleInit(): Promise<void> {
    const { url } = loadRabbitMqConfig();
    this.connection = amqp.connect([url]);
    this.connection.on("connect", () =>
      this.logger.log(`Connected to RabbitMQ (${this.exchange})`),
    );
    this.connection.on("disconnect", (params) =>
      this.logger.warn(`Disconnected from RabbitMQ: ${params.err?.message}`),
    );

    this.publishChannel = this.connection.createChannel({
      json: false,
      setup: (channel: import("amqplib").ConfirmChannel) =>
        channel.assertExchange(this.exchange, "topic", { durable: true }),
    });
    await this.publishChannel.waitForConnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.publishChannel?.close();
    await this.connection?.close();
  }

  /** Publish a domain event onto the shared topic exchange. Never blocks on consumers. */
  async publish<T>(routingKey: EventRoutingKey, payload: T): Promise<void> {
    await this.publishChannel.publish(
      this.exchange,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true, contentType: "application/json" },
    );
  }

  /**
   * Subscribe a durable queue (survives service restarts) to one or more
   * routing keys. `queueName` should be unique per service + purpose, e.g.
   * `receiving.purchase-order-approved`.
   */
  async subscribe<T>(
    queueName: string,
    routingKeys: EventRoutingKey[],
    handler: EventHandler<T>,
  ): Promise<void> {
    const consumeChannel = this.connection.createChannel({
      json: false,
      setup: async (channel: import("amqplib").ConfirmChannel) => {
        await channel.assertExchange(this.exchange, "topic", {
          durable: true,
        });
        await channel.assertQueue(queueName, { durable: true });
        await Promise.all(
          routingKeys.map((key) =>
            channel.bindQueue(queueName, this.exchange, key),
          ),
        );
        await channel.consume(queueName, (msg: ConsumeMessage | null) =>
          this.handleMessage(channel, msg, handler),
        );
      },
    });
    await consumeChannel.waitForConnect();
  }

  private async handleMessage<T>(
    channel: import("amqplib").ConfirmChannel,
    msg: ConsumeMessage | null,
    handler: EventHandler<T>,
  ): Promise<void> {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString()) as T;
      await handler(payload, msg.fields.routingKey);
      channel.ack(msg);
    } catch (error) {
      this.logger.error(
        `Failed to process message on ${msg.fields.routingKey}: ${(error as Error).message}`,
      );
      // Requeue once; a real deployment would route to a dead-letter queue
      // after N retries. Kept simple here since this lib has no business logic.
      channel.nack(msg, false, !msg.fields.redelivered);
    }
  }
}
