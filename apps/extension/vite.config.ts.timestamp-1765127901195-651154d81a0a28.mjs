// vite.config.ts
import { defineConfig } from "file:///Users/apple/Documents/Dev/Extenda/node_modules/.pnpm/vite@5.4.21/node_modules/vite/dist/node/index.js";
import react from "file:///Users/apple/Documents/Dev/Extenda/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21/node_modules/@vitejs/plugin-react/dist/index.js";
import { crx } from "file:///Users/apple/Documents/Dev/Extenda/node_modules/.pnpm/@crxjs+vite-plugin@2.2.1/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// manifest.json
var manifest_default = {
  manifest_version: 3,
  name: "Extenda - AI Executive Assistant",
  version: "0.0.1",
  description: "Autonomous AI agent for browser automation",
  permissions: [
    "activeTab",
    "storage",
    "tabs",
    "scripting",
    "sidePanel"
  ],
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  side_panel: {
    default_path: "src/sidepanel/index.html"
  },
  action: {
    default_title: "Open Extenda"
  },
  content_scripts: [
    {
      matches: [
        "<all_urls>"
      ],
      js: [
        "src/content/index.ts"
      ]
    }
  ],
  host_permissions: [
    "<all_urls>"
  ]
};

// vite.config.ts
import path from "path";
var __vite_injected_original_dirname = "/Users/apple/Documents/Dev/Extenda/apps/extension";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    crx({ manifest: manifest_default })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAibWFuaWZlc3QuanNvbiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy9hcHBsZS9Eb2N1bWVudHMvRGV2L0V4dGVuZGEvYXBwcy9leHRlbnNpb25cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9hcHBsZS9Eb2N1bWVudHMvRGV2L0V4dGVuZGEvYXBwcy9leHRlbnNpb24vdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2FwcGxlL0RvY3VtZW50cy9EZXYvRXh0ZW5kYS9hcHBzL2V4dGVuc2lvbi92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCB7IGNyeCB9IGZyb20gJ0Bjcnhqcy92aXRlLXBsdWdpbic7XG5pbXBvcnQgbWFuaWZlc3QgZnJvbSAnLi9tYW5pZmVzdC5qc29uJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICAgIHBsdWdpbnM6IFtcbiAgICAgICAgcmVhY3QoKSxcbiAgICAgICAgY3J4KHsgbWFuaWZlc3QgfSksXG4gICAgXSxcbiAgICByZXNvbHZlOiB7XG4gICAgICAgIGFsaWFzOiB7XG4gICAgICAgICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgICAgICB9LFxuICAgIH0sXG4gICAgc2VydmVyOiB7XG4gICAgICAgIHBvcnQ6IDUxNzMsXG4gICAgICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgICAgIGhtcjoge1xuICAgICAgICAgICAgcG9ydDogNTE3MyxcbiAgICAgICAgfSxcbiAgICB9LFxufSk7XG4iLCAie1xuICAgIFwibWFuaWZlc3RfdmVyc2lvblwiOiAzLFxuICAgIFwibmFtZVwiOiBcIkV4dGVuZGEgLSBBSSBFeGVjdXRpdmUgQXNzaXN0YW50XCIsXG4gICAgXCJ2ZXJzaW9uXCI6IFwiMC4wLjFcIixcbiAgICBcImRlc2NyaXB0aW9uXCI6IFwiQXV0b25vbW91cyBBSSBhZ2VudCBmb3IgYnJvd3NlciBhdXRvbWF0aW9uXCIsXG4gICAgXCJwZXJtaXNzaW9uc1wiOiBbXG4gICAgICAgIFwiYWN0aXZlVGFiXCIsXG4gICAgICAgIFwic3RvcmFnZVwiLFxuICAgICAgICBcInRhYnNcIixcbiAgICAgICAgXCJzY3JpcHRpbmdcIixcbiAgICAgICAgXCJzaWRlUGFuZWxcIlxuICAgIF0sXG4gICAgXCJiYWNrZ3JvdW5kXCI6IHtcbiAgICAgICAgXCJzZXJ2aWNlX3dvcmtlclwiOiBcInNyYy9iYWNrZ3JvdW5kL2luZGV4LnRzXCIsXG4gICAgICAgIFwidHlwZVwiOiBcIm1vZHVsZVwiXG4gICAgfSxcbiAgICBcInNpZGVfcGFuZWxcIjoge1xuICAgICAgICBcImRlZmF1bHRfcGF0aFwiOiBcInNyYy9zaWRlcGFuZWwvaW5kZXguaHRtbFwiXG4gICAgfSxcbiAgICBcImFjdGlvblwiOiB7XG4gICAgICAgIFwiZGVmYXVsdF90aXRsZVwiOiBcIk9wZW4gRXh0ZW5kYVwiXG4gICAgfSxcbiAgICBcImNvbnRlbnRfc2NyaXB0c1wiOiBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIFwibWF0Y2hlc1wiOiBbXG4gICAgICAgICAgICAgICAgXCI8YWxsX3VybHM+XCJcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBcImpzXCI6IFtcbiAgICAgICAgICAgICAgICBcInNyYy9jb250ZW50L2luZGV4LnRzXCJcbiAgICAgICAgICAgIF1cbiAgICAgICAgfVxuICAgIF0sXG4gICAgXCJob3N0X3Blcm1pc3Npb25zXCI6IFtcbiAgICAgICAgXCI8YWxsX3VybHM+XCJcbiAgICBdXG59Il0sCiAgIm1hcHBpbmdzIjogIjtBQUFxVSxTQUFTLG9CQUFvQjtBQUNsVyxPQUFPLFdBQVc7QUFDbEIsU0FBUyxXQUFXOzs7QUNGcEI7QUFBQSxFQUNJLGtCQUFvQjtBQUFBLEVBQ3BCLE1BQVE7QUFBQSxFQUNSLFNBQVc7QUFBQSxFQUNYLGFBQWU7QUFBQSxFQUNmLGFBQWU7QUFBQSxJQUNYO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQ0o7QUFBQSxFQUNBLFlBQWM7QUFBQSxJQUNWLGdCQUFrQjtBQUFBLElBQ2xCLE1BQVE7QUFBQSxFQUNaO0FBQUEsRUFDQSxZQUFjO0FBQUEsSUFDVixjQUFnQjtBQUFBLEVBQ3BCO0FBQUEsRUFDQSxRQUFVO0FBQUEsSUFDTixlQUFpQjtBQUFBLEVBQ3JCO0FBQUEsRUFDQSxpQkFBbUI7QUFBQSxJQUNmO0FBQUEsTUFDSSxTQUFXO0FBQUEsUUFDUDtBQUFBLE1BQ0o7QUFBQSxNQUNBLElBQU07QUFBQSxRQUNGO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQUEsRUFDQSxrQkFBb0I7QUFBQSxJQUNoQjtBQUFBLEVBQ0o7QUFDSjs7O0FEL0JBLE9BQU8sVUFBVTtBQUpqQixJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUN4QixTQUFTO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixJQUFJLEVBQUUsMkJBQVMsQ0FBQztBQUFBLEVBQ3BCO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDTCxPQUFPO0FBQUEsTUFDSCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDeEM7QUFBQSxFQUNKO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDSixNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsSUFDWixLQUFLO0FBQUEsTUFDRCxNQUFNO0FBQUEsSUFDVjtBQUFBLEVBQ0o7QUFDSixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
