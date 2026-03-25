import { useQuery } from "@tanstack/react-query";
import { getPortfolio } from "@/lib/api";

const REFETCH_MS = 15_000;

export function usePortfolio(token: string | undefined) {
  return useQuery({
    queryKey: ["portfolio", token],
    queryFn: () => getPortfolio(token!),
    enabled: !!token,
    refetchInterval: REFETCH_MS
  });
}
