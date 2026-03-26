import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";
import CrystalBackground from "@/components/CrystalBackground";
import { useWalletAuth } from "@/hooks/use-wallet-auth";

type Props = {
  onOpenAuth: () => void;
};

const Hero = ({ onOpenAuth }: Props) => {
  const { token, isPending } = useWalletAuth();
  return (
    <section className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden px-4 pb-12 pt-6 sm:px-6 lg:px-10">
      {/* 3D crystal — shifted right on large screens + soft edge fade so it doesn’t sit on the headline */}
      <div
        className="pointer-events-none absolute inset-0 z-0 translate-x-[6%] scale-[0.88] sm:scale-90 max-lg:[-webkit-mask-image:unset] max-lg:[mask-image:unset] lg:translate-x-[20%] lg:scale-[1.02] lg:[-webkit-mask-image:linear-gradient(90deg,transparent_0%,rgba(0,0,0,0.2)_14%,black_38%)] lg:[mask-image:linear-gradient(90deg,transparent_0%,rgba(0,0,0,0.2)_14%,black_38%)]"
        aria-hidden="true"
      >
        <CrystalBackground />
      </div>

      {/* Subtle grid background */}
      <div
        className="absolute inset-0 z-[1] opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)`,
          backgroundSize: "60px 60px"
        }}
      />

      {/* Soft center glow (behind typography panel) */}
      <div className="absolute top-1/2 left-1/2 z-[1] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full glow-subtle" />

      {/* Readable slab: contrast + blur so wireframe never wins over type */}
      <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
        <div className="rounded-[2rem] border border-border/50 bg-background/80 px-6 py-9 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:px-10 sm:py-11 supports-[backdrop-filter]:bg-background/65">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-6xl font-bold leading-[0.95] tracking-tight text-foreground sm:text-7xl md:text-8xl"
          >
            Monarch
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.3 }}
            className="mx-auto mt-5 max-w-xl text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-2xl md:mt-6 md:text-[1.65rem] md:leading-tight"
          >
            Own the world&apos;s assets.
            <span className="text-secondary-foreground"> On-chain.</span>
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.45 }}
            className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg md:mt-6"
          >
            Invest in real estate and agriculture through fractional ownership.
            Trade globally. Earn yield.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.58 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <button
              type="button"
              onClick={() => {
                document.getElementById("featured")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Explore assets
            </button>
            {token ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-7 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <LayoutDashboard className="h-4 w-4" />
                Go to dashboard
              </Link>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={onOpenAuth}
                className="rounded-full border border-border px-7 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
              >
                {isPending ? "Waiting for wallet…" : "Sign in with wallet"}
              </button>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
