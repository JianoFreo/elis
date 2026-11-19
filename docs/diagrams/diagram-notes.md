# Diagram Notes – Eli's Yummy Kitchen

Source file: `TEAM_4_DIAGRAMS.drawio` (made by Group 4 in Phase 2; used by our group in Phase 4).
Pages: DFD | USE CASES DIAGRAM | ERD

## 1. Contents of the file
**DFD page:** Context-level DFD; DFD with processes 1.0 Sales Transaction, 2.0 Inventory, 3.0 Dispatch Logging, 4.0 Supply Tracking, 5.0 Account Creation; and expanded-level DFDs.
**USE CASES page:** Sales Transaction, Dispatch Logging, Supply Tracking.
**ERD page:** Accounts, Materials, Product, Centralized Inventory, Inventory ledger (branch), Sales Transactions, Daily Sales Summary, Weekly Audits, Dispatch Records, Discrepancy.

## 2. External entities (actors)
The system roles in the README are: owner, sales-staff, production-head, production-staff. Use these names in every diagram.
| No. | Name used in DFD | Name used in Use Cases | System role (README) | Proposed standard name |
|-----|------------------|------------------------|----------------------|------------------------|
| 01 | Owner | Business Owner | owner | Owner |
| 02 | Sales Staff | Sales Staff | sales-staff | Sales Staff |
| 03 | Inventory Staff | (none) | none | Team to decide: map to Production Head or Production Staff |
| 04 | Dispatch Staff | Sales Staff / Production Head | none | Team to decide: map to Production Head or Production Staff |
| 05 | Supply Tracking Staff / Hub Production Head | Production Head, Production Staff | production-head, production-staff | Production Head / Production Staff |
Ask the team: the DFD has Inventory Staff and Dispatch Staff, but the system has no such roles. Decide who performs those processes and update the diagrams.

## 3. Data stores
| ID | Name in DFD | Variants found | ERD entity |
|----|-------------|----------------|------------|
| D1 | Sales Transactions | | Sales Transactions |
| D2 | Branch Inventory Ledger | | Inventory ledger (branch) |
| D3 | Daily Sales Summary | "Daily Summary" | Daily Sales Summary |
| D4 | Offline Queue (local) | | None (stored on the device; mention in technical docs) |
| D5 | Product Master | | Product |
| D6 | User Accounts | | Accounts |
| D7 | Discrepancies & Audit Records | "Discrepancy & Audit Records" | Discrepancy + Weekly Audits |
| D8 | Main Hub Inventory | | Centralized Inventory |
| D9 | Dispatch Logs | "Dispatch Records" | Dispatch Records |
Open question: which data store holds Materials?

## 4. Use case ID renumbering
**Sales Transaction (UC-S)**
| New ID | Use case |
|--------|----------|
| UC-S01 | Log In & Select Branch / Shift |
| UC-S02 | Record Sale (Select Product, Enter Quantity) |
| UC-S03 | Review Daily Sales & Stock Summary |
| UC-S04 | Enter Physical Stock Count |
| UC-S05 | Confirm & Submit Daily Closing |
| UC-S06 | Compute Line Total & Stock Movement |
| UC-S07 | Queue Transaction Offline |
| UC-S08 | Sync Queued Transactions |
| UC-S09 | Flag Possible Discrepancy |
| UC-S10 | Review Consolidated Branch Data & Exceptions |
| UC-S11 | Include Confirmed Records in Weekly Audit |

**Dispatch Logging (UC-D)**
| New ID | Use case |
|--------|----------|
| UC-D01 | Create Dispatch Record |
| UC-D02 | Deduct Main Hub Stock |
| UC-D03 | Confirm Delivery Receipt |
| UC-D04 | Update Branch Stock Ledger |
| UC-D05 | Flag Delivery Discrepancy |
| UC-D06 | Review Dispatch Status & Alerts |

