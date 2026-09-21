import amqp from "amqp-connection-manager";
import { EventRoutingKey } from "../events/routing-keys";
import { EventBusService } from "./event-bus.service";

jest.mock("amqp-connection-manager");

describe("EventBusService", () => {
  const channel = {
    waitForConnect: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const connection = {
    on: jest.fn(),
    createChannel: jest.fn(() => channel),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const connect = amqp.connect as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    connect.mockReturnValue(connection);
  });

  it("lets a consumer subscribe before the bus's own init hook has run", async () => {
    const bus = new EventBusService();

    // Nest can run a consumer's onModuleInit first when its module ties with
    // EventBusModule on distance; this used to throw on an undefined connection.
    await bus.subscribe("test.queue", [EventRoutingKey.GOODS_RECEIVED], async () => undefined);
    await bus.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("connects only once however many callers arrive", async () => {
    const bus = new EventBusService();

    await Promise.all([
      bus.onModuleInit(),
      bus.subscribe("a", [EventRoutingKey.GOODS_RECEIVED], async () => undefined),
      bus.subscribe("b", [EventRoutingKey.STOCK_LOW], async () => undefined),
      bus.publish(EventRoutingKey.STOCK_LOW, { ok: true }),
    ]);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(channel.publish).toHaveBeenCalledTimes(1);
  });
});
