// vite.config.ts
import { defineConfig } from "vite"
import electron from "vite-plugin-electron"
import react from "@vitejs/plugin-react"
import path from "path"
import { builtinModules } from "node:module"

// Anything that uses native .node binaries, dynamic requires, or environment-
// based backend selection MUST be loaded from node_modules at runtime — NOT
// bundled. Bundling them produces a broken app (e.g. @xenova/transformers
// picks onnxruntime-web instead of onnxruntime-node, pg can't resolve its
// optional native binding chain, sharp's .node binary can't load).
const electronMainExternals = [
  "electron",
  "electron-store",
  "electron-updater",
  "electron-log",
  "@electron/notarize",
  "pg",
  "pg-native",
  "@xenova/transformers",
  "onnxruntime-node",
  "onnxruntime-web",
  "sharp",
  "screenshot-desktop",
  "@anthropic-ai/sdk",
  "openai",
  "groq-sdk",
  "axios",
  "form-data",
  "dotenv",
  "uuid",
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`)
]

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // main.ts
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            sourcemap: true,
            minify: false,
            rollupOptions: {
              external: electronMainExternals
            }
          }
        }
      },
      {
        // preload.ts
        entry: "electron/preload.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            sourcemap: true,
            rollupOptions: {
              external: electronMainExternals
            }
          }
        }
      }
    ])
  ],
  base: process.env.NODE_ENV === "production" ? "./" : "/",
  server: {
    port: 54321,
    strictPort: true,
    watch: {
      usePolling: true
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
})
