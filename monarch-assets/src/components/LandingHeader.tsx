import { Link } from "react-router-dom";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWalletAuth } from "@/hooks/use-wallet-auth";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

type Props = {
  onLaunchApp: () => void;
  className?: string;
};

export default function LandingHeader({ onLaunchApp, className }: Props) {
  const { token } = useWalletAuth();

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl",
        className
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground"
        >
          <BrandMark size="sm" />
          Monarch
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/marketplace"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Marketplace
          </Link>
          {token ? (
            <Button type="button" variant="secondary" size="sm" className="gap-1.5 rounded-full border border-border" asChild>
              <Link to="/dashboard">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </Link>
            </Button>
          ) : (
            <Button type="button" size="sm" className="gap-1.5 rounded-full" onClick={onLaunchApp}>
              Launch app
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
