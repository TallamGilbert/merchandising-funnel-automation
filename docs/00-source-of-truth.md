# Capstone: Merchandising Funnel Automation

**Points:** 800
**Opens:** 9/7/2026, 8:00:00 AM
**Due:** 9/26/2026, 12:00:00 AM
**Closes:** 9/28/2026, 12:00:00 AM

> Your goal is to build the software backbone that eliminates this chaos.

You are tasked with building a distributed system that digitally mirrors the physical flow of goods and money through the retail business.

You are required to build a suite of small, independent backend services, not one giant monolith. You will deliberately avoid a single, massive codebase where the point-of-sale logic, warehouse logic, and accounting logic are tangled together. Divide the business into strict boundaries (domains).

---

## Architectural Mandate

### Distributed by Design

Your goal is to build a suite of small, independent backend services, not one giant monolith. You will deliberately avoid a single, massive codebase where the point-of-sale logic, warehouse logic, and accounting logic are tangled together.

Divide the business into strict boundaries (domains). You must treat these services as isolated islands.

### Database Isolation

Each service you build will own its own private database. The Inventory Service cannot reach into the Financials Service database to grab a journal entry.

### Communication Contract

The only way these islands communicate is over the network. How you choose to wire those connections is up to your architectural judgment, but you must decide based on the nature of the data being exchanged.

You have two primary tools in your toolbox for service-to-service communication. You must evaluate the needs of each interaction and choose the right tool for the job.

- **Tool A:** RESTful APIs (JSON over HTTP)
- **Tool B:** Protobufs (gRPC)

Note that both tools above are synchronous (the caller waits for a reply). However, much of your system will be asynchronous. When the Receiving Service processes a truckload of goods, it should not wait around for the Financials Service and the Inventory Service to finish their bookkeeping before telling the warehouse worker "Receipt Complete."

---

## The Modules You Will Build

### 1. Vendor Service

**The Business Problem This Solves:**
The business currently has supplier information scattered across emails, spreadsheets, and individual employees' heads. When someone needs to know what a supplier sells, how long they take to deliver, or what their payment terms are, there is no single place to look.

**Domain Purpose:**
This module is the authoritative record of who the business buys from. It exists to answer the question: "Who supplies our goods, and under what terms?"

**Core Domain Responsibilities:**
- Maintain a complete profile of every approved supplier, including how to contact them and how to pay them.
- Track which products each supplier is authorised to provide, and at what cost.
- Record the agreed-upon lead times (how long it takes a supplier to deliver after we place an order).
- Maintain a historical record of supplier reliability (Did they deliver on time?).

**What This Module Does NOT Do:**
- It does not decide when to order from a supplier.
- It does not track a specific purchase order.
- It simply knows who the suppliers are and what they offer.

### 2. Procurement (Purchasing) Service

**The Business Problem This Solves:**
Buyers currently create purchase orders in spreadsheets or on paper. There is no visibility into what has been ordered, what has been approved, or what is still waiting to arrive. Approvals happen via hallway conversations or forwarded emails, creating confusion and delays.

**Domain Purpose:**
This module is the decision and commitment engine. It exists to answer the question: "What are we committing to buy, how much will it cost us, and who approved it?"

**Core Domain Responsibilities:**
- Capture the intent to purchase: a formal request that lists specific products, quantities, and the supplier they will come from.
- Lock in the unit cost at the moment the order is created, so the business knows exactly what it expects to pay.
- Enforce an approval workflow. A purchase order is not valid until the right person with the right authority signs off on it.
- Track the lifecycle of an order: Is it still being drafted? Is it waiting for approval? Has it been sent to the supplier? Is it fully received and closed?

**What This Module Does NOT Do:**
- It does not handle the physical arrival of the goods.
- It does not check whether the items are actually in the warehouse.
- It only knows what the business intends to buy and what the business expects to pay.

### 3. Receiving (Inbound Goods) Service

**The Business Problem This Solves:**
When a truck arrives at the loading dock, the warehouse team currently unloads boxes and checks them off a paper list—or worse, just signs the delivery note without checking. Items get lost, miscounted, or accepted in damaged condition, and no one discovers the problem until weeks later during an inventory count.

