# Eli’s Yummy Kitchen — Complete Frontend

Recreated as editable HTML, CSS and JavaScript from the 53 screen exports in `Eli's Yummy Kitchen.zip` and the Figma information available in this conversation. The desktop layout follows the supplied screens: 232px sidebar, 92px top bar, Inter typography, pink accents, white cards, tables and form layouts. The original exports are reference images, not page backgrounds: the interface consists of real text, controls and layouts.

## Professor’s wording corrections

| Original sidebar wording | Implemented wording |
| --- | --- |
| Inventory | **Product** |
| Supplies | **Materials** |

The corrections apply across the shared sidebar. Related material page labels have also been made consistent. Descriptive phrases such as “opening inventory” remain where they refer to a stock count.

## Run it — easiest method

1. Extract the entire ZIP.
2. Open the `dist` folder.
3. Double-click **index.html** in Chrome or Edge.

No npm install, build step, XAMPP or database is needed for this frontend. All scripts, styles and fonts are included locally.

The login is a **demo entry screen**. Leave its prefilled values and click **Sign in to dashboard**. It does not authenticate against a server. Demo username: `juan.delacruz`; demo password: `demo123`.

## Run in VS Code

Open this folder in VS Code. Use Live Server on `dist/index.html`, or use the optional Python server:

```bash
python run.py
```

On Windows, double-click `START_WINDOWS.bat` if Python is installed. It opens `http://127.0.0.1:5500`. Stop the terminal with Ctrl+C when finished. If Python is unavailable, use the direct `dist/index.html` method above.

## Files to edit

| File | Purpose |
| --- | --- |
| `dist/index.html` | App entry page and local script/style links |
| `dist/styles.css` | Shared styling, desktop layout, responsive layout and print styling |
| `dist/data.js` | All 53 route definitions, sidebar labels and sample records |
| `dist/app.js` | Screen templates, navigation, form validation and local demo interactions |
| `dist/assets/` | Local Inter fonts and their license |
| `dist/reset-demo.html` | Optional utility to restore the original demo records |
| `run.py` | Optional standard-library Python server |
| `START_WINDOWS.bat` | Optional Windows launcher |

## Included frontend behavior

- Login and role/workspace selection; nine sidebar modules.
- Product selection, live sale totals, quantity checks, confirmed sales and stock reduction.
- Browser-local offline queue, synchronization and duplicate local-reference protection.
- Physical closing counts, variance comparison and daily closing submission.
- Product master editing, production output and stock baseline/received-stock entry.
- Dispatch creation, hub stock reduction, actual branch receipt and duplicate-receipt prevention.
- Material registration, receiving, shift opening, closing and calculated daily usage.
- Low-stock alerts, count discrepancies, owner adjustments and delivery resolution.
- Weekly audit views, sign-off and next opening baseline without a second stock credit.
- Demo staff accounts and configurable permissions.
- Report scope selection, local illustrative record filtering, CSV exports and print layouts.
- Browser back/forward navigation, keyboard form controls, dialog focus containment, Escape dismissal and responsive layouts.

## A useful demonstration sequence

1. Sign in and open **Sales & closing**.
2. Record a sale, review the updated balance and synchronize the queued examples.
3. Enter closing counts and submit the closing.
4. Open **Discrepancies**, review the count flag and approve the adjustment.
5. Review and resolve the delivery discrepancy.
6. Open **Weekly audits**, review the audit, then open the ready-state screen and sign off. The sign-off action requires the local closing to be submitted and all discrepancy flags resolved.
7. Set the next opening baseline.

Other flows can be demonstrated independently using **Product**, **Dispatch**, **Materials**, **Accounts** and **Reports**. The original Figma screens show different stages of example workflows; balances update as actions are performed, so later values can differ from the initial exports.

For report filtering, most seeded records use **08 Nov 2026**. Sales examples belong to Main Street, materials to Main hub, and dispatches list their destination branches. A scope with no illustrative records shows an empty state. Stock summary cards preserve the broader illustrative totals shown in the design; the sample tables intentionally contain only the visible example rows.

## Reset the demonstration

Open `dist/reset-demo.html` using the **same method and browser origin** used for the app, then click **Reset demo and open sign in**. If using the Python server, open `http://127.0.0.1:5500/reset-demo.html`. This removes only this app’s browser-local demo records.

You can also run `resetKitchenDemo()` in the browser developer console.

## Backend integration boundary

This deliverable is the frontend. It does not include a PHP/Node backend, database, real authentication, server-enforced permissions, multi-user synchronization, email alerts or an immutable audit trail. Demo records and activity events are saved in `localStorage` in the current browser. Temporary passwords are not saved to the account records. Do not use the demo as a production authentication or inventory service.

To connect a future backend, replace the state mutations in the `handlers` object in `dist/app.js` with API requests and populate the view records from server responses. Keep stock validation, permissions, transactional updates and audit enforcement on the server.

## Visual reference and verification

The supplied JPEG exports are flattened, fixed-height references. This is a close code recreation of those exports, not a claim of pixel-identical output at every viewport. The screen design is desktop-first; narrow screens adapt for usability. Content outside the exported image bounds uses the shared design system.

See `SCREEN_MAP.md` for the complete 53-screen route list and `VERIFICATION.md` for checks performed.
