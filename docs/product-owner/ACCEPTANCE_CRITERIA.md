# Product Owner Acceptance Criteria

Prepared for Princess Ann Delos Reyes and Clark Jerzon Herrera. This is the review baseline for the implementation, not a statement that the professor or business owner has approved it.

## Products, production and stock — Princess

| ID | Given / when | Acceptance condition | Evidence / review |
| --- | --- | --- | --- |
| AC-P01 | An authorized owner or production head registers a product | Name is nonblank; prices/costs are finite, nonnegative currency amounts; threshold is a nonnegative integer; server assigns the product code | Automated API checks |
| AC-P02 | A product master is edited | Valid fields persist; invalid values reject without partial updates; description/date can be cleared; an activity event is committed with the write | Automated API checks |
| AC-P03 | A completed production batch is saved | Positive whole output credits the hub, stores its batch/best-before date and uses a database-generated production reference | Automated API checks |
| AC-P04 | The same production request is retried | Same reference and contents return the original result without a second credit; changed contents using that reference reject | Automated API checks |
| AC-P05 | Initial stock is entered | Only an empty product/location ledger accepts an initial baseline; repeating a known request does not credit again | Automated API checks |
| AC-P06 | External received stock is entered | Explicit received type, positive quantity and existing location are required; receipt appends a movement with a stable reference | Automated API checks |
| AC-P07 | Stock reaches zero or falls below its threshold | The location/product remains visible; one product/location is counted once even with several batch rows | Automated zero-stock / inventory checks |
| AC-P08 | The owner carries stock to a new opening | Signed week's final confirmed closing is the source; later live movements cannot change it; zero-quantity markers do not add stock again | Automated API checks |

## Sales, offline capture and closing — Princess

| ID | Given / when | Acceptance condition | Evidence / review |
| --- | --- | --- | --- |
| AC-S01 | A sales user opens a workspace | Only the assigned selling branch is used; no client branch override can grant access elsewhere | Automated API checks |
| AC-S02 | A sale is confirmed | Quantity is a positive whole number; server price and branch stock govern the transaction; overselling rejects with no partial sale or debit | Automated API checks |
| AC-S03 | A product has several branch batches | Sale debits actual available branch batches in earliest-best-before order; another location's latest batch is not used | Automated API checks |
| AC-S04 | A network response is lost or a sale is retried | Persisted local reference returns the same confirmed sale; another payload or account cannot reuse it | Automated API / outbox checks |
| AC-S05 | Connection is unavailable after the app/workspace has been loaded | Sale can be saved locally with a unique reference, original capture time and cached estimate; auth secrets are not placed in the queue | Storage and Edge offline checks passed |
| AC-S06 | Device storage is unavailable or corrupt | UI must not claim a successful local save; corrupt records are reported without silently deleting them | Automated storage checks |
| AC-S07 | Connection returns | Confirmed entries are removed locally; failed entries retain their reference and reason; server queued rows post at most once | API and storage tests passed; Edge verified reconnection, synchronization and reload |
| AC-S08 | BUSINESS_DATE is set for a demonstration | New sales and their ledger debits use that date; daily summary agrees with the saved transaction | Automated API checks |
| AC-S09 | Staff count physical stock | Every active product appears exactly once with a nonnegative integer count; blank, duplicate, missing and invalid rows reject | Automated API checks |
| AC-S10 | A variance is submitted | Supporting note is required; a discrepancy is created; the count itself does not adjust the stock ledger | Automated API checks |
| AC-S11 | Pending sales exist or a closing is already submitted | New closing cannot bypass pending sales; duplicate closing / post-closing sale is blocked | Automated API checks |
| AC-S12 | Historical summary is opened after later movements | Use date-bounded ledger values or the frozen submitted snapshot; original expected/physical variance remains auditable after an adjustment | Automated API checks |
| AC-S13 | Any sale write or its activity insert fails | Sale and ledger movements roll back together; API never reports an unlogged committed write as a failed sale | Failure-injection test |

## Other module acceptance — team review baseline

These criteria are included for shared Product Owner coverage. Princess's regression suite does not establish completion of every teammate module.

| ID | Module | Acceptance condition | Responsible implementation / acceptance |
| --- | --- | --- | --- |
| AC-A01 | Access | Real accounts authenticate; inactive accounts and unauthorized roles are rejected; passwords are never returned | Jm / shared PO review |
| AC-D01 | Dispatch | Hub is deducted once on creation; actual receipt credits destination once; missing units create a flag without a second hub deduction | Jiano / shared PO review |
| AC-M01 | Materials | Receiving and opening/closing preserve units; used = opening + received − closing; impossible counts reject; thresholds cause alerts | Jiano / shared PO review |
| AC-R01 | Reconciliation | Only owner approves stock adjustments; reasons and activity records are retained; source sale/count values remain unchanged | Jiano / shared PO review |
| AC-W01 | Weekly audit | All required daily closings must be confirmed and flags resolved before sign-off; signed periods do not accept new sales | Jiano + Princess boundary / shared PO review |
| AC-U01 | Staff accounts | Role, branch and status changes are enforced on the server; privileged accounts cannot be silently removed | Jm / shared PO review |
| AC-T01 | Reports | Selected date/branch and CSV agree with persisted records, including original daily closing snapshots | Jm + Princess daily position helper / shared PO review |
| AC-Q01 | Usability | Product and Materials wording matches the professor's comment; validation is readable; desktop and mobile layouts remain usable | Sales summary and product detail checked in Edge at 390 px; full QA review pending |

## Release gate

A passing build or regression suite does not equal business acceptance. Princess and Clark must review the completed scenarios together; QA must record browser/mobile and deployment results; the PM coordinates the final submission. No signature or approval date is prefilled.