**Domain Purpose:**
This module is the validation point between intent and reality. It exists to answer the question: "Did we actually receive what we ordered, in the right quantity, and in good condition?"

**Core Domain Responsibilities:**
- Match the physical items arriving at the dock against the approved purchase order from Procurement.
- Record exactly what was received, including quantities, product codes, and condition.
- Flag discrepancies immediately: items missing from the shipment (shortages), items sent that were not ordered (overages), and items that arrived damaged.
- Produce a formal Goods Received Note (GRN) — the official record that these goods have entered the business.

**What This Module Does NOT Do:**
- It does not decide where to store the items.
- It does not update the financial books directly.
- It only confirms that the business has legally taken possession of the goods.

### 4. Inventory (Stock Control) Service

**The Business Problem This Solves:**
The business currently has no idea how much stock it actually has at any given moment. The warehouse thinks there are ten units. The store thinks there are three. The spreadsheet says zero. Customers are told items are out of stock when they are sitting in a backroom, or items are oversold online when they do not physically exist.

**Domain Purpose:**
This module is the single source of truth for stock. It exists to answer the question: "How much of each product do we own, where is it physically located, and what is it worth?"

**Core Domain Responsibilities:**
- Maintain a perpetual, real-time count of every product across every physical location (main warehouse, store backrooms).
- Increase stock when goods are received.
- Decrease stock when goods are sold or returned.
- Track the monetary value of all stock on hand (inventory valuation).
- Distinguish between quantities that are physically available, quantities that are reserved for a pending order, and quantities that are still on order from a supplier.

**What This Module Does NOT Do:**
- It does not decide where within the warehouse a product should be placed.
- It does not process sales.
- It only knows how much stock exists and where it is located.

### 5. Warehouse Operations (Space & Movement) Service

**The Business Problem This Solves:**
The warehouse is a physical maze of aisles, shelves, and bins. Without guidance, workers put boxes wherever they find empty space. Weeks later, no one can find the item that the inventory system says is "somewhere in the warehouse." Picking orders for store replenishment takes hours because workers wander around searching for products.

**Domain Purpose:**
This module is the spatial brain of the warehouse. It exists to answer the question: "Where exactly do we put things, where do we find them, and how do we move them between locations?"

**Core Domain Responsibilities:**
- Assign specific, logical storage locations (bins, shelves, zones) for every product that arrives.
- Direct workers during putaway: telling them exactly where to place a newly received item so it can be found later.
- Direct workers during picking: telling them exactly where to go to retrieve items needed for a store transfer or a customer order.
- Manage the movement of stock between physical locations (e.g., moving 50 units from the central warehouse to Retail Store No.3).
- Track the capacity and utilization of warehouse space.

