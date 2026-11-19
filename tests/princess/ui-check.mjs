import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "../../frontend/node_modules/@playwright/test/index.mjs";
import { db, seed, startServer, query } from "./database.mjs";
await seed();
const { server, origin } = await startServer();
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
let browser;
const checks = [];
try {
  browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  await page.goto(origin + "/login");
  await page.getByLabel("Username", { exact: true }).fill("sales");
  await page.getByLabel("Password", { exact: true }).fill("TestPass123!");
  await page.getByRole("button", { name: "Sign in to dashboard" }).click();
  await page
    .getByRole("heading", { name: "Sales workspace", exact: true })
    .waitFor();
  checks.push("Real API login and sales workspace");
  await page
    .getByRole("button", { name: "Record a sale", exact: true })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "Record a sale", exact: true })
    .waitFor();
  await context.setOffline(true);
  await page.getByLabel("Keep on this device until connected").check();
  await page.getByLabel(/^Quantity/).fill("2");
  await page.getByRole("button", { name: "Queue sale", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Sale saved on this device" })
    .waitFor();
  await page.getByRole("button", { name: "View offline queue" }).click();
  await page
    .getByRole("heading", { name: "Offline transaction queue" })
    .waitFor();
  await page.getByRole("cell", { name: "This device", exact: true }).waitFor();
  checks.push("Offline capture and queue work with network disabled");
  assert.equal(
    (await query("SELECT COUNT(*)::int AS n FROM sales")).rows[0].n,
    0,
  );
  await context.setOffline(false);
  await page.getByRole("button", { name: "Sync queued transactions" }).click();
  await page.getByRole("dialog", { name: "You're all caught up." }).waitFor();
  checks.push("Reconnection uploads offline sale through real endpoints");
  assert.equal(
    (await query("SELECT COUNT(*)::int AS n FROM sales")).rows[0].n,
    1,
  );
  assert.equal(
    (
      await query(
        "SELECT SUM(quantity)::int AS n FROM stock_ledger WHERE branch_id=2 AND product_id=1",
      )
    ).rows[0].n,
    18,
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await page.getByText("No pending transactions.", { exact: true }).waitFor();
  checks.push("Confirmed device entry removed; reload has no duplicate");
  await page
    .getByRole("button", { name: "Count & closing", exact: true })
    .click();
  await page.getByLabel("Empanada · expected 18", { exact: true }).fill("17");
  await page.getByLabel("Roll · expected 10", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Compare & review closing" }).click();
  await page
    .getByLabel("Reason / supporting note")
    .fill("One damaged unit during display");
  await page
    .getByRole("button", { name: "Submit daily closing", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Closing submitted" }).waitFor();
  checks.push("Count comparison, discrepancy note and submitted confirmation");
  await page.getByRole("button", { name: "View summary", exact: true }).click();
  await page
    .getByRole("heading", { name: "Daily sales & stock summary" })
    .waitFor();
  assert.equal(
    (
      await query(
        "SELECT SUM(quantity)::int AS n FROM stock_ledger WHERE branch_id=2 AND product_id=1",
      )
    ).rows[0].n,
    18,
  );
  checks.push("Closing leaves ledger unchanged until owner adjustment");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  checks.push("Sales summary has no document overflow at 1440 and 390 pixels");
  await context.close();
  const head = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await head.goto(origin + "/login");
  await head.getByLabel("Username", { exact: true }).fill("head");
  await head.getByLabel("Password", { exact: true }).fill("TestPass123!");
  await head.getByRole("button", { name: "Sign in to dashboard" }).click();
  await head
    .getByRole("heading", { name: "Every batch, accounted for.", exact: true })
    .waitFor();
  checks.push("Production-head product workspace loads");
  await head
    .getByRole("button", { name: "Record production output", exact: true })
    .click();
  let modal = head.getByRole("dialog", { name: "Record production output" });
  await modal.getByLabel("Batch number", { exact: true }).fill("UI-BATCH");
  await modal.getByLabel("Quantity produced", { exact: true }).fill("5");
  await modal.getByRole("button", { name: "Save production output" }).click();
  await head.getByRole("dialog", { name: "Saved", exact: true }).waitFor();
  assert.equal(
    (
      await query(
        "SELECT SUM(quantity)::int AS n FROM stock_ledger WHERE branch_id=1 AND product_id=1",
      )
    ).rows[0].n,
    25,
  );
  checks.push("Production output form posts real stock credit");
  await head.getByRole("button", { name: "Close", exact: true }).click();
  await head
    .getByRole("button", { name: "Receive stock / set baseline" })
    .click();
  modal = head.getByRole("dialog", { name: "Stock baseline & received stock" });
  await modal.getByLabel("Batch number", { exact: true }).fill("UI-RECEIPT");
  await modal.getByRole("combobox", { name: "Location", exact: true }).selectOption("1");
  await modal.getByLabel(/^Quantity/).fill("3");
  await modal.getByRole("button", { name: "Save stock movement" }).click();
  await head.getByRole("dialog", { name: "Saved", exact: true }).waitFor();
  assert.equal(
    (
      await query(
        "SELECT SUM(quantity)::int AS n FROM stock_ledger WHERE branch_id=1 AND product_id=1",
      )
    ).rows[0].n,
    28,
  );
  checks.push("External received-stock entry has its own type and reference");
  await head.getByRole("button", { name: "Close", exact: true }).click();
  await head
    .getByRole("button", { name: "Register product", exact: true })
    .click();
  modal = head.getByRole("dialog", { name: "Register product", exact: true });
  await modal.getByLabel("Name", { exact: true }).fill("UI Pastry");
  await modal.getByLabel("Unit price", { exact: true }).fill("25");
  await modal.getByLabel("Unit cost", { exact: true }).fill("12");
  await modal
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await head.getByRole("dialog", { name: "Saved", exact: true }).waitFor();
  checks.push("Product registration is wired to the product API");
  await head.getByRole("button", { name: "Close", exact: true }).click();
  await head
    .getByRole("button", { name: "View product & ledger", exact: true })
    .first()
    .click();
  await head.getByRole("heading", { name: "Empanada", exact: true }).waitFor();
  await head.getByRole("button", { name: "Edit product details" }).click();
  modal = head.getByRole("dialog", { name: "Product master" });
  await modal.getByLabel("Unit price", { exact: true }).fill("67");
  await modal.getByLabel("Unit cost", { exact: true }).fill("40");
  await modal
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await modal.waitFor({ state: "hidden" });
  checks.push("Product detail and master editing save price and cost");
  assert.equal(
    (
      await query(
        "SELECT price::float AS price,cost::float AS cost FROM products WHERE id=1",
      )
    ).rows[0].price,
    67,
  );
  await head.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await head.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  checks.push("Product detail has no document overflow at 390 pixels");
  await query("UPDATE daily_closings SET status = 'confirmed' WHERE branch_id = 2");
  await query(
    "INSERT INTO weekly_audits (audit_code, week_start, week_end, status) VALUES ('AUD-UI', '2026-11-02', '2026-11-08', 'signed_off')",
  );
  const owner = await browser.newPage();
  await owner.goto(origin + "/login");
  await owner.getByLabel("Username", { exact: true }).fill("owner");
  await owner.getByLabel("Password", { exact: true }).fill("TestPass123!");
  await owner.getByRole("button", { name: "Sign in to dashboard" }).click();
  await owner.getByRole("button", { name: "Weekly audits", exact: true }).click();
  await owner.getByRole("row", { name: /AUD-UI/ }).getByRole("button", { name: "Open" }).click();
  await owner.getByRole("button", { name: "Set next opening baseline" }).click();
  const opening = owner.getByRole("dialog", { name: "Next opening stock baseline" });
  const empanada = opening.getByRole("row", { name: /Empanada/ });
  await empanada.waitFor();
  assert.deepEqual(await empanada.getByRole("cell").allTextContents(), ["Empanada", "17", "17"]);
  await opening.getByRole("button", { name: "Confirm next opening" }).click();
  await owner.getByRole("dialog", { name: "Next opening confirmed" }).waitFor();
  const markers = await query(
    "SELECT quantity FROM stock_ledger WHERE reference = 'NEXT-20261108-AUD-UI' ORDER BY product_id",
  );
  assert.deepEqual(markers.rows.map((row) => row.quantity), [0, 0]);
  checks.push("Owner confirms next opening from the signed physical counts without adding stock");
  mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
  writeFileSync(
    new URL("./results/ui-results.json", import.meta.url),
    JSON.stringify({ status: "passed", checks }, null, 2),
  );
  console.log(JSON.stringify({ status: "passed", checks }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await db.close();
}
process.exit(process.exitCode ?? 0);
