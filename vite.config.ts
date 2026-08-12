import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error create-tauri-app uses this without pulling @types/node into the frontend.
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;
const chatChatVersion = process.env.npm_package_version ?? "dev";

export default defineConfig(() => ({
  plugins: [react()],
  define: {
    __CHATCHAT_VERSION__: JSON.stringify(chatChatVersion),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    outDir: "dist-ui",
    emptyOutDir: true,
  },
}));
