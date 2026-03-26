import { motion } from "framer-motion";

const stats = [
  { value: "$280T+", label: "Real-world assets addressable" },
  { value: "24/7", label: "Always-on liquidity" },
  { value: "0%", label: "Hidden fees" },
];

const Stats = () => {
  return (
    <section className="border-t border-border px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <p className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
