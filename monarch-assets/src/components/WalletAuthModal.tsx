import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWalletAuth } from "@/hooks/use-wallet-auth";
import { useToast } from "@/hooks/use-toast";
import { Wallet } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function WalletAuthModal({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { connectAndSignIn, isPending } = useWalletAuth();
  const { toast } = useToast();

  const handleConnect = async () => {
    try {
      await connectAndSignIn();
      onOpenChange(false);
      navigate("/dashboard");
    } catch (e) {
      toast({
        title: "Could not sign in",
        description: e instanceof Error ? e.message : "Wallet or network error.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect your wallet</DialogTitle>
          <DialogDescription>
            Sign in with Ethereum (SIWE) to open your dashboard, trade, and view portfolio metrics. You&apos;ll approve a
            message in your wallet—no password on our servers. Use a normal browser window if your wallet extension
            isn&apos;t detected (many extensions are disabled in Incognito).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="w-full gap-2"
            disabled={isPending}
            onClick={() => void handleConnect()}
          >
            <Wallet className="h-4 w-4" />
            {isPending ? "Waiting for wallet…" : "Connect wallet & sign in"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
