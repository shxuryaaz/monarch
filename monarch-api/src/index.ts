import { app } from "./app.js";
import { env } from "./config/env.js";
import { startOracleWorker } from "./workers/oracle.worker.js";
import { startTxMonitorWorker } from "./workers/tx-monitor.worker.js";

app.listen(env.PORT, () => {
  startOracleWorker();
  startTxMonitorWorker();
  // eslint-disable-next-line no-console
  console.log(`monarch-api listening on :${env.PORT}`);
});
