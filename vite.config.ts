import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    // SPA mode: the browser gets a prerendered shell and renders everything
    // else client-side. Server functions still run on the server, so the
    // database and the API key stay off the client.
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
  ],
});
