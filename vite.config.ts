import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error keep the frontend package free of @types/node.
import process from "node:process";

const chatChatVersion = process.env.npm_package_version ?? "dev";

export default defineConfig({
  plugins: [react()],
  publicDir: "extension-public",
  define: {
    __CHATCHAT_VERSION__: JSON.stringify(chatChatVersion),
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: "dist-web",
    emptyOutDir: true,
  },
});
