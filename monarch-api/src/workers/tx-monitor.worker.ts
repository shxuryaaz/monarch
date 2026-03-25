import { prisma } from "../db/prisma.js";
import { getChainContext } from "../services/blockchain.service.js";

export function startTxMonitorWorker() {
  setInterval(async () => {
    const { provider } = getChainContext();
    if (!provider) {
      return;
    }
    const blockNumber = await provider.getBlockNumber();
    await prisma.transactionEvent.create({
      data: {
        chainId: "11155111",
        txHash: `heartbeat-${blockNumber}`,
        blockNumber,
        eventType: "HEARTBEAT"
      }
    }).catch(() => undefined);
  }, 30_000);
}
