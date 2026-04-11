import OpenAI from "openai";
import { env } from "../config/env.js";

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

export async function computeRiskScore(input: {
  type: string;
  expectedYieldPct: number;
  oracleYieldPct?: number | null;
}) {
  const baseline =
    input.type === "REAL_ESTATE"
      ? 0.25 + Math.max(0, input.expectedYieldPct - 7) * 0.03
      : 0.35 + Math.max(0, input.expectedYieldPct - 6) * 0.03;

  if (!openai) {
    return {
      score: Math.min(0.95, Number(baseline.toFixed(2))),
      label: baseline < 0.33 ? "LOW" : baseline < 0.66 ? "MEDIUM" : "HIGH"
    };
  }

  try {
    const completion = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `Return JSON {"score":0-1,"label":"LOW|MEDIUM|HIGH"} for asset type ${
        input.type
      }, expected yield ${input.expectedYieldPct}, oracle yield ${input.oracleYieldPct ?? "null"}.`
    });
    const raw = completion.output_text;
    const parsed = JSON.parse(raw);
    return {
      score: Number(parsed.score),
      label: String(parsed.label)
    };
  } catch {
    return {
      score: Math.min(0.95, Number(baseline.toFixed(2))),
      label: baseline < 0.33 ? "LOW" : baseline < 0.66 ? "MEDIUM" : "HIGH"
    };
  }
}
