import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getKycStatus, type KYCStatus, type KYCSubmission } from "@/lib/api";
import { useWalletAuth } from "@/hooks/use-wallet-auth";

export type KYCStatusResult = {
  kycStatus: KYCStatus | null;
  submission: KYCSubmission | null;
  isLoading: boolean;
  refetch: () => void;
};

export function useKycStatus(): KYCStatusResult {
  const { token } = useWalletAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["kyc-status", token],
    queryFn: () => getKycStatus(token!),
    enabled: Boolean(token),
    staleTime: 30_000
  });

  const refetch = () => {
    void queryClient.invalidateQueries({ queryKey: ["kyc-status"] });
  };

  return {
    kycStatus: data?.kycStatus ?? null,
    submission: data?.submission ?? null,
    isLoading,
    refetch
  };
}
