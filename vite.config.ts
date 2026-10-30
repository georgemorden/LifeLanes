import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "pages" ? "/LifeLanes/" : "/",
  plugins: [react(), {
    name: "production-content-security-policy",
    apply: "build",
    transformIndexHtml: (html) => html.replace("connect-src 'self' ws: wss:", "connect-src 'self'"),
  }],
}));
