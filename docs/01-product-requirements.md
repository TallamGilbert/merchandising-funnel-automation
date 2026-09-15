# Product Requirements Document
## Merchandising Funnel Automation — Distributed Merchandise Management System (MMS)

**Status:** Draft
**Source of truth:** `00-source-of-truth.md` (capstone brief)
**Working scenario:** Furniture retailer — central warehouse + multiple showrooms

---

## 1. Overview

### 1.1 Problem Statement
A retail business that buys goods from suppliers, stores them in a warehouse, and sells them across physical stores currently runs on spreadsheets, paper receipts, and manual data entry. This produces four recurring failures:

1. **No shared truth on stock** — warehouse, store, and spreadsheet counts disagree, causing stockouts and overselling.
2. **No procurement visibility** — purchase orders and approvals happen informally (hallway conversations, forwarded emails), with no audit trail.
3. **No receiving discipline** — goods arrive and are signed for without verification, so shortages/damage surface weeks later.
4. **No real-time financial picture** — accounting is entered manually after the fact, so profitability is always stale.

### 1.2 Product Vision
Build a distributed Merchandise Management System (MMS): eight independently deployable backend services, each owning one business domain and its own database, coordinating through REST, gRPC, and an event bus — plus the frontend each domain needs. The system digitally mirrors the physical and financial lifecycle of goods, from supplier to sale to ledger, in as close to real time as the underlying events allow.

### 1.3 Reference Business
To keep requirements concrete, the system is specified against a furniture retailer: one central warehouse, multiple showrooms (starting in Eldoret, expanding to additional branches), suppliers of raw materials/finished furniture, and walk-in retail customers. This maps 1:1 onto the module set below without altering any requirement — a different retail vertical (electronics, hardware, agrovet, etc.) would use the same modules unchanged.

---

## 2. Goals and Non-Goals

### 2.1 Goals
- Give every domain (vendors, purchasing, receiving, stock, warehouse space, sales, cash, accounting) a single authoritative owner.
- Make cross-domain communication explicit, contract-first, and network-based — never shared-database.
- Keep the system resilient to partial failure: a down service degrades gracefully, it does not take the rest of the system down with it.
- Make each domain's frontend usable by the actual role that touches it (buyer, dock worker, picker, cashier, store manager, accountant).
- Ship incrementally in four phases without ever merging code that breaks `main`.

### 2.2 Non-Goals (for this version)
- No e-commerce/online storefront — POS is in-person, counter-based only.
- No multi-currency or multi-country tax handling.
- No supplier-facing portal (suppliers are managed *by* Vendor Management, not logged-in users of it).
- No customer accounts, loyalty, or CRM features.
- No automated purchase order generation (Inventory publishes `StockLow`; a human still creates the PO in Procurement — no auto-ordering in v1).

---

## 3. User Personas

| Persona | Module(s) they use | Core need |
|---|---|---|
| Buyer / Purchasing manager | Procurement, Vendor Management | Know who to buy from, what it costs, and get orders approved fast |
| Back-office admin | Vendor Management | Keep supplier records accurate |
| Warehouse dock staff | Receiving | Verify a delivery matches the PO before accepting it |
| Warehouse picker / floor supervisor | Warehouse Operations | Know exactly where to put and find stock |
| Inventory / finance manager | Inventory | Trust the stock number and its valuation |
| Cashier | Retail Sales (POS) | Ring up a sale fast, with correct price and stock validation |
| Store manager | Sales Audit | Close the till with confidence, explain discrepancies |
| Accountant / executive | Financials | See real-time AP, revenue, and gross profit without manual entry |

---

## 4. Functional Requirements by Module

Each module below lists: domain boundary, what it must do, what it explicitly must not do, and its interaction contract with other modules (sync vs. event).

### 4.1 Vendor Management
**Boundary:** Authoritative source for "who do we buy from, and on what terms."

**Must:**
- FR-1.1: Maintain a complete profile per approved supplier (contact details, payment terms).
- FR-1.2: Track which products each supplier is authorized to supply, and at what cost.
- FR-1.3: Record agreed lead times per supplier.
- FR-1.4: Maintain a historical reliability record (on-time delivery history).
- FR-1.5: Expose supplier + pricing + terms data to Procurement on request (sync, REST).
- FR-1.6: Provide a web dashboard (Vendor Management Portal) to browse, add, edit, archive suppliers.

