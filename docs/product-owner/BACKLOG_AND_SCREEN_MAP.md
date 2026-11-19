# Product Backlog and 53-Screen Traceability

Prepared for Princess Ann Delos Reyes and Clark Jerzon Herrera. Scope source: repository README, task board, existing React screens and the design-state aliases used in this project. Business prioritization and final stakeholder acceptance remain for their joint review.

## Prioritized user stories

| ID | Priority | Capability | User story | Implementation owner | Acceptance reference |
| --- | --- | --- | --- | --- | --- |
| US-01 | P0 | Access and role workspace | As an authorized staff member, I want to sign in to the workspace permitted for my account so that I only use assigned functions. | Jm | AC-A01 |
| US-02 | P0 | Operations overview | As the business owner, I want consolidated sales, stock and exceptions so that I can choose the next operational action. | Princess: frontend overview; Jm: overview API | AC-T01 |
| US-03 | P0 | Product master | As the owner or production head, I want validated product details and thresholds so that selling and stock records use one product identity. | Princess | AC-P01, AC-P02, AC-P07 |
| US-04 | P0 | Production and stock entries | As production head, I want to post batches and initial/external stock entries with stable references so that each legitimate receipt is recorded once. | Princess | AC-P03–AC-P06 |
| US-05 | P0 | Sales recording | As sales staff, I want a confirmed sale to use the server price and actual branch stock so that I cannot oversell or debit another location. | Princess | AC-S01–AC-S04, AC-S08 |
| US-06 | P0 | Device offline queue | As sales staff, I want pending sales to survive loss of connection and retry safely so that sales are neither lost nor counted twice. | Princess | AC-S04–AC-S07 |
| US-07 | P0 | Daily stock count and closing | As sales staff, I want to submit complete counts and explain differences so that the owner can review a stable closing record. | Princess | AC-S09–AC-S13 |
| US-08 | P0 | Dispatch and receipt | As production and sales staff, I want to reconcile dispatched and actual received units so that the destination receives one correct stock credit. | Jiano | AC-D01 |
| US-09 | P1 | Material stock and usage | As production staff, I want material openings, receipts and closings so that consumption and replenishment needs can be monitored. | Jiano | AC-M01 |
| US-10 | P1 | Discrepancy review | As the business owner, I want documented review and adjustment decisions so that source values remain traceable and stock changes are authorized. | Jiano | AC-R01 |
| US-11 | P1 | Weekly audit and next opening | As the business owner, I want a verified weekly sign-off and a carry-forward snapshot so that stock is not credited again at the next opening. | Jiano: audit; Princess: next opening | AC-W01, AC-P08 |
| US-12 | P1 | Accounts and permissions | As business owner, I want staff accounts and permissions to reflect their work assignments so that privileged operations remain controlled. | Jm | AC-U01 |
| US-13 | P1 | Reporting and scope | As business owner, I want reporting by date/branch with downloadable evidence so that summaries agree with stored operations. | Jm: reports; Princess: daily stock positions | AC-T01 |

P0 is the usable core: sign-in, products, production, sales, offline retry, closing and dispatch. P1 adds monitoring, audit, accounts and reporting, matching the task board’s cut order.

## Definition of done

A story is implementation-complete when its source is wired to the API, server validation/permissions are present, relevant automated checks and builds pass, and setup is documented. Business acceptance additionally requires recorded QA/browser evidence and shared Product Owner approval. “Mapped” below describes source traceability, not a claim that every teammate story was newly implemented or browser-tested here.

## Screen-state mapping

The current React app consolidates forms and confirmations into pages and modals. The aliases identify 53 original design states, not 53 independent routes. The foundation’s workspace-choice state is represented by login role routing/optional quick-fill; review that equivalence with the design owner rather than claiming a separate screen exists.

