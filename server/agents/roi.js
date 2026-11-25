// ROI agent: estimates the expected business value of a use case with explicit assumptions.
import { z } from "zod";
import { ROI_BENCHMARKS } from "../taxonomy.js";
import { aiEnabled, structured } from "./claude.js";

const Roi = z.object({
  headline: z.string().describe("One punchy line, e.g. 'Cuts onboarding time by 70%'"),
  headline_ar: z.string().describe("The headline in Modern Standard Arabic"),
  annual_value_usd: z.number().describe("Conservative annual value in USD for a mid-to-large enterprise"),
  payback_months: z.number(),
  hours_saved_per_year: z.number(),
  efficiency_gain_pct: z.number().describe("0-100"),
  metrics: z.array(z.object({ label: z.string(), label_ar: z.string(), value: z.string() })).describe("3-4 KPI tiles, e.g. 'Handling time' / '-65%'"),
  assumptions: z.array(z.string()).describe("2-4 short assumptions behind the numbers"),
  confidence: z.enum(["low", "medium", "high"]),
});

const SYSTEM = `You are the ROI agent of an enterprise use-case catalogue. Given a use-case profile, estimate the value a typical mid-to-large customer in the stated verticals could expect.
Be conservative and defensible: use realistic volumes and loaded labour costs for the region implied by the content (default to GCC/MENA enterprise if unclear), state assumptions, and never present estimates as guaranteed.`;

export async function estimateRoi(profile) {
  if (!aiEnabled()) return heuristicRoi(profile);
  const r = await structured({
    system: SYSTEM,
    content: [{ type: "text", text: `<profile>${JSON.stringify({
      title: profile.title, summary: profile.summary, problem: profile.problem, type: profile.type,
      verticals: profile.verticals, capabilities: profile.capabilities, personas: profile.personas,
    })}</profile>\nEstimate the ROI.` }],
    schema: Roi,
    effort: "low",
  });
  return { ...r, estimatedBy: "claude" };
}

function heuristicRoi(profile) {
  const b = ROI_BENCHMARKS[profile.type] || { hours: 5000, efficiency: 30, payback: 6 };
  const value = Math.round((b.hours * 38) / 1000) * 1000;
  return {
    headline: `~${b.efficiency}% faster ${profile.type.toLowerCase()} processes`,
    headline_ar: `تسريع العمليات بنحو ${b.efficiency}٪`,
    annual_value_usd: value,
    payback_months: b.payback,
    hours_saved_per_year: b.hours,
    efficiency_gain_pct: b.efficiency,
    metrics: [
      { label: "Efficiency gain", label_ar: "رفع الكفاءة", value: `${b.efficiency}%` },
      { label: "Hours saved / yr", label_ar: "ساعات موفرة سنوياً", value: b.hours.toLocaleString("en-US") },
      { label: "Payback", label_ar: "فترة الاسترداد", value: `${b.payback} mo` },
    ],
    assumptions: ["Industry benchmark for this use-case type", "Loaded cost of $38 per hour"],
    confidence: "low",
    estimatedBy: "benchmark",
  };
}