**Must not:** Decide when to order; track individual purchase orders.

**Consumes:** none.
**Publishes:** none.
**Serves (sync):** Procurement → supplier list, pricing, terms (REST).

### 4.2 Procurement
**Boundary:** The decision/commitment engine — what we intend to buy and what we've committed to pay.

**Must:**
- FR-2.1: Capture purchase intent: products, quantities, supplier, per PO.
- FR-2.2: Lock in unit cost and payment terms at PO creation time (frozen, not re-fetched later).
- FR-2.3: Enforce a value-based approval workflow — POs under a configurable threshold (e.g. KES 100,000) may be approved by a manager role; POs at or above the threshold require owner-level approval. A PO is invalid until the required role has approved it.
- FR-2.4: Track PO lifecycle state: Draft → Pending Approval → Approved → Sent → Partially Received → Closed.
- FR-2.5: Track remaining open quantity on partially received POs.
- FR-2.6: Publish `PurchaseOrderApproved` on approval.
- FR-2.7: Consume `StockLow` from Inventory and surface it as a reorder suggestion (human still creates the PO).
- FR-2.8: Provide a web dashboard (Procurement Dashboard) to create POs, route approvals, view open orders.

**Must not:** Handle physical goods arrival; check warehouse reality.

**Consumes (event):** `StockLow` (Inventory).
**Publishes (event):** `PurchaseOrderApproved`.
**Serves (sync):** Receiving → "is there an open approved PO for these items?" (REST).
**Calls (sync):** Vendor Management → supplier/pricing/terms (REST).

### 4.3 Receiving
**Boundary:** The validation point between what we ordered and what physically arrived.

**Must:**
- FR-3.1: Match physical goods at the dock against the approved PO (via Procurement).
- FR-3.2: Record exact received quantities, product codes, and condition.
- FR-3.3: Flag shortages, overages, and damage at time of scan.
- FR-3.4: Route damaged goods into a quarantine status — never into sellable stock. In v1, quarantine is a terminal flag only; no return-to-supplier or write-off workflow is built (see D-2).
- FR-3.5: Generate a formal Goods Received Note (GRN) as the system-of-record for possession.
- FR-3.6: Publish `GoodsReceived` once a GRN is finalized.
- FR-3.7: Consume `PurchaseOrderApproved` to know what deliveries to expect.
- FR-3.8: Provide a mobile/tablet-friendly Warehouse Receiving App with barcode scanning for dock staff.

**Must not:** Decide storage location; touch the financial ledger.

**Consumes (event):** `PurchaseOrderApproved`.
**Publishes (event):** `GoodsReceived`.
**Calls (sync):** Procurement → validate open PO exists (REST).

### 4.4 Inventory
**Boundary:** The single source of truth for how much stock exists, where, and its value.

**Must:**
- FR-4.1: Maintain perpetual real-time stock counts per product per location (warehouse, store backrooms).
- FR-4.2: Increase stock on `GoodsReceived`; decrease on `ItemSold` (and on approved returns).
- FR-4.3: Track On Hand, Allocated (reserved), and Available quantities as distinct values.
- FR-4.4: Track monetary valuation of stock on hand.
- FR-4.5: Serve real-time stock availability checks to Retail Sales — low-latency, synchronous (gRPC).
- FR-4.6: Publish `StockLow` when a product's Available quantity crosses a dynamic reorder threshold computed from its recent sales velocity (higher-velocity items get a higher trigger point) rather than a manually set static number.
- FR-4.7: Provide item attributes (dimensions, weight, sales velocity) to Warehouse Operations on request (REST).
- FR-4.8: Provide a web dashboard (Inventory Control Center) for stock browsing, manual adjustments, and valuation reporting.

**Must not:** Decide physical bin placement; process sales itself.

**Consumes (event):** `GoodsReceived`, `ItemSold`.
**Publishes (event):** `StockLow`.
**Serves (sync):** Retail Sales → stock check + reservation (gRPC); Warehouse Ops → item attributes/velocity (REST).

### 4.5 Warehouse Operations
**Boundary:** The physical geography of the warehouse — where things go and how they move.

