import { seed, startServer } from "./database.mjs";
await seed();
const { origin } = await startServer();
console.log("ISOLATED_TEST_ORIGIN=" + origin);
