import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
// @ts-ignore
import path, {dirname} from "path";
import {fileURLToPath} from "url";

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({

    root: path.resolve(__dirname, "client"),
    publicDir: path.resolve(__dirname, "client/public"),

    plugins: [
        react(),
        runtimeErrorOverlay(),
        themePlugin(),
        ...(process.env.NODE_ENV !== "production" &&
        process.env.REPL_ID !== undefined
            ? [
                await import("@replit/vite-plugin-cartographer").then((m) =>
                    m.cartographer()
                ),
            ]
            : []),
    ],

    resolve: {
        alias: {
            "@": path.resolve(__dirname, "client/src"),
            "@shared": path.resolve(__dirname, "shared"),
            "@assets": path.resolve(__dirname, "attached_assets"),
        },
    },

    build: {
        outDir: path.resolve(__dirname, "client/dist/public"),
        manifest: true,
        emptyOutDir: true,
        rollupOptions: {
            input: path.resolve(__dirname, 'client/index.html')
        }
    },

    server: {
        proxy: {
            "/api": {
                target: process.env.NODE_ENV === 'production'
                    ? 'https://stocksavvy-ahtd.onrender.com'
                    : 'http://localhost:8000',
                changeOrigin: true,
                secure: false,
                ws: true,
            },
        },
    }
});