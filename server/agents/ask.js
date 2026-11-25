// Ask agent: enterprise search / context-graph Q&A over the catalogue. Claude decides which
// tools to call (search, fetch details, portfolio stats, graph neighbours) and answers with
// citations to use-case ids. Without a key it falls back to ranked keyword search.
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { claude, aiEnabled, MODEL, FALLBACK } from "./claude.js";
import { search, stats, graph } from "../search.js";

const brief = (u) => ({
  id: u.id, title: u.title, type: u.type, verticals: u.verticals, stage: u.stage, customer: u.customer?.name || null,
  summary: u.summary, roi: u.roi ? { headline: u.roi.headline, annual_value_usd: u.roi.annual_value_usd, payback_months: u.roi.payback_months } : null,
  assets: u.assets.map((a) => a.kind),
});

export async function ask(question, { list, lang = "en", history = [] }) {
  const ready = list.filter((u) => u.status === "ready");
  if (!aiEnabled()) {
    const hits = search(ready, { q: question, limit: 6 });
    return {
      answer: hits.length
        ? (lang === "ar" ? `وجدت ${hits.length} حالات استخدام ذات صلة:` : `I found ${hits.length} relevant use case${hits.length > 1 ? "s" : ""}:`) + "\n" + hits.map((u) => `- **${u.title}** — ${u.summary} [[${u.id}]]`).join("\n")
        : lang === "ar" ? "لم أجد نتائج مطابقة. جرّب كلمات أخرى." : "No matching use cases yet. Try different keywords.",
      citations: hits.map((u) => u.id),
      mode: "keyword",
    };
  }

  const tools = [
    betaTool({
      name: "search_use_cases",
      description: "Keyword search over the catalogue with optional exact filters. Returns brief records. Use several searches with synonyms when needed.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text keywords; empty string returns everything matching the filters" },
          vertical: { type: "string" }, type: { type: "string" }, stage: { type: "string" }, customer: { type: "string" },
        },
        required: ["query"],
      },
      run: async (i) => JSON.stringify(search(ready, { q: i.query, vertical: i.vertical, type: i.type, stage: i.stage, customer: i.customer, limit: 15 }).map(brief)),
    }),
    betaTool({
      name: "get_use_case",
      description: "Full record of one use case by id, including capabilities, integrations, ROI assumptions and attached notes.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      run: async ({ id }) => {
        const u = ready.find((x) => x.id === id);
        return u ? JSON.stringify({ ...u, pipeline: undefined, source: undefined, screenshot: undefined }) : "Not found";
      },
    }),
    betaTool({
      name: "portfolio_stats",
      description: "Aggregates for the whole portfolio: counts by vertical, type, stage, integrations, total estimated value, gaps.",
      inputSchema: { type: "object", properties: {} },
      run: async () => { const s = stats(ready); delete s.activity; return JSON.stringify(s); },
    }),
    betaTool({
      name: "graph_neighbors",
      description: "Context graph: given an entity label (a vertical, type, customer, integration or use-case title), list the entities connected to it.",
      inputSchema: { type: "object", properties: { label: { type: "string" } }, required: ["label"] },
      run: async ({ label }) => {
        const g = graph(ready);
        const hit = g.nodes.find((n) => n.label.toLowerCase() === label.toLowerCase()) || g.nodes.find((n) => n.label.toLowerCase().includes(label.toLowerCase()));
        if (!hit) return "No such entity";
        const ids = g.links.flatMap((l) => (l.source === hit.id ? [l.target] : l.target === hit.id ? [l.source] : []));
        return JSON.stringify({ entity: hit, neighbors: g.nodes.filter((n) => ids.includes(n.id)).map((n) => ({ label: n.label, kind: n.kind, useCaseId: n.useCaseId })) });
      },
    }),
  ];

  const system = `You are the Ask agent of the UnifyApps use-case catalogue, used by sales engineers and shown to customers.
Answer questions about the use cases in the catalogue using the tools; never invent use cases, customers or numbers that the tools did not return.
Cite every use case you mention inline as [[id]]. Keep answers short and scannable (bullets welcome). ROI figures are estimates, so say so when you quote them.
If customer names appear as anonymous labels like "Banking client", keep them anonymous.
Reply in ${lang === "ar" ? "Modern Standard Arabic" : "English"}.`;

  const messages = [
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];

  const final = await claude().beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    max_iterations: 8,
    output_config: { effort: "low" },
    system,
    tools,
    messages,
  });
  if (final.stop_reason === "refusal") return { answer: lang === "ar" ? "تعذر الإجابة على هذا السؤال." : "I can't help with that question.", citations: [], mode: "ai" };
  const answer = final.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  const citations = [...new Set([...answer.matchAll(/\[\[([a-f0-9]{12})\]\]/g)].map((m) => m[1]))];
  return { answer, citations, mode: "ai" };
}
