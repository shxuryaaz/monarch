import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { getProvider } from "../services/blockchain.service.js";

/** How often the chain heartbeat polls Sepolia block height (ms). */
const TX_MONITOR_INTERVAL_MS = 30_000;

export function startTxMonitorWorker() {
  setInterval(async () => {
    try {
      if (!env.SEPOLIA_RPC_URL) return;
      const provider = getProvider();
      const blockNumber = await provider.getBlockNumber();
      await prisma.transactionEvent.create({
        data: {
          chainId: "11155111",
          txHash: `heartbeat-${blockNumber}`,
          blockNumber,
          eventType: "HEARTBEAT"
        }
      }).catch(() => undefined);
    } catch {
      // Swallowed: provider already logs RPC errors via its "error" event listener.
    }
  }, TX_MONITOR_INTERVAL_MS);
}
