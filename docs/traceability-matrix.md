# Design Traceability Matrix

Purpose: show that the prototype matches the Phase 3 design (Fidelity to Design). Fill the empty columns together with the developers and QA.
Pick 3-4 core use cases (the rubric asks the prototype to focus on these). Suggested candidates are marked CORE?; the team decides.

| Use case | CORE? | DFD process | ERD entities / data stores | Screen (Figma / prototype) | API endpoint | Test case ID | Status |
|----------|-------|-------------|----------------------------|-----------------------------|--------------|--------------|--------|
| UC-S01 Log In & Select Branch / Shift | Yes | 1.1 | Accounts (D6) | | | | |
| UC-S02 Record Sale | Yes | 1.2 | Sales Transactions (D1), Inventory ledger (D2), Product (D5) | | | | |
| UC-S03 Review Daily Sales & Stock Summary | | 1.4 | Daily Sales Summary (D3) | | | | |
| UC-S05 Confirm & Submit Daily Closing | Yes | 1.6 | Inventory ledger (D2), Daily Sales Summary (D3) | | | | |
| UC-S07/S08 Queue and Sync Offline Transactions | | 1.3 | Offline Queue (D4), Sales Transactions (D1) | | | | |
| UC-S09 Flag Possible Discrepancy | | 1.5 / 2.4 | Discrepancy (D7) | | | | |
| UC-D01 Create Dispatch Record | Yes | 3.1 | Main Hub Inventory (D8), Dispatch Records (D9) | | | | |
| UC-D03 Confirm Delivery Receipt | | 3.2 | Inventory ledger (D2), Dispatch Records (D9) | | | | |
| UC-D05 Flag Delivery Discrepancy | | 3.3 | Discrepancy (D7) | | | | |
| UC-T02 Record Supply Stock-In | | 4.2 | Materials, Inventory ledger (D2, verify) | | | | |
| UC-T07 Trigger Low-Stock Alert | | 4.4 | Materials, thresholds | | | | |
| Staff account creation and permissions | | 5.1 / 5.2 | Accounts (D6) | | | | |

Status values: Not started | In progress | Done | Done with deviation.

## Deviations from the Phase 3 design
| Item | Design said | Prototype does | Reason | Approved by |
|------|-------------|----------------|--------|-------------|
| | | | | |
