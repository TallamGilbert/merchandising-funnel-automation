"use client";

import { useEffect, useState } from "react";
import { formatDateTime, useFlash, usePolling } from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { api, type InboxEvent, type InboxStatus } from "../../lib/financials-client";
import { NAV } from "../../lib/nav";

const EVENT_LABEL: Record<string, string> = {
  "goods-received": "Goods received",
  "item-sold": "Sale",
  "item-returned": "Refund",
  "day-closed": "Day close",
};

const STATUS_LABEL: Record<InboxStatus, string> = {
  NEEDS_ATTENTION: "Needs attention",
  PENDING: "Retrying",
  POSTED: "Posted",
};

/** What the event was about, in words — the document numbers people recognise. */
function describe(event: InboxEvent): string {
  const p = event.payload;
  switch (event.routingKey) {
    case "goods-received":
      return `${p.goodsReceivedNoteNumber} for ${p.poNumber}`;
    case "item-sold":
      return `Sale ${p.transactionId} at ${p.storeId}`;
    case "item-returned":
      return `Refund ${p.returnId} at ${p.storeId}`;
    case "day-closed":
      return `${p.storeId} close on ${p.businessDate}`;
    default:
      return event.eventId;
  }
}

export default function EventsPage() {
  const flash = useFlash();
  const [status, setStatus] = useState<InboxStatus | "">("NEEDS_ATTENTION");
  const [events, setEvents] = useState<InboxEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = () => {
    api
      .inbox(status || undefined)
      .then((rows) => {
        setEvents(rows);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };
  useEffect(load, [status]);
  usePolling(load, 15000);

  const retry = async (event: InboxEvent) => {
    setRetrying(event.eventId);
    try {
      const { result } = await api.retryEvent(event.eventId);
      if (result === "posted" || result === "already-posted") flash.success(`${describe(event)} posted to the ledger`);
      else if (result === "retry") flash.info(`${describe(event)} still can't reach a service — it will keep retrying`);
      else flash.error(`${describe(event)} still can't be posted — see the reason below`);
      load();
    } catch (err) {
      flash.error((err as Error).message);
    } finally {
      setRetrying(null);
    }
  };

  return (
    <AppShell
      brandName="Finance"
      nav={NAV}
      title="Posting issues"
      subtitle="Every event is stored before it's booked. Anything a service outage delayed retries on its own; anything that needs a person waits here."
    >
      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Show
          <select value={status} onChange={(e) => setStatus(e.target.value as InboxStatus | "")}>
            <option value="NEEDS_ATTENTION">Needs attention</option>
            <option value="PENDING">Retrying</option>
            <option value="POSTED">Posted</option>
            <option value="">Everything</option>
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card" style={{ padding: 0 }}>
        {events === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>Loading…</p>
        ) : events.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            {status === "NEEDS_ATTENTION" ? "Nothing needs attention — every event is in the books." : "No events here."}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Received</th>
                <th>Status</th>
                <th>Reason</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.eventId}>
                  <td>
                    {EVENT_LABEL[event.routingKey] ?? event.routingKey}
                    <div className="muted" style={{ fontSize: "0.78rem" }}>{describe(event)}</div>
                  </td>
                  <td>{formatDateTime(event.receivedAt)}</td>
                  <td>
                    <span className={`badge ${event.status === "POSTED" ? "ok" : event.status === "NEEDS_ATTENTION" ? "danger" : "warn"}`}>
                      {STATUS_LABEL[event.status]}
                    </span>
                    {event.status === "PENDING" && event.attempts > 0 && (
                      <div className="muted" style={{ fontSize: "0.78rem" }}>
                        {event.attempts} attempt{event.attempts === 1 ? "" : "s"} · next {formatDateTime(event.nextAttempt)}
                      </div>
                    )}
                  </td>
                  <td className="muted" style={{ maxWidth: 320 }}>{event.lastError ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    {event.status !== "POSTED" && (
                      <button disabled={retrying === event.eventId} onClick={() => retry(event)}>
                        {retrying === event.eventId ? "Retrying…" : "Retry now"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
