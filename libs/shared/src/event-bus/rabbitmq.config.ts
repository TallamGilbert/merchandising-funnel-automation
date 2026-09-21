/**
 * Reads the RabbitMQ connection + exchange settings that every service uses
 * to talk to the shared `mms.events` topic exchange. Values come from the
 * environment (see root `.env.example`); no service hardcodes them.
 */
export interface RabbitMqConfig {
  url: string;
  exchange: string;
}

export function loadRabbitMqConfig(): RabbitMqConfig {
  const user = process.env.RABBITMQ_USER ?? "mms";
  const password = process.env.RABBITMQ_PASSWORD ?? "mms_dev_password";
  const host = process.env.RABBITMQ_HOST ?? "localhost";
  const port = process.env.RABBITMQ_PORT ?? "5672";
  const exchange = process.env.RABBITMQ_EXCHANGE ?? "mms.events";

  return {
    url: `amqp://${user}:${password}@${host}:${port}`,
    exchange,
  };
}
