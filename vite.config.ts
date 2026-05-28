import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // "::" (IPv6) can trigger network interface resolution errors in some environments.
    // Binding to IPv4 loopback keeps local dev stable and predictable.
    host: "127.0.0.1",
    port: 8090,
    strictPort: true,
    // Nominatim (OSM): CORS e User-Agent em desenvolvimento; em produção o cliente usa o URL direto.
    proxy: {
      "/osm-nominatim": {
        target: "https://nominatim.openstreetmap.org",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/osm-nominatim/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("User-Agent", "PortalCPC/1.0 (perfil; dev proxy)");
          });
        },
      },
    },
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // TASK-TESTS: default 5s era apertado para PDF generation (pdf-lib é lento) e renders complexos
    // sob load do full suite (ex.: ProfilePage com múltiplas async + state changes). 15s é folga segura.
    testTimeout: 15000,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "functions/**",
      "**/firestore.rules.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/pages/dashboard/company/candidatesUtils.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/*.d.ts",
        "src/test/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
