import { prisma } from "../db/prisma.js";
import { getChainContext } from "../services/blockchain.service.js";

let txMonitorTickInFlight = false;

export function startTxMonitorWorker() {
  setInterval(async () => {
    if (txMonitorTickInFlight) return;
    txMonitorTickInFlight = true;
    try {
      const { provider } = getChainContext();
      if (!provider) {
        return;
      }
      let blockNumber: number;
      try {
        blockNumber = await provider.getBlockNumber();
      } catch {
        return;
      }
      await prisma.transactionEvent.create({
        data: {
          chainId: "11155111",
          txHash: `heartbeat-${blockNumber}`,
          blockNumber,
          eventType: "HEARTBEAT"
        }
      }).catch(() => undefined);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[tx-monitor.worker]", err);
    } finally {
      txMonitorTickInFlight = false;
    }
  }, 30_000);
}
