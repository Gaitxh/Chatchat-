import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import process from "node:process";

const chatChatVersion = process.env.npm_package_version ?? "dev";

export default defineConfig({
  plugins: [react()],
  publicDir: "extension-public",
  define: {
    __CHATCHAT_VERSION__: JSON.stringify(chatChatVersion),
  },
  build: {
    outDir: "dist-extension",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: path.resolve("app/app.html"),
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
