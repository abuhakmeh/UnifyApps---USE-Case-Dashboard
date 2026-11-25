// Analyst agent: turns what the Scout read into a structured use-case profile (EN + AR).
import { z } from "zod";
import { VERTICALS, USE_CASE_TYPES, STAGES, guessType, guessVerticals } from "../taxonomy.js";
import { aiEnabled, structured } from "./claude.js";

const Profile = z.object({
  title: z.string().describe("Short product-style name of the use case, max 8 words"),
  title_ar: z.string().describe("The title in Modern Standard Arabic"),
  summary: z.string().describe("One or two crisp sentences: what it does and for whom"),
  summary_ar: z.string().describe("The summary in Modern Standard Arabic"),
  problem: z.string().describe("The business problem in one sentence"),
  type: z.enum(USE_CASE_TYPES),
  secondary_types: z.array(z.enum(USE_CASE_TYPES)).describe("0-2 additional types"),
  verticals: z.array(z.enum(VERTICALS)).describe("1-4 industries this use case serves, most relevant first"),
  stage: z.enum(STAGES).describe("Maturity: a clickable demo is usually Prototype"),
  capabilities: z.array(z.string()).describe("3-6 short capability phrases, e.g. 'KYC document extraction'"),
  integrations: z.array(z.string()).describe("Named systems or platforms involved, e.g. Salesforce, SAP, WhatsApp. Empty if none are evident"),
  personas: z.array(z.string()).describe("1-3 user personas"),
  tags: z.array(z.string()).describe("3-6 lowercase search tags"),
  customer: z.object({
    name: z.string().nullable().describe("End-customer organisation the prototype is built for, if clearly identifiable; null otherwise. Never the platform vendor."),
    domain: z.string().nullable().describe("Customer's primary web domain, e.g. emiratesnbd.com, or null"),
  }),
});

const SYSTEM = `You are the Analyst agent of an enterprise use-case catalogue for UnifyApps, an enterprise AI, agents and integration platform.
You receive what a crawler read from a prototype link (metadata, visible text, sometimes a screenshot) plus optional hints from the owner.
Build an accurate, executive-ready profile. Prefer evidence from the content; when the content is thin, infer sensibly from the URL, title and screenshot and keep claims modest.
The audience is customers, so write in confident, plain business language without hype. Arabic must be natural Modern Standard Arabic, not transliteration.
UnifyApps itself is the platform vendor and is never the customer.`;

export async function analyse(scouted, hints = {}) {
  const corpus = [scouted.title, scouted.description, scouted.text, hints.notes, hints.customer].filter(Boolean).join("\n");

  if (!aiEnabled()) return heuristicProfile(scouted, hints, corpus);

  const content = [];
  if (scouted.screenshotBase64) {
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: scouted.screenshotBase64 } });
  }
  content.push({
    type: "text",
    text: [
      `<link>${scouted.url}</link>`,
      `<page_title>${scouted.title || "(none)"}</page_title>`,
      `<meta_description>${scouted.description || "(none)"}</meta_description>`,
      `<visible_text>\n${(scouted.text || "(page text unavailable)").slice(0, 12000)}\n</visible_text>`,
      hints.customer ? `<owner_hint_customer>${hints.customer}</owner_hint_customer>` : "",
      hints.notes ? `<owner_notes>${hints.notes}</owner_notes>` : "",
      scouted.notes?.length ? `<crawler_notes>${scouted.notes.join("; ")}</crawler_notes>` : "",
      "Build the profile.",
    ].filter(Boolean).join("\n"),
  });

  const p = await structured({ system: SYSTEM, content, schema: Profile });
  return { ...p, analyzer: "claude" };
}

function heuristicProfile(scouted, hints, corpus) {
  const type = guessType(corpus);
  const verticals = guessVerticals(corpus);
  const rawTitle = (scouted.title || scouted.host || "New use case").split(/[|\-–—]/)[0].trim().slice(0, 70);
  const summary = (scouted.description || scouted.text || "").split(/(?<=[.!?])\s/).slice(0, 2).join(" ").slice(0, 240)
    || `A ${type.toLowerCase()} prototype for ${verticals.join(", ")}.`;
  return {
    title: rawTitle,
    title_ar: "",
    summary,
    summary_ar: "",
    problem: "",
    type,
    secondary_types: [],
    verticals,
    stage: "Prototype",
    capabilities: [],
    integrations: [],
    personas: [],
    tags: [type, ...verticals].map((s) => s.toLowerCase()),
    customer: { name: hints.customer || null, domain: null },
    analyzer: "heuristic",
  };
}
