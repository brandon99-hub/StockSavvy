// vite.config.ts
import { defineConfig } from "file:///C:/Users/USERR/PycharmProjects/StockSavvy2/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/USERR/PycharmProjects/StockSavvy2/frontend/node_modules/@vitejs/plugin-react/dist/index.mjs";
import themePlugin from "file:///C:/Users/USERR/PycharmProjects/StockSavvy2/frontend/node_modules/@replit/vite-plugin-shadcn-theme-json/dist/index.mjs";
import runtimeErrorOverlay from "file:///C:/Users/USERR/PycharmProjects/StockSavvy2/frontend/node_modules/@replit/vite-plugin-runtime-error-modal/dist/index.mjs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
var __vite_injected_original_import_meta_url = "file:///C:/Users/USERR/PycharmProjects/StockSavvy2/frontend/vite.config.ts";
var __filename = fileURLToPath(__vite_injected_original_import_meta_url);
var __dirname = dirname(__filename);
var vite_config_default = defineConfig({
  root: path.resolve(__dirname, "client"),
  publicDir: path.resolve(__dirname, "client/public"),
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("file:///C:/Users/USERR/PycharmProjects/StockSavvy2/frontend/node_modules/@replit/vite-plugin-cartographer/dist/index.mjs").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets")
    }
  },
  build: {
    outDir: path.resolve(__dirname, "client/dist/public"),
    manifest: true,
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "client/index.html")
    }
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.NODE_ENV === "production" ? "https://stocksavvy-ahtd.onrender.com" : "http://localhost:8000",
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxVU0VSUlxcXFxQeWNoYXJtUHJvamVjdHNcXFxcU3RvY2tTYXZ2eTJcXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXFVTRVJSXFxcXFB5Y2hhcm1Qcm9qZWN0c1xcXFxTdG9ja1NhdnZ5MlxcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvVVNFUlIvUHljaGFybVByb2plY3RzL1N0b2NrU2F2dnkyL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHtkZWZpbmVDb25maWd9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5pbXBvcnQgdGhlbWVQbHVnaW4gZnJvbSBcIkByZXBsaXQvdml0ZS1wbHVnaW4tc2hhZGNuLXRoZW1lLWpzb25cIjtcbmltcG9ydCBydW50aW1lRXJyb3JPdmVybGF5IGZyb20gXCJAcmVwbGl0L3ZpdGUtcGx1Z2luLXJ1bnRpbWUtZXJyb3ItbW9kYWxcIjtcbi8vIEB0cy1pZ25vcmVcbmltcG9ydCBwYXRoLCB7ZGlybmFtZX0gZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7ZmlsZVVSTFRvUGF0aH0gZnJvbSBcInVybFwiO1xuXG4vLyBAdHMtaWdub3JlXG5jb25zdCBfX2ZpbGVuYW1lID0gZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpO1xuY29uc3QgX19kaXJuYW1lID0gZGlybmFtZShfX2ZpbGVuYW1lKTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgICBcbiAgICByb290OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcImNsaWVudFwiKSxcbiAgICBwdWJsaWNEaXI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiY2xpZW50L3B1YmxpY1wiKSxcblxuICAgIHBsdWdpbnM6IFtcbiAgICAgICAgcmVhY3QoKSxcbiAgICAgICAgcnVudGltZUVycm9yT3ZlcmxheSgpLFxuICAgICAgICB0aGVtZVBsdWdpbigpLFxuICAgICAgICAuLi4ocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09IFwicHJvZHVjdGlvblwiICYmXG4gICAgICAgIHByb2Nlc3MuZW52LlJFUExfSUQgIT09IHVuZGVmaW5lZFxuICAgICAgICAgICAgPyBbXG4gICAgICAgICAgICAgICAgYXdhaXQgaW1wb3J0KFwiQHJlcGxpdC92aXRlLXBsdWdpbi1jYXJ0b2dyYXBoZXJcIikudGhlbigobSkgPT5cbiAgICAgICAgICAgICAgICAgICAgbS5jYXJ0b2dyYXBoZXIoKVxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICBdXG4gICAgICAgICAgICA6IFtdKSxcbiAgICBdLFxuXG4gICAgcmVzb2x2ZToge1xuICAgICAgICBhbGlhczoge1xuICAgICAgICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiY2xpZW50L3NyY1wiKSxcbiAgICAgICAgICAgIFwiQHNoYXJlZFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcInNoYXJlZFwiKSxcbiAgICAgICAgICAgIFwiQGFzc2V0c1wiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcImF0dGFjaGVkX2Fzc2V0c1wiKSxcbiAgICAgICAgfSxcbiAgICB9LFxuXG4gICAgYnVpbGQ6IHtcbiAgICAgICAgb3V0RGlyOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcImNsaWVudC9kaXN0L3B1YmxpY1wiKSxcbiAgICAgICAgbWFuaWZlc3Q6IHRydWUsXG4gICAgICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxuICAgICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgICAgICBpbnB1dDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ2NsaWVudC9pbmRleC5odG1sJylcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBzZXJ2ZXI6IHtcbiAgICAgICAgcHJveHk6IHtcbiAgICAgICAgICAgIFwiL2FwaVwiOiB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0OiBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ3Byb2R1Y3Rpb24nXG4gICAgICAgICAgICAgICAgICAgID8gJ2h0dHBzOi8vc3RvY2tzYXZ2eS1haHRkLm9ucmVuZGVyLmNvbSdcbiAgICAgICAgICAgICAgICAgICAgOiAnaHR0cDovL2xvY2FsaG9zdDo4MDAwJyxcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB3czogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgfVxufSk7Il0sCiAgIm1hcHBpbmdzIjogIjtBQUF1VixTQUFRLG9CQUFtQjtBQUNsWCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFDeEIsT0FBTyx5QkFBeUI7QUFFaEMsT0FBTyxRQUFPLGVBQWM7QUFDNUIsU0FBUSxxQkFBb0I7QUFONkwsSUFBTSwyQ0FBMkM7QUFTMVEsSUFBTSxhQUFhLGNBQWMsd0NBQWU7QUFDaEQsSUFBTSxZQUFZLFFBQVEsVUFBVTtBQUVwQyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUV4QixNQUFNLEtBQUssUUFBUSxXQUFXLFFBQVE7QUFBQSxFQUN0QyxXQUFXLEtBQUssUUFBUSxXQUFXLGVBQWU7QUFBQSxFQUVsRCxTQUFTO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixvQkFBb0I7QUFBQSxJQUNwQixZQUFZO0FBQUEsSUFDWixHQUFJLFFBQVEsSUFBSSxhQUFhLGdCQUM3QixRQUFRLElBQUksWUFBWSxTQUNsQjtBQUFBLE1BQ0UsTUFBTSxPQUFPLDBIQUFrQyxFQUFFO0FBQUEsUUFBSyxDQUFDLE1BQ25ELEVBQUUsYUFBYTtBQUFBLE1BQ25CO0FBQUEsSUFDSixJQUNFLENBQUM7QUFBQSxFQUNYO0FBQUEsRUFFQSxTQUFTO0FBQUEsSUFDTCxPQUFPO0FBQUEsTUFDSCxLQUFLLEtBQUssUUFBUSxXQUFXLFlBQVk7QUFBQSxNQUN6QyxXQUFXLEtBQUssUUFBUSxXQUFXLFFBQVE7QUFBQSxNQUMzQyxXQUFXLEtBQUssUUFBUSxXQUFXLGlCQUFpQjtBQUFBLElBQ3hEO0FBQUEsRUFDSjtBQUFBLEVBRUEsT0FBTztBQUFBLElBQ0gsUUFBUSxLQUFLLFFBQVEsV0FBVyxvQkFBb0I7QUFBQSxJQUNwRCxVQUFVO0FBQUEsSUFDVixhQUFhO0FBQUEsSUFDYixlQUFlO0FBQUEsTUFDWCxPQUFPLEtBQUssUUFBUSxXQUFXLG1CQUFtQjtBQUFBLElBQ3REO0FBQUEsRUFDSjtBQUFBLEVBRUEsUUFBUTtBQUFBLElBQ0osT0FBTztBQUFBLE1BQ0gsUUFBUTtBQUFBLFFBQ0osUUFBUSxRQUFRLElBQUksYUFBYSxlQUMzQix5Q0FDQTtBQUFBLFFBQ04sY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLFFBQ1IsSUFBSTtBQUFBLE1BQ1I7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUNKLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
