import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds the private claude.ai Artifact edition as one script + one stylesheet with every
// asset inlined; build.mjs then folds them into a single page.
export default defineConfig({
  root: new URL(".", import.meta.url).pathname,
  plugins: [react()],
  build: {
    outDir: "build", emptyOutDir: true, assetsInlineLimit: 100_000_000, cssCodeSplit: false, modulePreload: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { format: "iife", inlineDynamicImports: true, entryFileNames: "app.js", assetFileNames: "[name][extname]" } },
  },
});