**Supply Tracking (UC-T)**
| New ID | Use case |
|--------|----------|
| UC-T01 | Register Supply Items & Thresholds |
| UC-T02 | Record Supply Stock-In |
| UC-T03 | Log Shift Opening Inventory |
| UC-T04 | Log Shift Closing Inventory |
| UC-T05 | Monitor Low-Stock Alerts & Reports |
| UC-T06 | Compute Daily Stock Usage |
| UC-T07 | Trigger Low-Stock Alert |

**To draw (missing):** Inventory (2.0): set opening stock, receive production output, receive dispatched stock, count stock on hand, enter counted quantities, submit daily closing, compute expected stock, compare with physical count, flag discrepancy, review and approve adjustment. Account Management (5.0): create staff account, configure permissions, delete account.

## 5. Data dictionary (draft from the ERD; ask developers to fill in Type and Size)
| Entity | Attribute | Description | Type |
|--------|-----------|-------------|------|
| Accounts | accountId | Unique account ID (primary key) | |
| Accounts | username | Login name | |
| Accounts | password | Login password (should be stored hashed) | |
| Accounts | role | Owner, Sales Staff, Inventory Staff, etc. | |
| Accounts | name (Fname, Surname) | Staff full name | |
| Materials | materialId | Unique material ID (primary key) | |
| Materials | name | Material name | |
| Materials | description | Details | |
| Materials | unit of measurement | kg, pcs, etc. | |
| Materials | supplier/source | Where it was bought | |
| Materials | date received | Stock-in date | |
| Materials | unit cost | Cost per unit | |
| Materials | low-stock threshold | Reorder level that triggers an alert | |
| Product | productId | Unique product ID (primary key) | |
| Product | name | Product name | |
| Product | description | Details | |
| Product | unit price | Selling price | |
| Product | supply batch number | Batch identifier | |
| Product | best before date | Expiry for the batch | |
| Product | branch location | Branch where it is held | |
| Product | quantity | Quantity on hand | |
| Product | low-stock threshold | Reorder level | |
| Centralized Inventory | name, branch, qty, best_before, supplies stock | Main hub stock | |
| Inventory ledger (branch) | name, branch, qty, best_before, supplies stock | Branch stock ledger | |
| Sales Transactions | time | Time of the sale | |
| Sales Transactions | product_name | Product sold | |
| Sales Transactions | staff_name | Staff who recorded the sale | |
| Sales Transactions | qty | Quantity sold | |
| Daily Sales Summary | date, sales_qty, flags_number, flags_status, stocks_status | Daily closing summary | |
| Weekly Audits | date, sales_qty, flags_number, flags_status, stocks_status | Weekly audit record | |
| Dispatch Records | date, batch#, products, qty, staff_name | Dispatch from hub to branch | |
| Discrepancy | discrepancyid | Unique ID (primary key) | |
| Discrepancy | expected quantity | What the system expected | |
| Discrepancy | variance | Difference between expected and counted | |
| Discrepancy | status | Open, Verified, Resolved | |

## 6. Relationships in the ERD
- Accounts add stocks to Materials and Product.
- Materials and Product are recorded in Centralized Inventory.
- Centralized Inventory syncs data to the Inventory ledger (branch).
- Accounts dispatch supplies to the Inventory ledger (branch), which creates Dispatch Records.
- Accounts record Sales Transactions.
- Sales Transactions and the Inventory ledger raise flags that become Discrepancy records; Accounts review Discrepancy records.
- Verified counts are recorded in the Inventory ledger.
- The Inventory ledger sends sales records to the Daily Sales Summary; Discrepancy flags are recorded in it.
- The Daily Sales Summary is compiled and sent to Weekly Audits.

## 7. Export file names
01-context-dfd.png, 02-dfd-level0.png, 03-dfd-1.0-sales.png, 04-dfd-2.0-inventory.png, 05-dfd-3.0-dispatch.png, 06-dfd-4.0-supply.png, 07-dfd-5.0-accounts.png, 08-uc-sales.png, 09-uc-dispatch.png, 10-uc-supply.png, 11-erd.png