| # | Design alias | Screen/state | Story | React source under frontend/src | Implementation state |
| --- | --- | --- | --- | --- | --- |
| 01 | `login` | Welcome back | US-01 | `auth/LoginPage.tsx` | Login form |
| 02 | `shift` | Choose your workspace | US-01 | `auth/LoginPage.tsx` | Role quick-fill / authenticated role routing (foundation equivalent) |
| 03 | `overview` | Welcome back, Juan | US-02 | `users/owner/pages/Overview.tsx` | Owner overview |
| 04 | `sales` | Sales workspace | US-05 | `users/sales/pages/Workspace.tsx` | Workspace |
| 05 | `record-sale` | Record a sale | US-05 | `users/sales/pages/RecordSale.tsx` | Capture form |
| 06 | `sale-done` | Sale recorded | US-05 | `users/sales/pages/RecordSale.tsx` | Result modal |
| 07 | `offline` | Offline transaction queue | US-06 | `users/sales/pages/Queue.tsx` | Device + server queue |
| 08 | `sync-done` | You are all caught up | US-06 | `users/sales/pages/Queue.tsx` | Synchronization result modal |
| 09 | `summary` | Daily sales & stock summary | US-07 | `users/sales/pages/Summary.tsx` | Summary + date selection |
| 10 | `count` | Count what is on hand | US-07 | `users/sales/pages/Closing.tsx` | Count step |
| 11 | `closing` | Review daily closing | US-07 | `users/sales/pages/Closing.tsx` | Review step |
| 12 | `closing-done` | Closing submitted | US-07 | `users/sales/pages/Closing.tsx` | Result modal / submitted view |
| 13 | `inventory` | Every batch, accounted for | US-03 | `users/shared/Inventory.tsx` | Product inventory list |
| 14 | `product` | Chicken empanada / product detail | US-03 | `users/shared/Inventory.tsx` | Product detail and ledger |
| 15 | `product-edit` | Product master | US-03 | `users/shared/Inventory.tsx` | Master edit modal |
| 16 | `production` | Record production output | US-04 | `users/shared/Inventory.tsx` | Production modal |
| 17 | `stock-in` | Stock baseline & received stock | US-04 | `users/shared/Inventory.tsx` | Opening / external receipt modal |
| 18 | `dispatches` | From our kitchen to every branch | US-08 | `users/shared/Dispatch.tsx` | Dispatch list |
| 19 | `dispatch-new` | Create a dispatch | US-08 | `users/shared/Dispatch.tsx` | Create modal |
| 20 | `dispatch-detail` | Dispatch DSP-0087 | US-08 | `users/shared/Dispatch.tsx` | Dispatch detail |
| 21 | `receive` | Confirm branch receipt | US-08 | `users/sales/pages/Deliveries.tsx` | Receipt form |
| 22 | `receipt-done` | Receipt confirmed | US-08 | `users/sales/pages/Deliveries.tsx` | Result modal |
| 23 | `supplies` | The ingredients behind it all | US-09 | `users/shared/Supplies.tsx` | Materials list |
| 24 | `supply-new` | Register a material item | US-09 | `users/shared/Supplies.tsx` | Register modal |
| 25 | `supply-stock` | Receive material stock | US-09 | `users/shared/Supplies.tsx` | Stock-in modal |
| 26 | `usage` | Daily opening & closing inventory | US-09 | `users/shared/Supplies.tsx` | Daily usage table / closing modal |
| 27 | `usage-done` | Usage recorded | US-09 | `users/shared/Supplies.tsx` | Result modal |
| 28 | `alerts` | A little attention goes a long way | US-09 | `users/shared/Alerts.tsx` | Alerts |
| 29 | `discrepancies` | Review, resolve, reconcile | US-10 | `users/owner/pages/Discrepancies.tsx` | Discrepancy list |
| 30 | `review` | Discrepancy DISC-001 | US-10 | `users/owner/pages/Discrepancies.tsx` | Count discrepancy detail |
| 31 | `adjust` | Approve stock adjustment | US-10 | `users/owner/pages/Discrepancies.tsx` | Approval modal |
| 32 | `adjusted` | Adjustment approved | US-10 | `users/owner/pages/Discrepancies.tsx` | Result modal |
| 33 | `audits` | A week, brought together | US-11 | `users/owner/pages/Audits.tsx` | Audit list |
| 34 | `audit-detail` | Weekly audit 02–08 Nov | US-11 | `users/owner/pages/Audits.tsx` | Audit detail |
| 35 | `audit-ready` | Ready for weekly sign-off | US-11 | `users/owner/pages/Audits.tsx` | Readiness / sign-off condition |
| 36 | `signed` | Week signed off | US-11 | `users/owner/pages/Audits.tsx` | Signed result modal |
| 37 | `accounts` | The people behind the kitchen | US-12 | `users/owner/pages/Users.tsx` | Account list |
| 38 | `account-new` | Create a staff account | US-12 | `users/owner/pages/Users.tsx` | Create modal |
| 39 | `permissions` | Account permissions | US-12 | `users/owner/pages/Users.tsx` | Permissions modal |
| 40 | `delete-account` | Delete this staff account | US-12 | `users/owner/pages/Users.tsx` | Delete confirmation |
| 41 | `account-deleted` | Account deleted | US-12 | `users/owner/pages/Users.tsx` | Result modal |
| 42 | `reports` | Reports with the full picture | US-13 | `users/owner/pages/Reports.tsx` | Report chooser |
| 43 | `inventory-report` | Stock & reconciliation report | US-13 | `users/owner/pages/Reports.tsx` | Stock report |
| 44 | `dispatch-report` | Dispatch status report | US-13 | `users/owner/pages/Reports.tsx` | Dispatch report |
| 45 | `supply-report` | Material usage & restock report | US-13 | `users/owner/pages/Reports.tsx` | Material report |
| 46 | `report-filters` | Choose report scope | US-13 | `users/owner/pages/Reports.tsx` | Report type / branch / date controls |
| 47 | `delivery-review` | Delivery discrepancy DISC-002 | US-10 | `users/owner/pages/Discrepancies.tsx` | Delivery detail |
| 48 | `delivery-resolve` | Resolve delivery discrepancy | US-10 | `users/owner/pages/Discrepancies.tsx` | Resolution modal |
| 49 | `delivery-resolved` | Delivery exception resolved | US-10 | `users/owner/pages/Discrepancies.tsx` | Result modal |
| 50 | `supply-opening` | Log shift opening inventory | US-09 | `users/shared/Supplies.tsx` | Opening modal |
| 51 | `supply-opened` | Opening inventory saved | US-09 | `users/shared/Supplies.tsx` | Result modal |
| 52 | `next-opening` | Next opening stock baseline | US-11 | `users/owner/pages/Audits.tsx` | Signed closing snapshot modal |
| 53 | `baseline-saved` | Next opening confirmed | US-11 | `users/owner/pages/Audits.tsx` | Carry-forward result modal |
