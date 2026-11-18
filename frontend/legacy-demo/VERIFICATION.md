# Frontend Verification

## Completed checks

| Check | Result |
| --- | --- |
| JavaScript syntax (`app.js`, `data.js`) | Passed with `node --check` |
| Optional Python launcher syntax | Passed with Python compilation |
| All 53 screen routes | Loaded in desktop Chrome, each with its expected screen heading |
| Desktop horizontal layout | No document-level horizontal overflow across all 53 routes |
| Sidebar correction | `Product` and `Materials` visible throughout the shared navigation |
| Excess sale quantity | Rejected with available-stock feedback |
| Valid sale | Confirmation displayed; branch balance reduced from 42 to 39 |
| Offline synchronization | Confirmation displayed for the two seeded queued records |
| Production output | 100 units added; illustrative hub summary changed from 311 to 411 |
| Dispatch creation | New DSP-0088 created and source stock reduced |
| Actual branch receipt | 58 received against 60 dispatched; variance displayed |
| Duplicate receipt | Second submission rejected, preventing a second stock credit |
| Material receiving | Flour increased from 8 to 33 kg after a 25 kg delivery |
| Material closing | 20 opening − 8 closing computed as 12 kg usage |
| Staff account | ACC-005 / Jamie Cruz created and permissions saved |
| Daily closing | Count comparison and submitted confirmation displayed |
| Owner adjustment | Ledger changed from 42 to 40; resolved confirmation displayed |
| Delivery resolution | Owner resolution confirmation displayed |
| Weekly sign-off | Completed after closing and discrepancy resolution |
| Next opening | 40 + 50 + 25 = 115 units carried forward without a second receipt |
| Report scope | Market Road dispatch view showed only DSP-0086 |
| CSV export | Browser download started successfully |
| Persistence | Scoped report selection and records remained after reload |
| Reset utility | Restored original demo records |

Visual inspection used the uploaded JPEG references and the rendered desktop app. The login/dashboard, shared navigation, form layouts and confirmation presentation were inspected in Chrome. The 53 route checks verify rendering and heading presence; they do not represent pixel-difference tests for every screen.

## Boundaries

This is a local frontend demonstration. No backend, production security, concurrent-user behavior or live data was tested. Responsive styles are included; physical mobile devices and a cross-browser matrix were not tested. Printing uses the browser print dialog; a standalone generated PDF is not included.