**What This Module Does NOT Do:**
- It does not track how much stock exists overall (that is Inventory's job).
- It does not order new stock.
- It only knows the physical geography of the building and directs the movement of goods within that space.

### 6. Retail Sales & Point of Sale (POS) Service

**The Business Problem This Solves:**
The retail storefront is where money enters the business. The cashier needs to know the correct price of an item, whether a discount applies, and whether the item can actually be sold. If the price is wrong or the system is slow, customers walk out. If the sale is not recorded properly, the business loses money and cannot track what it sold.

**Domain Purpose:**
This module is the transaction engine for the customer-facing storefront. It exists to answer the question: "What did we sell, to whom, at what price, and how did they pay?"

**Core Domain Responsibilities:**
- Provide accurate, current retail prices and promotions at the moment of checkout.
- Validate that an item is actually available to be sold before the transaction completes.
- Process sales: capturing the products, quantities, discounts, taxes, and final total for each transaction.
- Process returns and exchanges: reversing a previous sale and returning stock to inventory (if applicable).
- Capture how the customer paid: cash, credit card, gift card, or a combination.

**What This Module Does NOT Do:**
- It does not track how much stock is in the warehouse (it asks Inventory for that).
- It does not reconcile the cash drawer at the end of the day (that is Audit's job).
- It only captures the sale as it happens.

### 7. Sales Audit (Reconciliation) Service

**The Business Problem This Solves:**
At the end of the day, the store manager counts the cash in the register drawer. The POS system says the store should have taken in KES 500,000. The drawer only has KES 400,850. Is that a cashier mistake? Theft? A credit card processing error? Without a formal reconciliation process, these discrepancies go unnoticed or unresolved.

**Domain Purpose:**
This module is the control and accountability layer for the retail storefront. It exists to answer the question: "Does the money physically present in the store match what the sales system says it should be?"

**Core Domain Responsibilities:**
- Calculate the expected total for each cash register based on the sales transactions recorded by the POS module.
- Capture the physical count entered by the store manager (how much cash, how many credit card slips, etc.).
- Compare expected versus actual and calculate the difference (overage or shortage) for each register, each cashier, and each store.
- Require a manager's explanation and sign-off before a register can be closed for the day.
- Maintain a historical log of discrepancies to identify patterns (e.g., a specific cashier consistently coming up short).

**What This Module Does NOT Do:**
- It does not process the original sale.
- It does not track inventory.
- It only compares what the POS says happened against what physically happened in the cash drawer.

### 8. Financials (Accounting & Ledger) Service

**The Business Problem This Solves:**
The accounting team currently has to manually enter every transaction into a separate accounting system. When goods arrive, someone has to type in the value of the inventory and the amount owed to the supplier. When goods are sold, someone has to calculate the cost of those goods and enter the revenue. This is slow, prone to error, and means the business never has a real-time view of profitability.

**Domain Purpose:**
This module is the automated bookkeeper. It exists to answer the question: "What does the business own, what does it owe, and is it making money?"

**Core Domain Responsibilities:**
- Automatically record a financial entry when goods are received (increasing the value of inventory assets and increasing the amount owed to suppliers).
- Automatically record a financial entry when goods are sold (decreasing inventory assets and recognizing the cost of goods sold).
- Track accounts payable: how much money is owed to each supplier, and when those bills are due.
- Track revenue and gross profit at the product, store, and business level.
- Provide financial reports that management and accountants can rely on without having to manually reconcile spreadsheets.

**What This Module Does NOT Do:**
- It does not physically count inventory.
- It does not sell products.
- It does not decide what to order. It only translates the physical events happening elsewhere in the business (goods arriving, goods selling) into the language of accounting: debits, credits, assets, liabilities, revenue, and expenses.

---

## The Big Picture: How the Modules Work Together

Each module owns a distinct problem. None of them solve the whole business on their own. The power of the system comes from how they coordinate.

### Scenario 1: Placing a Purchase Order (Procurement + Vendor Management)

**The Business Goal:** A buyer needs to order 100 units of Product X from a supplier.

**The Interaction:**

Procurement → Vendor Management:
> "I am creating a Purchase Order. Give me the current list of approved suppliers and their pricing for Product X."

Vendor Management returns the list of suppliers, their lead times, and their current wholesale cost for Product X.

Procurement → Vendor Management:
> "I have selected Supplier A. Please confirm their current payment terms so I can lock them into this order."

Vendor Management confirms the terms (e.g., Net 30 days). Procurement now freezes those terms and prices onto the Purchase Order so they cannot change later.

Procurement → The Business (Announcement):
> "Purchase Order #1001 has been Approved for Supplier A. The business is now committed to receiving these goods."

**Who is listening:**
- Receiving listens so it knows to expect a delivery from Supplier A.
- Financials listens so it knows a future liability (Accounts Payable) is likely coming.
- Inventory listens so it can update its "Quantity on Order" figures (goods we own soon, but do not have yet).

### Scenario 2: The Truck Arrives at the Dock (Receiving + Procurement + Warehouse Ops + Inventory + Financials)

**The Business Goal:** A delivery truck from Supplier A arrives at the warehouse. The receiving team must verify the goods, store them, and account for them.

**The Interaction:**

Receiving → Procurement:
> "Here is the supplier's delivery note. Is there an open, approved Purchase Order for these items?"

Procurement responds: "Yes, Purchase Order #1001 is open. Here is the list of items and quantities we are expecting."

Receiving validates the physical goods: The Receiving team scans items, compares the scanned quantity against the PO data. It identifies a shortage (we ordered 100, they sent 95) and flags it immediately.

Receiving → The Business (Announcement):
> "Goods Received. We have formally taken possession of 95 units of Product X. 5 units are missing. We have generated GRN #500."

**Who is listening:**
- Inventory listens and immediately increases its "On Hand" count for Product X by 95.
- Warehouse Operations listens and immediately prepares a putaway task, thinking: "95 units are now sitting on the receiving dock. Where should I tell the worker to put them?"
- Financials listens and immediately updates its ledger: "The business now owns KES 950 more in Inventory Assets, and it owes Supplier A KES 950 (Accounts Payable)."

### Scenario 3: Storing the Goods (Warehouse Ops + Inventory)

**The Business Goal:** The 95 units sitting on the dock need to be placed somewhere logical in the warehouse.

**The Interaction:**

Warehouse Operations → Inventory:
> "I need to store these 95 units. What are the dimensions, weight, and sales velocity (how fast does this item sell) for Product X?"

Inventory responds with the physical attributes and historical demand data for Product X.

Warehouse Operations makes a decision: Based on the data, Warehouse Operations determines that Product X sells quickly (high velocity) and should be stored near the shipping area in Bin A-01, not deep in the back of the warehouse.

Warehouse Operations → Inventory:
> "Can you confirm that these 95 units are now physically located in the Main Warehouse, Bin A-01?"

Inventory acknowledges and updates its location record. If a salesperson later asks, "Do we have Product X?" Inventory can answer, "Yes, 95 units, in the Main Warehouse."

### Scenario 4: A Customer Buys an Item (POS + Inventory + Sales Audit + Financials)

**The Business Goal:** A customer walks into the retail store and buys one unit of Product X at the checkout counter.

**The Interaction:**

Retail Sales (POS) → Inventory:
> "I am about to sell one unit of Product X from Retail Store #3. Do we have available stock to sell?"

Inventory responds: "Yes. I am reserving one unit for you now so no other channel can sell it while you process the payment."

Retail Sales processes the payment: The customer pays $20. The sale is complete.

Retail Sales → The Business (Announcement):
> "Item Sold. One unit of Product X was just sold at Retail Store #3 for $20. Transaction ID: T-777."

**Who is listening:**
- Inventory listens and permanently deducts the reserved unit from its On Hand count. The "Available" stock for Product X is now 94.
- Sales Audit listens and adds KES 20 to the "Expected" total for Register #2 at Retail Store #3 for the day.
- Financials listens and immediately records the accounting entry: "Decrease Inventory Asset by KES 10 (the wholesale cost). Increase Cost of Goods Sold by KES 10. Increase Revenue by KES 20. Gross Profit on this sale = KES 10."

### Scenario 5: Closing the Store for the Night (Sales Audit + POS)

**The Business Goal:** The store manager counts the money in the cash register and closes the store for the day.

**The Interaction:**

Sales Audit → Retail Sales (POS):
> "The manager is closing Register #2. What is the expected total (cash + credit cards) for Register #2 based on all completed transactions today?"

POS responds: "Register #2 processed 150 transactions today. Expected total = KES 5,000."

Sales Audit receives the physical count: The store manager uses the Sales Audit interface to enter the physical cash counted in the drawer: KES 4,950.

Sales Audit makes a decision: Sales Audit calculates the discrepancy: KES 50 short. It blocks the close until the manager provides a reason: "Cashier forgot to log a KES 50 payout for cleaning supplies."

Sales Audit → The Business (Announcement):
> "Store Closed. Register #2 is balanced with a KES 50 shortage, explained. The day is finalized."

**Who is listening:**
- Financials listens and records the KES 50 shortage as a "Cash Over/Short" expense in the ledger.

---

The critical design principle in these interactions is that each module only shares the information that others are allowed to know.

- Receiving does not know the financial value of the goods.
- Financials does not know which bin the goods are in.
- Retail Sales does not know who the supplier was.

Each module trusts the others to own their domain, and they communicate only through the specific, well-defined boundaries of their shared business language.

---

## Developer Handbook & System Requirements Overview

### 1. Project Vision

You are building the software backbone for a retail business that buys goods from suppliers, stores them in a warehouse, and sells them in physical stores. Today, this business runs on spreadsheets, paper receipts, and manual data entry. The result is stale inventory counts, delayed payments, and no real-time visibility into profitability.

Your goal is to build a suite of small, independent backend services—and the frontend components required to interact with them—that digitally mirror the entire lifecycle of goods and money.

You will replace the manual chaos with a distributed, modular Merchandise Management System (MMS).

### 2. Architectural Mandate: Distributed by Design

You are explicitly not building a monolith. You are building a collection of autonomous modules, each owning a specific business domain. These modules communicate over a network, not through a shared database.

The rules are non-negotiable:

- **Database Isolation:** No module may ever access another module's private data store directly. All data exchange must happen through defined service contracts.
- **Independent Deployment:** Each module must be deployable on its own. A bug fix in the warehouse app must not force a redeployment of the point-of-sale system.
- **Resilience:** If one module fails (e.g., Financials goes down for maintenance), the others must continue functioning. The system must queue events for the downed module to consume when it recovers.

### 3. The Communication Standard

You have two distinct ways modules interact, depending on the nature of the business conversation.

#### 3.1. Synchronous Communication (Request/Reply)

Use this when one module needs an immediate answer from another to complete a transaction. Choose the right protocol based on the consumer:

- **RESTful APIs (JSON over HTTP):** Use for frontend-facing interactions (web dashboards, mobile apps) and for general server-to-server data retrieval where human readability and browser accessibility are valuable.
- **Protobufs (gRPC):** Use for high-throughput, low-latency, backend-to-backend calls where performance is critical (e.g., validating stock during a live checkout at a cash register).

#### 3.2. Asynchronous Communication (Event-Driven)

Use this when a module needs to broadcast that something important happened, but does not need to wait for the recipients to finish processing it.

- **The Event Bus:** Modules publish domain events (e.g., `GoodsReceived`, `ItemSold`) to a central message broker. Downstream modules subscribe to these events and react at their own pace. The publisher never knows or cares who is listening.

### 4. The Module Breakdown

Each module is a self-contained vertical slice: a backend service (domain logic + private data) and, where required, a frontend component for human interaction.

#### Module 1: Vendor Management
- **Domain Problem:** The business has no single source of truth for who its suppliers are, what they sell, and what terms they offer.
- **Core Responsibility:** Maintain the authoritative record of all approved suppliers, their contact details, payment terms, and their approved product catalogs.
- **Frontend Component Required:** Yes — **Vendor Management Portal**.
  - **User:** Procurement team and administrators at the back office.
  - **Function:** A web dashboard to browse, add, edit, and archive supplier records.
- **Interaction Rules:** Provides supplier data to Procurement when a purchase order is being created.

#### Module 2: Procurement
- **Domain Problem:** Purchase orders are handled via spreadsheets with no approval workflow or visibility into what is on order.
- **Core Responsibility:** Manage the lifecycle of Purchase Orders (POs). Capture the intent to buy, lock in prices, and enforce the approval workflow.
- **Frontend Component Required:** Yes — **Procurement Dashboard**.
  - **User:** Buyers and purchasing managers at the back office.
  - **Function:** A web dashboard to create POs, route them for approval, and view open orders.
- **Interaction Rules:** Publishes `PurchaseOrderApproved` events. Listens for low-stock alerts from Inventory to trigger reorder suggestions.

#### Module 3: Receiving
- **Domain Problem:** The loading dock has no way to verify that what arrived on the truck matches what was ordered.
- **Core Responsibility:** Validate incoming physical goods against approved POs. Record exact quantities received and flag discrepancies (shortages, overages, damages). Generate a Goods Received Note (GRN).
- **Frontend Component Required:** Yes — **Warehouse Receiving App**.
  - **User:** Warehouse staff at the loading dock.
  - **Function:** A mobile/tablet app with barcode scanning to check off items against a PO and finalize the receipt.
- **Interaction Rules:** Publishes `GoodsReceived` events. Consumes `PurchaseOrderApproved` events to know what to expect.

#### Module 4: Inventory
- **Domain Problem:** The business has no real-time view of how much stock it has, where it is, or what it is worth.
- **Core Responsibility:** Maintain the single source of truth for stock levels, stock valuation, and product master data. Increase stock when goods are received; decrease stock when goods are sold.
- **Frontend Component Required:** Yes — **Inventory Control Center**.
  - **User:** Inventory managers, buyers, and finance team at the back office.
  - **Function:** A web dashboard to browse stock levels, perform stock adjustments, and view inventory valuation reports.
- **Interaction Rules:** Consumes `GoodsReceived` and `ItemSold` events. Provides real-time stock availability checks to the Retail Sales module. Publishes `StockLow` events when reorder points are hit.

#### Module 5: Warehouse Operations
- **Domain Problem:** Workers put boxes wherever they find space. Weeks later, no one can find the items that Inventory says are "somewhere in the warehouse."
- **Core Responsibility:** Manage the physical geography of the warehouse. Direct putaway (where to store goods), direct picking (where to retrieve goods), and manage stock transfers between buildings.
- **Frontend Component Required:** Yes — **Warehouse Floor App**.
  - **User:** Warehouse pickers, forklift drivers, and floor supervisors.
  - **Function:** A mobile/tablet app that directs workers to specific bins for putaway and picking.
- **Interaction Rules:** Consumes `GoodsReceived` events to trigger putaway tasks. Communicates with Inventory to update the physical location of stock.

#### Module 6: Retail Sales (POS)
- **Domain Problem:** The storefront needs to know the right price, validate stock, and capture the sale quickly and accurately.
- **Core Responsibility:** Manage retail pricing, promotions, and the processing of sales and returns at the checkout counter.
- **Frontend Component Required:** Yes — **Point of Sale Terminal App**.
  - **User:** Cashiers at the retail storefront.
  - **Function:** A fast, touch-friendly application for scanning items, applying discounts, processing payments, and printing receipts.
- **Interaction Rules:** Makes a synchronous stock validation call to Inventory before finalizing a sale. Publishes `ItemSold` events after the transaction completes.

#### Module 7: Sales Audit
- **Domain Problem:** At the end of the day, the cash in the drawer rarely matches what the POS says it should be. There is no formal way to track or explain these discrepancies.
- **Core Responsibility:** Reconcile the physical money in the store against the sales transactions recorded by the POS. Flag shortages and overages and require manager sign-off before closing the day.
- **Frontend Component Required:** Yes — **Store Manager Dashboard**.
  - **User:** Store managers at the retail branch.
  - **Function:** A web dashboard to enter cash counts, compare against expected totals, and close out the register for the day.
- **Interaction Rules:** Consumes `ItemSold` events to calculate expected totals. Publishes `DayClosed` events for Financials.

#### Module 8: Financials
- **Domain Problem:** Accounting is done manually. The books are always weeks behind, and the business has no real-time view of profit and loss.
- **Core Responsibility:** Automate accounting entries. When goods are received, increase inventory assets and accounts payable. When goods are sold, decrease inventory assets and record revenue and cost of goods sold.
- **Frontend Component Required:** Yes — **Finance Portal**.
  - **User:** Accounting team and executives at the back office.
  - **Function:** A web dashboard to view accounts payable, the general ledger, and profitability reports.
- **Interaction Rules:** Consumes `GoodsReceived`, `ItemSold`, and `DayClosed` events. Exposes read-only financial reports.

### 5. Development Workflow & Standards

#### Repository Structure: Monorepo
All source code for all modules will live in a single monorepo. This makes it easier to share common utilities, manage dependencies, and review cross-module changes.

#### Feature Flags: Organizing Development into Phases
You will not build all eight modules at once. Development will proceed in phases. To manage this, you must use feature flags — a simple configuration toggle that hides incomplete or disabled modules from the running system.

- **Phase 1 (Foundation):** vendor-management, procurement, inventory.
- **Phase 2 (Warehouse):** receiving, warehouse-operations.
- **Phase 3 (Retail):** retail-sales, sales-audit.
- **Phase 4 (Accounting):** financials.

**How to use flags:**
- Before deploying a new module, wrap its routes and event listeners in a flag check.
- If a module is flagged as disabled, its frontend should either hide its menu items or show a "Coming Soon" screen.
- This allows you to merge code to the main branch safely, even if a module is not yet ready for production use.

#### Pull Requests & Code Review
You will not push code directly to the main branch. You will work on a feature branch and submit a Pull Request.

- **Branch Naming:** Use descriptive names like `feat/receiving-service`, `fix/inventory-reservation`, or `docs/system-overview`.
- **PR Scope:** A PR should cover a single module or a single significant feature. Do not bundle unrelated changes. Make small commits.
- **Review Request:** When a module is ready for review, submit the PR and request a review from the instructor/lead architect.
- **Merge Gate:** A PR will only be merged if:
  - All tests pass.
  - API documentation has been updated.
  - The feature flag for the relevant phase is correctly configured.
  - The README has been updated if a new module was added.

#### Documentation: README.md
The root of the monorepo must contain a comprehensive README.md. This is the entry point for any developer joining the project. The README must include:

- Project Overview: A brief summary of what the MMS does and the business problem it solves.
- Architecture Diagram: A visual showing the modules and how they interact (synchronous vs. event-driven).
- Module Directory: A table listing each module, its directory path, its purpose, and its current phase status.
- Local Development Setup: Step-by-step instructions on how to start the entire system locally (e.g., `docker compose up`).
- Feature Flag Configuration: Instructions on how to enable or disable specific modules.
- Testing Instructions: How to run unit tests and integration tests.
- API Documentation Link: How to access the generated Swagger/OpenAPI docs.

#### API Documentation: OpenAPI & Protobufs
You must document every service contract before you write the business logic.

- **RESTful APIs:** Use Swagger/OpenAPI. Place the YAML or JSON specification in the `contracts/openapi/` directory. If your framework supports it, generate the documentation automatically from code annotations and expose a Swagger UI endpoint (e.g., `/docs`).
- **Protobuf/gRPC:** Place your `.proto` files in the `contracts/proto/` directory. These files are the source of truth for gRPC contracts. Use `buf` or `protoc` to generate the server stubs and client libraries.

#### Testing Standards
Untested code is not considered "ready for review." You must write both unit and integration tests.

#### The "Definition of Done"
A module is only considered "Ready for Review" when:

- Source code lives in the correct monorepo directory.
- The feature flag for its phase is correctly implemented.
- A Pull Request has been opened to the main branch.
- The Swagger/OpenAPI docs or `.proto` files have been updated.
- Unit and integration tests pass in CI. Use GitHub Actions.
- The root README.md has been updated to reflect the module's current status.

All the best guys! Reach out to the instructor for additional guidance via slack or other channels.

---

## Requirements

- Build the system as a suite of independent, domain-focused modules.
- Do not build a single, tightly coupled application.
- Ensure no module can access another module's private data store.
- Require all inter-module communication to happen via defined APIs and events.
- Ensure each module can be deployed independently without redeploying the entire system.
- Ensure the system remains operational if one module fails.
- Maintain the authoritative record of all approved suppliers in the Vendor Management module.
- Track supplier contact details, payment terms, and lead times.
- Track which products each supplier is approved to provide and at what cost.
- Provide supplier data to Procurement upon request.
- Build a back-office Vendor Management Portal web dashboard.
- Manage the lifecycle of Purchase Orders in the Procurement module.
- Lock in unit costs and payment terms at the moment a PO (Purchase Order) is created.
- Enforce an approval workflow before a PO (Purchase Order) becomes valid.
- Track remaining open quantities on partially received POs.
- Publish `PurchaseOrderApproved` events to the Event Sourcing System.
- Listen for low-stock alerts from Inventory to trigger reorder suggestions.
- Build a back-office Procurement Dashboard web app.
- Validate incoming physical goods against approved POs in the Receiving module.
- Record exact quantities received and item condition.
- Flag shortages, overages, and damages during receiving.
- Generate a formal Goods Received Note (GRN).
- Route damaged goods into a quarantine status, not sellable stock.
- Publish `GoodsReceived` events to the Event Sourcing System.
- Build a mobile friendly web App for warehouse dock staff.
- Maintain a perpetual, real-time count of stock across all locations in the Inventory module.
- Increase stock when goods are received.
- Decrease stock when goods are sold or returned.
- Track On Hand, Allocated, and Available quantities distinctly.
- Track the monetary value of all stock on hand.
- Provide real-time stock availability checks to Retail Sales.
- Publish `StockLow` events when reorder thresholds are crossed.
- Build a back-office Inventory Control Center web dashboard.
- Direct workers where to put away newly received goods.
- Direct workers where to pick items for store transfers or orders.
- Track stock transfers between warehouses and retail stores.
- Track warehouse space utilization and capacity.
- Include project overview and business problem in the README.
- Ensure tests can run automatically in a CI pipeline.
