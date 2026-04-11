import { useAccount, useBalance } from "wagmi";
import { useReadContract } from "wagmi";
import { formatEther, formatUnits } from "viem";
import { CONTRACTS, erc20Abi } from "@/lib/chain";

export function useWalletLiquidity() {
  const { address } = useAccount();
  const { data: ethBalance, refetch: refetchEth } = useBalance({ address });
  const {
    data: usdcRaw,
    refetch: refetchUsdc,
    isFetching: usdcLoading
  } = useReadContract({
    address: CONTRACTS.mockUsdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) }
  });

  return {
    address,
    ethFormatted: ethBalance ? formatEther(ethBalance.value) : null,
    usdcFormatted: usdcRaw !== undefined ? formatUnits(usdcRaw as bigint, 6) : null,
    usdcRaw: usdcRaw as bigint | undefined,
    usdcLoading,
    refetchAll: () => {
      void refetchEth();
      void refetchUsdc();
    }
  };
}
