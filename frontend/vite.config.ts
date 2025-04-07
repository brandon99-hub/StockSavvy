import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(async ({ mode }) => {
    const isProduction = mode === "production";
    let cartographerPlugin;

    if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
        const module = await import("@replit/vite-plugin-cartographer");
        cartographerPlugin = module.cartographer();
    }

    return {
        base: isProduction ? "/static/" : "/",
        root: path.resolve(__dirname, "client"),
        plugins: [
            react(),
            runtimeErrorOverlay(),
            themePlugin(),
            ...(cartographerPlugin ? [cartographerPlugin] : []),
        ],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "client/src"),
                "@shared": path.resolve(__dirname, "shared"),
                "@assets": path.resolve(__dirname, "attached_assets"),
            },
        },
        build: {
            outDir: path.resolve(__dirname, "../dist"), // Changed to ../dist
            emptyOutDir: true,
        },
        server: {
            proxy: {
                "/api": {
                    target: "http://localhost:8000",
                    changeOrigin: true,
                    secure: false,
                    ws: true,
                },
            },
        },
    };
});