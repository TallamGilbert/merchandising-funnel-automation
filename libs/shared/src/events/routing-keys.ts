/**
 * Central registry of domain-event routing keys used on the `mms.events`
 * topic exchange (RabbitMQ). Publishers and consumers both import from here
 * so a typo can't silently create a dead-letter routing key.
 */
export const EventRoutingKey = {
  PURCHASE_ORDER_APPROVED: "purchase-order.approved",
  GOODS_RECEIVED: "goods-received",
  STOCK_LOW: "stock-low",
  STOCK_TRANSFERRED: "stock-transferred",
  ITEM_SOLD: "item-sold",
  ITEM_RETURNED: "item-returned",
  DAY_CLOSED: "day-closed",
} as const;

export type EventRoutingKey =
  (typeof EventRoutingKey)[keyof typeof EventRoutingKey];
