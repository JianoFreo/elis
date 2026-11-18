import { ENV } from "./config/env.js";
import { connectNeon, syncSchema } from "./config/db.js";
import { buildApp } from "./app.js";

await connectNeon();
if (ENV.IS_PRODUCTION) await syncSchema();

const server = buildApp().listen(ENV.PORT, () => console.log(`Listening on ${ENV.PORT}`));

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
