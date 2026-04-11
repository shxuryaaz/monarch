import { useQuery } from "@tanstack/react-query";
import { ApiError, getAsset } from "@/lib/api";

const REFETCH_MS = 15_000;

export function useAsset(assetId: string | undefined) {
  return useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => getAsset(assetId!),
    enabled: Boolean(assetId),
    refetchInterval: REFETCH_MS,
    retry: (count, err) => {
      if (err instanceof ApiError && err.status === 404) return false;
      return count < 2;
    }
  });
}
