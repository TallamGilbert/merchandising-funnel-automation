"use client";

import { useEffect, useMemo, useState } from "react";
import { Combobox, formatDate, formatDateTime, formatMoney } from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { DateRange, defaultRange, type Range } from "../../components/DateRange";
import { type Account, api, type EntrySource, type JournalEntry, SOURCE_LABEL, type TrialBalance } from "../../lib/financials-client";
import { NAV } from "../../lib/nav";

type Tab = "journal" | "trial-balance";

export default function LedgerPage() {
  const [tab, setTab] = useState<Tab>("journal");
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    api.accounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  return (
    <AppShell
      brandName="Finance"
      nav={NAV}
      title="General ledger"
      subtitle="Every posting, double-entry: each entry's debits equal its credits. Entries are never edited — corrections are new entries."
    >
      <div className="actions" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "journal"} className={tab === "journal" ? "primary" : undefined} onClick={() => setTab("journal")}>
          Journal
        </button>
        <button type="button" role="tab" aria-selected={tab === "trial-balance"} className={tab === "trial-balance" ? "primary" : undefined} onClick={() => setTab("trial-balance")}>
          Trial balance
        </button>
      </div>
      {tab === "journal" ? <Journal accounts={accounts} /> : <TrialBalanceView />}
    </AppShell>
  );
}

function Journal({ accounts }: { accounts: Account[] }) {
  const [range, setRange] = useState<Range>(defaultRange);
  const [accountCode, setAccountCode] = useState("");
  const [source, setSource] = useState<EntrySource | "">("");
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.code, a.name])), [accounts]);

  useEffect(() => {
    api
      .entries({ ...range, accountCode: accountCode || undefined, source: source || undefined })
      .then((rows) => {
        setEntries(rows);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, [range.from, range.to, accountCode, source]);

  return (
    <>
      <DateRange value={range} onChange={setRange} />
      <div className="field-row">
        <label>
          Account
          <Combobox
            clearable
            placeholder="All accounts"
            options={accounts.map((a) => ({ value: a.code, label: `${a.code} ${a.name}`, description: a.type.toLowerCase() }))}
            value={accountCode}
            onChange={setAccountCode}
          />
        </label>
        <label>
          Source
          <select value={source} onChange={(e) => setSource(e.target.value as EntrySource | "")}>
            <option value="">Everything</option>
            {(Object.keys(SOURCE_LABEL) as EntrySource[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      {entries === null ? (
        <p className="muted">Loading entries…</p>
      ) : entries.length === 0 ? (
        <p className="card muted">No entries match.</p>
      ) : (
        <>
          {entries.length === 200 && <p className="muted" style={{ margin: 0 }}>Showing the latest 200 — narrow the dates to see older entries.</p>}
          {entries.map((entry) => (
            <div className="card" key={entry.id} style={{ gap: "0.6rem" }}>
              <div className="row-between">
                <div>
                  <strong>#{entry.sequence} · {entry.description}</strong>
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    {formatDateTime(entry.occurredAt)} · {SOURCE_LABEL[entry.source]} <code>{entry.sourceRef}</code>
                  </div>
                </div>
                <span className="badge">{SOURCE_LABEL[entry.source]}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Memo</th>
                    <th className="num">Debit</th>
                    <th className="num">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.lines.map((line) => (
                    <tr key={line.id}>
                      <td style={{ paddingLeft: Number(line.credit) > 0 ? "2rem" : undefined }}>
                        {line.accountCode} {accountName.get(line.accountCode) ?? ""}
                      </td>
                      <td className="muted">{line.memo ?? ""}</td>
                      <td className="num">{Number(line.debit) > 0 ? formatMoney(line.debit) : ""}</td>
                      <td className="num">{Number(line.credit) > 0 ? formatMoney(line.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function TrialBalanceView() {
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [tb, setTb] = useState<TrialBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .trialBalance(asOf)
      .then((result) => {
        setTb(result);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, [asOf]);

  return (
    <>
      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          As of
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </label>
        {tb && (
          <span className={`badge ${tb.balanced ? "ok" : "danger"}`}>
            {tb.balanced ? "Debits equal credits" : "Out of balance — investigate"}
          </span>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {tb && (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th className="num">Debits</th>
                <th className="num">Credits</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {tb.rows.map((r) => (
                <tr key={r.code} style={r.debit === 0 && r.credit === 0 ? { opacity: 0.55 } : undefined}>
                  <td>
                    {r.code} {r.name}
                  </td>
                  <td className="muted">{r.type.toLowerCase()}</td>
                  <td className="num">{formatMoney(r.debit)}</td>
                  <td className="num">{formatMoney(r.credit)}</td>
                  <td className="num">{formatMoney(r.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th />
                <th className="num">{formatMoney(tb.totalDebit)}</th>
                <th className="num">{formatMoney(tb.totalCredit)}</th>
                <th />
              </tr>
            </tfoot>
          </table>
          <p className="muted" style={{ padding: "0 0.9rem 0.9rem", margin: 0, fontSize: "0.8rem" }}>
            Balances are shown on each account&apos;s normal side: assets and expenses as debits, liabilities and revenue as credits. As of the
            end of {formatDate(asOf)}.
          </p>
        </div>
      )}
    </>
  );
}
