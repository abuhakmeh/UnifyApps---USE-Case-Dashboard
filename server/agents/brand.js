// Brand agent: finds and stores the customer's logo so cards can show it.
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, newId } from "../db.js";
import { assertPublicUrl } from "./scout.js";
import { aiEnabled, structured } from "./claude.js";
import { z } from "zod";

const UA = "Mozilla/5.0 (compatible; UseCaseScout/1.0)";

async function download(url) {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const type = res.headers.get("content-type") || "";
  if (!type.startsWith("image/")) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 300) return null; // blank/placeholder icons
  const ext = type.includes("svg") ? "svg" : type.includes("png") ? "png" : type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "ico";
  const file = `logo-${newId()}.${ext}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, file), buf);
  return `/uploads/${file}`;
}

async function resolveDomain(name) {
  if (!aiEnabled()) return null;
  const r = await structured({
    system: "You map organisation names to their primary official web domain.",
    content: [{ type: "text", text: `Organisation: ${name}\nReturn its main official domain (no protocol), or null if you are not confident.` }],
    schema: z.object({ domain: z.string().nullable() }),
    effort: "low",
  });
  return r.domain;
}

export async function findLogo(customer) {
  if (!customer?.name && !customer?.domain) return null;
  let domain = (customer.domain || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!domain) domain = (await resolveDomain(customer.name).catch(() => null)) || "";
  if (!domain && customer.name) domain = customer.name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com"; // best guess
  if (!domain) return { domain: null, logo: null };

  // 1) the site's own high-res touch icon
  try {
    const u = await assertPublicUrl(`https://${domain}`);
    const html = await (await fetch(u.href, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10000) })).text();
    const tags = html.match(/<link[^>]+rel=["'][^"']*(apple-touch-icon|icon)[^"']*["'][^>]*>/gi) || [];
    const best = tags
      .map((t) => ({ href: t.match(/href=["']([^"']+)["']/i)?.[1], size: +(t.match(/sizes=["'](\d+)/i)?.[1] || (/apple/i.test(t) ? 180 : 32)) }))
      .filter((t) => t.href)
      .sort((a, b) => b.size - a.size)[0];
    if (best && best.size >= 96) {
      const logo = await download(new URL(best.href, u.href).href);
      if (logo) return { domain, logo };
    }
  } catch { /* fall through */ }

  // 2) favicon service
  const logo = await download(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`).catch(() => null);
  return { domain, logo };
}