**Must:**
- FR-5.1: Assign a specific bin/shelf/zone to every received product.
- FR-5.2: Direct putaway: tell a worker exactly where to place newly received stock.
- FR-5.3: Direct picking: tell a worker exactly where to retrieve stock for a transfer or order.
- FR-5.4: Manage and record stock transfers between physical locations (warehouse → showroom).
- FR-5.5: Track warehouse space capacity and utilization.
- FR-5.6: Consume `GoodsReceived` to trigger a putaway task automatically.
- FR-5.7: Confirm final bin location back to Inventory once putaway completes (sync, REST).
- FR-5.8: Provide a mobile/tablet Warehouse Floor App for pickers, forklift drivers, and supervisors.

**Must not:** Track overall stock quantity (Inventory's job); decide what to reorder.

**Consumes (event):** `GoodsReceived`.
**Calls (sync):** Inventory → item attributes/velocity (read), confirm bin location (write) (REST).

### 4.6 Retail Sales (POS)
**Boundary:** The transaction engine at the point of sale.

**Must:**
- FR-6.1: Serve accurate, current retail pricing and active promotions at checkout.
- FR-6.2: Validate item availability with Inventory before finalizing a sale (sync, gRPC — latency-sensitive).
- FR-6.3: Process a sale: products, quantities, discounts, taxes, total.
- FR-6.4: Process returns/exchanges, reversing the original sale and immediately returning stock to Available (no inspection step in v1 — see D-5).
- FR-6.5: Capture payment method(s): cash, card, gift card, or split.
- FR-6.6: Publish `ItemSold` immediately after a transaction completes.
- FR-6.7: Provide a fast, touch-friendly Point of Sale Terminal App for cashiers.

**Must not:** Track warehouse stock directly; reconcile the cash drawer.

**Publishes (event):** `ItemSold`.
**Calls (sync):** Inventory → stock check + reservation (gRPC).

### 4.7 Sales Audit
**Boundary:** Reconciliation of physical cash against recorded sales.

**Must:**
- FR-7.1: Calculate the expected total for the store from that day's transactions across all its registers/tills combined (via POS) — reconciliation is store-level, not per-register (see D-4).
- FR-7.2: Capture the store manager's physical count across all tills (cash, card slips, etc.), rolled up to one store-level figure.
- FR-7.3: Compute the discrepancy (over/short) per store and per cashier (for pattern detection), even though closing itself happens at the store level.
- FR-7.4: Block store close until a manager provides an explanation for any discrepancy.
- FR-7.5: Maintain a historical discrepancy log for pattern detection.
- FR-7.6: Publish `DayClosed` once a register is balanced and closed.
- FR-7.7: Consume `ItemSold` continuously to keep the expected total current.
- FR-7.8: Provide a Store Manager Dashboard for entering counts and closing registers.

**Must not:** Process the original sale; track inventory.

**Consumes (event):** `ItemSold`.
**Publishes (event):** `DayClosed`.
**Calls (sync):** Retail Sales → expected total across all registers for the store (REST).

### 4.8 Financials
**Boundary:** The automated bookkeeper — translates physical/sales events into accounting entries.

**Must:**
- FR-8.1: On `GoodsReceived`, record increased inventory assets and increased accounts payable.
- FR-8.2: On `ItemSold`, record decreased inventory assets, COGS, and revenue recognition.
- FR-8.3: On `DayClosed`, record any cash over/short as an expense/adjustment entry.
- FR-8.4: Track accounts payable balances and due dates per supplier.
- FR-8.5: Track revenue and gross profit at product, store, and business level.
- FR-8.6: Expose read-only financial reports (ledger, AP aging, profitability) via API.
- FR-8.7: Provide a Finance Portal web dashboard for accounting/execs.

**Must not:** Count physical inventory; sell products; decide what to order.

**Consumes (event):** `GoodsReceived`, `ItemSold`, `DayClosed`.

---

## 5. Cross-Module Interaction Summary

| From → To | Type | Purpose |
|---|---|---|
| Procurement → Vendor Management | REST (sync) | Get supplier list, pricing, terms |
| Receiving → Procurement | REST (sync) | Validate an open approved PO exists |
| Warehouse Ops → Inventory | REST (sync) | Get item attributes/velocity; confirm bin location |
| Sales Audit → Retail Sales | REST (sync) | Get expected register total |
| Retail Sales → Inventory | **gRPC (sync)** | Real-time stock check + reservation at checkout |
| Procurement → * | Event: `PurchaseOrderApproved` | Consumed by Receiving, Inventory, Financials |
| Receiving → * | Event: `GoodsReceived` | Consumed by Inventory, Warehouse Ops, Financials |
| Inventory → * | Event: `StockLow` | Consumed by Procurement |
| Retail Sales → * | Event: `ItemSold` | Consumed by Inventory, Sales Audit, Financials |
| Sales Audit → * | Event: `DayClosed` | Consumed by Financials |

**Principle governing all of the above:** each module shares only what other modules are allowed to know. Receiving never sees cost/value data. Financials never sees bin locations. Retail Sales never sees supplier identity. Domain boundaries are informational, not just technical.

---

## 6. Non-Functional Requirements

- **NFR-1 Database isolation:** No service may query another service's database directly, under any circumstance.
- **NFR-2 Independent deployability:** Each service ships and rolls back independently; a change to one module must never require redeploying another.
- **NFR-3 Resilience:** If a downstream consumer (e.g., Financials) is unavailable, publishers do not block, and the event bus queues events for it to consume on recovery.
- **NFR-4 Contract-first development:** OpenAPI specs and `.proto` files are written and reviewed before business logic is implemented.
- **NFR-5 Latency:** The Retail Sales → Inventory stock-check call must complete fast enough not to introduce perceptible checkout delay — this is the justification for gRPC over REST on that specific path.
- **NFR-6 Auditability:** PO approvals, GRN discrepancies, cash discrepancies, and every financial entry must be traceable to the event or action that caused them.
- **NFR-7 Testability:** Every module ships with unit and integration tests runnable in CI (GitHub Actions) before merge.

---

## 7. Delivery Phases

| Phase | Modules | Unlocks |
|---|---|---|
| **Phase 1 — Foundation** | Vendor Management, Procurement, Inventory | PO creation, approval, and stock querying — no physical warehouse or POS activity yet |
| **Phase 2 — Warehouse** | Receiving, Warehouse Operations | Truck-arrival → GRN → putaway flow; first real consumers of `GoodsReceived` |
| **Phase 3 — Retail** | Retail Sales, Sales Audit | Checkout, stock reservation, till reconciliation; `ItemSold`/`DayClosed` go live |
| **Phase 4 — Accounting** | Financials | Automated ledger entries across all prior events; system is feature-complete |

Each module is merged to `main` behind a feature flag before its phase begins, so incomplete modules can exist in the codebase without being exposed.

---

## 8. Definition of Done (per module)

A module is "Ready for Review" only when:
- Source lives in its correct monorepo directory.
- Its feature flag is correctly implemented and scoped to its phase.
- A PR is open against `main` with a focused, single-module diff.
- OpenAPI spec and/or `.proto` files are updated to match the implementation.
- Unit and integration tests pass in CI.
- Root `README.md` reflects the module's current status.

---

## 9. Decisions Log

| # | Question | Decision | Rationale | Affects |
|---|---|---|---|---|
| D-1 | PO approval authority | Value-based threshold — managers approve below a configurable limit (e.g. KES 100,000), owner approves at/above it | Keeps routine restocks fast while forcing oversight on large spend | FR-2.3 |
| D-2 | Quarantine disposition depth (v1) | Flag-only — damaged goods marked quarantined, no return-to-supplier/write-off workflow | Keeps Receiving's scope tight per the brief ("does not decide where to store," and disposition is arguably Procurement/Financials territory); can be added post-v1 | FR-3.4 |
| D-3 | StockLow threshold | Dynamic, computed from sales velocity rather than a static manual number | A fixed threshold under- or over-triggers as demand shifts seasonally; velocity-based keeps reorder timing realistic | FR-4.6 |
| D-4 | Multi-till reconciliation | Store-level close — all registers in a showroom roll up into one reconciliation and one close, not per-register | Matches how a single store manager actually closes a showroom at night; per-cashier discrepancy tracking is kept for pattern detection even though the close itself is store-wide | FR-7.1–7.4 |
| D-5 | POS returns | Returned stock re-added to Available immediately, no inspection step | Keeps returns simple for v1; can be hardened later if damaged-return abuse becomes a real problem | FR-6.4 |

This table is the record of every judgment call made beyond what the brief specified outright — future changes to any of these should update this log, not silently override it.

---

## 10. Traceability

Every functional requirement above (FR-x.x) maps directly to a "Requirements" line item in `00-source-of-truth.md`. Non-functional requirements map to the brief's "Architectural Mandate" and "Development Workflow & Standards" sections. No requirement in this document originates outside the source brief; the furniture-retailer framing is illustrative only and does not add or remove scope.
