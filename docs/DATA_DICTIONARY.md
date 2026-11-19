# Data Dictionary

Source: Phase 3 ERD. Attribute names are taken from the ERD. The **Data type** column shows the type used in the Postgres schema (`backend/src/config/db.ts`); rows marked `confirm` are still to be checked against that file by the developers.

Key: **PK** primary key, **FK** foreign key.

## Accounts
| Attribute | Description | Key | Data type |
|---|---|---|---|
| accountId | Unique account identifier | PK | confirm |
| username | Login name | | confirm |
| password | Login password (stored hashed) | | confirm |
| name (Fname, Surname) | Staff member's full name | | confirm |
| role | Owner, Sales Staff, Production Head, Production Staff, etc. | | confirm |

## Materials
| Attribute | Description | Key | Data type |
|---|---|---|---|
| materialId | Unique material identifier | PK | confirm |
| name | Material name | | confirm |
| description | Short description | | confirm |
| unit of measurement | e.g. kg, pcs | | confirm |
| supplier/source | Where the material came from | | confirm |
| date received | Date of stock-in | | confirm |
| unit cost | Cost per unit | | confirm |
| low-stock threshold | Level that triggers a low-stock alert | | confirm |

## Product
| Attribute | Description | Key | Data type |
|---|---|---|---|
| productId | Unique product identifier | PK | confirm |
| name | Product name | | confirm |
| description | Short description | | confirm |
| unit price | Selling price per unit | | confirm |
| supply batch number | Batch the product belongs to | | confirm |
| best before date | Expiry date | | confirm |
| branch location | Branch holding the stock | | confirm |
| quantity | Quantity on hand | | confirm |
| low-stock threshold | Level that triggers an alert | | confirm |

## Centralized Inventory (main hub)
| Attribute | Description | Key | Data type |
|---|---|---|---|
| name | Item name | | confirm |
| branch | Branch | | confirm |
| qty | Quantity at the hub | | confirm |
| best_before | Expiry date | | confirm |
| supplies stock | Supplies on hand | | confirm |

## Inventory Ledger (branch)
| Attribute | Description | Key | Data type |
|---|---|---|---|
| name | Item name | | confirm |
| branch | Branch | | confirm |
| qty | Quantity at the branch | | confirm |
| best_before | Expiry date | | confirm |
| supplies stock | Supplies on hand | | confirm |

## Sales Transactions
| Attribute | Description | Key | Data type |
|---|---|---|---|
| time | Time of the sale | | confirm |
| product_name | Product sold | FK | confirm |
| staff_name | Staff who recorded it | FK | confirm |
| qty | Quantity sold | | confirm |

## Dispatch Records
| Attribute | Description | Key | Data type |
|---|---|---|---|
| date | Dispatch date | | confirm |
| batch# | Batch number | | confirm |
| products | Products dispatched (multi-valued) | | confirm |
| qty | Quantity dispatched | | confirm |
| staff_name | Staff who dispatched | FK | confirm |

## Discrepancy
| Attribute | Description | Key | Data type |
|---|---|---|---|
| discrepancyid | Unique identifier | PK | confirm |
| expected quantity | Quantity the ledger expected | | confirm |
| variance | Expected minus counted | | confirm |
| status | Open, approved, adjusted, etc. | | confirm |

## Daily Sales Summary
| Attribute | Description | Key | Data type |
|---|---|---|---|
| date | Summary date | | confirm |
| sales_qty | Total quantity sold | | confirm |
| flags_number | Number of discrepancy flags | | confirm |
| flags_status | Status of the flags | | confirm |
| stocks_status | Stock status for the day | | confirm |

## Weekly Audits
| Attribute | Description | Key | Data type |
|---|---|---|---|
| date | Audit week date | | confirm |
| sales_qty | Total quantity sold in the week | | confirm |
| flags_number | Number of flags in the week | | confirm |
| flags_status | Status of the flags | | confirm |
| stocks_status | Stock status for the week | | confirm |
