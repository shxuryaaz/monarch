import { Link, NavLink } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Droplets,
  Home,
  LayoutDashboard,
  ListPlus,
  LogOut,
  Store,
  Wallet
} from "lucide-react";
import { useChainId, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { sepolia } from "wagmi/chains";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useWalletAuth } from "@/hooks/use-wallet-auth";
import { useWalletLiquidity } from "@/hooks/use-wallet-liquidity";
import { useToast } from "@/hooks/use-toast";
import { wagmiConfig } from "@/lib/wagmi";
import { CONTRACTS, mockUsdcAbi } from "@/lib/chain";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", to: "/", icon: Home },
  { label: "Marketplace", to: "/marketplace", icon: Store },
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard }
];

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en", {
    notation: Math.abs(n) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(n) >= 100_000 ? 2 : 4
  }).format(n);
}

type SidebarNavProps = {
  onNavigate?: () => void;
  /** Desktop rail mode (lg+ only; mobile sheet ignores) */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function SidebarNav({ onNavigate, collapsed = false, onToggleCollapsed }: SidebarNavProps) {
  const isMobileSheet = Boolean(onNavigate);
  const rail = !isMobileSheet && collapsed;
  const { token, shortAddress, connectAndSignIn, logout, isPending } = useWalletAuth();
  const { toast } = useToast();
  const chainId = useChainId();
  const { ethFormatted, usdcFormatted, refetchAll } = useWalletLiquidity();
  const { writeContractAsync } = useWriteContract();

  const runFaucet = async () => {
    if (chainId !== sepolia.id) {
      toast({ title: "Switch to Sepolia", description: "Mock USDC faucet only works on Sepolia.", variant: "destructive" });
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: CONTRACTS.mockUsdc,
        abi: mockUsdcAbi,
        functionName: "faucet"
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      await refetchAll();
      toast({ title: "Test USDC minted", description: "+10,000 USDC on MockUSDC." });
    } catch (e) {
      toast({
        title: "Faucet failed",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive"
      });
    }
  };

  const ethNum = ethFormatted != null ? Number(ethFormatted) : null;
  const usdcNum = usdcFormatted != null ? Number(usdcFormatted) : null;

  const navItemClass = (isActive: boolean) =>
    cn(
      "flex items-center rounded-lg text-sm font-medium transition-colors",
      rail ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
      isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
    );

  const walletMenu = token ? (
    <>
      <DropdownMenuLabel className="font-normal">
        <span className="text-xs text-muted-foreground">Wallet</span>
        <p className="truncate font-mono text-sm text-foreground">{shortAddress}</p>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      {ethNum != null && usdcNum != null ? (
        <>
          <div className="space-y-2 px-2 py-2 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Sepolia ETH</span>
              <span className="tabular-nums text-foreground">{formatCompact(ethNum)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Mock USDC</span>
              <span className="tabular-nums text-foreground">{formatCompact(usdcNum)}</span>
            </div>
          </div>
          <DropdownMenuSeparator />
        </>
      ) : null}
      <DropdownMenuItem className="cursor-pointer" onClick={() => void runFaucet()}>
        <Droplets className="mr-2 h-4 w-4" />
        Mint test USDC
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="cursor-pointer" onClick={logout}>
        <LogOut className="mr-2 h-4 w-4" />
        Log out
      </DropdownMenuItem>
    </>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "border-b border-border",
          rail ? "flex flex-col items-center gap-2 px-2 py-3" : "px-4 py-5",
          !rail && !isMobileSheet && onToggleCollapsed && "pr-2"
        )}
      >
        {!rail ? (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link
                to="/"
                onClick={onNavigate}
                className="text-lg font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80"
              >
                Monarch
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">RWA marketplace</p>
            </div>
            {onToggleCollapsed && !isMobileSheet ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground"
                title="Collapse sidebar"
                onClick={onToggleCollapsed}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            {onToggleCollapsed && !isMobileSheet ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                title="Expand sidebar"
                onClick={onToggleCollapsed}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : null}
            <Link
              to="/"
              onClick={onNavigate}
              title="Monarch home"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/40 text-sm font-bold text-foreground"
            >
              M
            </Link>
          </>
        )}
      </div>

      <nav aria-label="Primary" className={cn("flex flex-1 flex-col gap-0.5 overflow-y-auto", rail ? "p-2" : "p-3")}>
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              title={rail ? item.label : undefined}
              className={({ isActive }) => navItemClass(isActive)}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
              {!rail ? item.label : null}
            </NavLink>
          );
        })}
        {token ? (
          <NavLink
            to="/list-asset"
            onClick={onNavigate}
            title={rail ? "List an asset" : undefined}
            className={({ isActive }) => navItemClass(isActive)}
          >
            <ListPlus className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
            {!rail ? "List an asset" : null}
          </NavLink>
        ) : null}
      </nav>

      <div className={cn("mt-auto border-t border-border", rail ? "p-2" : "p-4")}>
        {token ? (
          rail ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="secondary" size="icon" className="w-full border border-border" title="Wallet">
                  <Wallet className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                {walletMenu}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-secondary/40 px-3 py-3">
                <p className="text-xs font-medium text-muted-foreground">Wallet</p>
                <p className="mt-1 truncate font-mono text-sm text-foreground">{shortAddress}</p>
                {ethNum != null && usdcNum != null ? (
                  <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    <div className="flex justify-between gap-2">
                      <span>Sepolia ETH</span>
                      <span className="tabular-nums text-foreground">{formatCompact(ethNum)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Mock USDC</span>
                      <span className="tabular-nums text-foreground">{formatCompact(usdcNum)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start gap-2 rounded-lg border border-border"
                  onClick={() => void runFaucet()}
                >
                  <Droplets className="h-4 w-4" />
                  Mint test USDC
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground hover:text-foreground"
                  onClick={logout}
                >
                  Log out
                </Button>
              </div>
            </div>
          )
        ) : rail ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="w-full border border-border"
            title="Sign in"
            disabled={isPending}
            onClick={() => void connectAndSignIn()}
          >
            <Wallet className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            className="w-full rounded-lg"
            variant="secondary"
            disabled={isPending}
            onClick={() => void connectAndSignIn()}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Sign in with wallet
          </Button>
        )}
      </div>
    </div>
  );
}
