import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error keep the frontend package free of @types/node.
import path from "node:path";
// @ts-expect-error keep the frontend package free of @types/node.
import process from "node:process";

const chatChatVersion = process.env.npm_package_version ?? "dev";

export default defineConfig({
  plugins: [react()],
  publicDir: "extension-public",
  define: {
    __CHATCHAT_VERSION__: JSON.stringify(chatChatVersion),
  },
  resolve: {
    alias: [
      {
        find: "../provider-sdk/council-agent.js",
        replacement: path.resolve("src/extension/consultation-wire.ts"),
      },
    ],
  },
  build: {
    outDir: "dist-extension",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: path.resolve("extension/sidepanel.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
