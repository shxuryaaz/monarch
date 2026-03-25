import { motion } from "framer-motion";
import CrystalBackground from "@/components/CrystalBackground";
import { useWalletAuth } from "@/hooks/use-wallet-auth";

const Hero = () => {
  const { token, connectAndSignIn, isPending } = useWalletAuth();
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-16">
      {/* 3D crystal background (behind content) */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <CrystalBackground />
      </div>

      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Soft center glow */}
      <div className="absolute top-1/2 left-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full glow-subtle" />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-5xl font-bold leading-[1.1] tracking-tight text-foreground md:text-7xl"
        >
          Own the world's assets.
          <br />
          <span className="text-secondary-foreground">On-chain.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-secondary-foreground"
        >
          Invest in real estate and agriculture through fractional ownership. 
          Trade globally. Earn yield.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-10 flex items-center justify-center gap-4"
        >
          <button
            type="button"
            onClick={() => {
              document.getElementById("featured")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Explore Assets
          </button>
          <button
            type="button"
            disabled={isPending || !!token}
            onClick={() => void connectAndSignIn()}
            className="rounded-full border border-border px-7 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
          >
            {token ? "Signed in" : "Sign in with wallet"}
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
