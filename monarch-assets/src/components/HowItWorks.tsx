import { motion } from "framer-motion";
import { Layers, ArrowLeftRight, TrendingUp } from "lucide-react";

const steps = [
  {
    icon: Layers,
    title: "Tokenize",
    description: "Real-world assets are verified, legally structured, and represented as on-chain tokens.",
  },
  {
    icon: ArrowLeftRight,
    title: "Trade",
    description: "Buy and sell fractional shares instantly on a global, 24/7 marketplace.",
  },
  {
    icon: TrendingUp,
    title: "Earn",
    description: "Collect yield from rental income, harvests, and asset appreciation.",
  },
];

const HowItWorks = () => {
  return (
    <section className="border-t border-border px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            How It Works
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Three steps to ownership
          </h2>
        </motion.div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              className="rounded-xl border border-border p-8 surface-elevated"
            >
              <step.icon className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
              <h3 className="mt-5 text-xl font-semibold text-foreground">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-secondary-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
