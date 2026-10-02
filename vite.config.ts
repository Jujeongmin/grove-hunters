import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { cssCacheBust } from "./vite-plugins/cssCacheBust";

export default defineConfig({
  // cssCacheBust: the editor container caches .css for 4 hours; see the plugin.
  plugins: [react(), cssCacheBust()],
  // Verse8 serves the game from a sub-path; root-absolute URLs 404 there.
  base: "./",
  // Two React copies (SDK peer dep) cause "Invalid hook call"; pin one.
  resolve: { dedupe: ["react", "react-dom"] },
  optimizeDeps: {
    include: ["@agent8/gameserver", "react", "react-dom", "react/jsx-runtime"],
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    watch: {
      ignored: ["**/.git/**", "**/node_modules/**", "**/public/assets/**", "**/art-src/**", "**/dist/**"],
    },
  },
  build: {
    outDir: "dist", reportCompressedSize: false, chunkSizeWarningLimit: 5000,
    // Fonts are fetched as files rather than written into the CSS as base64: the stylesheet blocks the
    // first paint, and most of those subsets (and every .woff fallback) are never used.
    assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined),
    rollupOptions: {
      output: {
        // Libraries in chunks of their own: a game update then leaves them cached in the browser.
        advancedChunks: {
          groups: [
            { name: "three", test: /node_modules[\\/]three[\\/]/ },
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
});
