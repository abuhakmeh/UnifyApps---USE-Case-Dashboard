// Scout agent: reads the prototype link. Fetches the HTML, extracts metadata and visible text,
// and (when Playwright + Chromium are available) renders the page to capture a screenshot and
// the text of single-page apps that ship almost nothing in their raw HTML.
import dns from "node:dns/promises";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { UPLOAD_DIR, newId } from "../db.js";

const UA = "Mozilla/5.0 (compatible; UseCaseScout/1.0)";

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80");
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error("That does not look like a valid link"); }
  if (!/^https?:$/.test(u.protocol)) throw new Error("Only http(s) links are supported");
  if (process.env.ALLOW_PRIVATE_URLS === "true") return u;
  const { address } = await dns.lookup(u.hostname).catch(() => ({ address: null }));
  if (!address) throw new Error(`Could not resolve ${u.hostname}`);
  if (isPrivateIp(address)) throw new Error("Private network addresses are blocked");
  return u;
}

const decode = (s = "") => s
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1] || "").trim() : "";
}

export function extractFromHtml(html, baseUrl) {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  const abs = (h) => { try { return h ? new URL(h, baseUrl).href : ""; } catch { return ""; } };
  const iconHref = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/i)?.[0]?.match(/href=["']([^"']+)["']/i)?.[1];
  const text = decode(
    html.replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
  return {
    title: meta(html, "og:title") || title,
    description: meta(html, "og:description") || meta(html, "description"),
    image: abs(meta(html, "og:image")),
    siteName: meta(html, "og:site_name"),
    favicon: abs(iconHref) || abs("/favicon.ico"),
    text: text.slice(0, 15000),
  };
}

export function detectEmbeddable(url) {
  const u = String(url);
  if (/youtube\.com\/watch|youtu\.be\/|loom\.com\/share|vimeo\.com\/\d+|\.mp4($|\?)/i.test(u)) return "video";
  if (/docs\.google\.com\/presentation|\.pptx?($|\?)|\.pdf($|\?)|pitch\.com|gamma\.app/i.test(u)) return "deck";
  return null;
}

let browserPromise = null;
async function getBrowser() {
  if (process.env.DISABLE_BROWSER === "true") return null;
  if (!browserPromise) {
    browserPromise = (async () => {
      try {
        let pw;
        try { pw = await import("playwright"); } catch { pw = createRequire(import.meta.url)("playwright"); }
        const { chromium } = pw;
        const opts = { headless: true, args: ["--no-sandbox"] };
        if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
        return await chromium.launch(opts);
      } catch (e) {
        console.warn("[scout] headless browser unavailable, using HTML-only reading:", e.message.split("\n")[0]);
        return null;
      }
    })();
  }
  return browserPromise;
}

async function render(url) {
  const browser = await getBrowser();
  if (!browser) return null;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: UA });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const file = `shot-${newId()}.jpg`;
    const buf = await page.screenshot({ type: "jpeg", quality: 78 });
    await fs.promises.writeFile(path.join(UPLOAD_DIR, file), buf);
    const text = (await page.evaluate(() => document.body?.innerText || "")).replace(/\s+/g, " ").slice(0, 15000);
    const title = await page.title();
    return { screenshot: `/uploads/${file}`, screenshotBase64: buf.toString("base64"), text, title };
  } catch (e) {
    return { error: e.message.split("\n")[0] };
  } finally {
    await ctx.close().catch(() => {});
  }
}

export async function scout(url) {
  const u = await assertPublicUrl(url);
  const out = { url: u.href, host: u.hostname.replace(/^www\./, ""), title: "", description: "", text: "", image: "", favicon: "", screenshot: "", notes: [] };

  try {
    const res = await fetch(u.href, { headers: { "user-agent": UA, accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    const type = res.headers.get("content-type") || "";
    if (type.includes("html")) {
      const html = (await res.text()).slice(0, 2_000_000);
      Object.assign(out, extractFromHtml(html, res.url));
    } else {
      out.notes.push(`Link serves ${type || "unknown content"}`);
    }
    if (!res.ok) out.notes.push(`HTTP ${res.status}`);
  } catch (e) {
    out.notes.push(`Fetch failed: ${e.message}`);
  }

  const rendered = await render(u.href);
  if (rendered?.screenshot) {
    out.screenshot = rendered.screenshot;
    out.screenshotBase64 = rendered.screenshotBase64;
    if (rendered.text.length > out.text.length) out.text = rendered.text;
    if (!out.title) out.title = rendered.title;
  } else if (rendered?.error) {
    out.notes.push(`Render failed: ${rendered.error}`);
  }
  return out;
}
