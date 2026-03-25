import { motion } from "framer-motion";
import { NavLink, Link } from "react-router-dom";
import { Droplets, Menu, Wallet } from "lucide-react";
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
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useWalletAuth } from "@/hooks/use-wallet-auth";
import { useWalletLiquidity } from "@/hooks/use-wallet-liquidity";
import { useToast } from "@/hooks/use-toast";
import { wagmiConfig } from "@/lib/wagmi";
import { CONTRACTS, mockUsdcAbi } from "@/lib/chain";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", to: "/" },
  { label: "Marketplace", to: "/marketplace" },
  { label: "Dashboard", to: "/dashboard" }
];

function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en", {
    notation: Math.abs(n) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(n) >= 100_000 ? 2 : 4
  }).format(n);
}

const navPillClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-full px-4 py-2 text-sm transition-colors",
    isActive ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground"
  );

const navRowClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
    isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
  );

const Navbar = () => {
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

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl"
    >
      <div className="relative mx-auto flex h-[3.75rem] max-w-7xl items-center px-4 sm:px-6">
        {/* Left: brand */}
        <div className="relative z-20 flex shrink-0 items-center">
          <Link to="/" className="text-lg font-semibold tracking-tight text-foreground">
            Monarch
          </Link>
        </div>

        {/* Center: nav (true viewport center) */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <nav
            aria-label="Primary"
            className="pointer-events-auto hidden items-center gap-0.5 rounded-full border border-border/80 bg-secondary/50 p-1 md:flex"
          >
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} className={navPillClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right: auth + wallet menu */}
        <div className="relative z-20 ml-auto flex items-center gap-2 sm:gap-3">
          {/* Mobile menu */}
          <div className="flex md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary text-foreground transition-colors hover:bg-accent"
                >
                  <Menu className="h-5 w-5" strokeWidth={1.8} />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-[min(100vw,360px)] flex-col p-0">
                <SheetHeader className="border-b border-border px-6 py-4 text-left">
                  <SheetTitle className="text-base font-semibold">Menu</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Navigate</p>
                  <div className="flex flex-col gap-1">
                    {navLinks.map((link) => (
                      <SheetClose asChild key={link.label}>
                        <NavLink to={link.to} className={navRowClass}>
                          {link.label}
                        </NavLink>
                      </SheetClose>
                    ))}
                  </div>

                  <div className="my-6 h-px bg-border" />

                  {token ? (
                    <>
                      <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Wallet
                      </p>
                      <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm">
                        <p className="font-mono text-foreground">{shortAddress}</p>
                        {ethNum != null && usdcNum != null && (
                          <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                            <div className="flex justify-between gap-4">
                              <span>Sepolia ETH</span>
                              <span className="tabular-nums text-foreground">{formatCompact(ethNum)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>Mock USDC</span>
                              <span className="tabular-nums text-foreground">{formatCompact(usdcNum)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-3 w-full rounded-full border border-border"
                        onClick={() => void runFaucet()}
                      >
                        <Droplets className="mr-2 h-4 w-4" />
                        Mint test USDC
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-2 w-full rounded-full border border-border"
                        onClick={logout}
                      >
                        Log out
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      className="w-full rounded-full"
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => void connectAndSignIn()}
                    >
                      Sign in with wallet
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop: sign in or wallet dropdown */}
          <div className="hidden md:flex md:items-center md:gap-2">
            {token ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 gap-2 rounded-full border border-border px-4 text-sm font-medium"
                  >
                    <Wallet className="h-4 w-4 opacity-70" />
                    <span className="max-w-[9rem] truncate font-mono text-xs sm:max-w-none">{shortAddress}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="font-normal">
                    <span className="text-xs text-muted-foreground">Connected</span>
                    <p className="truncate font-mono text-sm text-foreground">{shortAddress}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ethNum != null && usdcNum != null && (
                    <>
                      <div className="space-y-2 px-2 py-2 text-sm">
                        <div className="flex justify-between gap-4 text-xs">
                          <span className="text-muted-foreground">Sepolia ETH</span>
                          <span className="tabular-nums text-foreground">{formatCompact(ethNum)}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-xs">
                          <span className="text-muted-foreground">Mock USDC</span>
                          <span className="tabular-nums text-foreground">{formatCompact(usdcNum)}</span>
                        </div>
                      </div>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => void runFaucet()} className="cursor-pointer">
                    <Droplets className="mr-2 h-4 w-4" />
                    Mint test USDC (faucet)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-foreground focus:text-foreground">
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="rounded-full border border-border px-5 text-sm font-medium"
                disabled={isPending}
                onClick={() => void connectAndSignIn()}
              >
                Sign in with wallet
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
