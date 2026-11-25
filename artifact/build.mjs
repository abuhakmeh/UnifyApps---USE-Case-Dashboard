// npm run build:artifact → artifact/dist/use-case-universe.html, ready to publish as a claude.ai Artifact.
import { build } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
await build({ configFile: path.join(here, "vite.config.js"), logLevel: "warn" });
const out = path.join(here, "build");
const js = fs.readFileSync(path.join(out, "app.js"), "utf8");
const cssFile = fs.readdirSync(out).find((f) => f.endsWith(".css"));
const css = fs.readFileSync(path.join(out, cssFile), "utf8");
const page = `<title>Use Case Universe</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script>${js.replace(/<\/script/gi, "<\\/script")}</script>
`;
fs.mkdirSync(path.join(here, "dist"), { recursive: true });
const file = path.join(here, "dist", "use-case-universe.html");
fs.writeFileSync(file, page);
console.log(`wrote ${path.relative(process.cwd(), file)} (${(page.length / 1024).toFixed(0)} KB)`);
