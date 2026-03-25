import { motion } from "framer-motion";

const fadeIn = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7 },
};

const ProblemSolution = () => {
  return (
    <section className="border-t border-border px-6 py-28">
      <div className="mx-auto grid max-w-6xl gap-16 md:grid-cols-2 md:gap-20">
        <motion.div {...fadeIn}>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            The Problem
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Trillions in assets, locked away.
          </h2>
          <ul className="mt-6 space-y-4">
            {[
              "Illiquid assets with no easy exit",
              "Slow, manual settlement processes",
              "Access limited to accredited investors",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-secondary-foreground">
                <span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground" />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div {...fadeIn} transition={{ duration: 0.7, delay: 0.15 }}>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            The Solution
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Ownership, reimagined.
          </h2>
          <ul className="mt-6 space-y-4">
            {[
              "Fractional ownership starting at $10",
              "Instant liquidity through on-chain trading",
              "Global access, no gatekeepers",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-secondary-foreground">
                <span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-foreground" />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
};

export default ProblemSolution;
