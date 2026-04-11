import { useQuery } from "@tanstack/react-query";
import { getAssets } from "@/lib/api";

const REFETCH_MS = 15_000;

export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: getAssets,
    refetchInterval: REFETCH_MS
  });
}
