import { defineConfig } from "vite";

export default defineConfig({
  build: {
    minify: false,
    manifest: true,
    rollupOptions: {
      // overwrite default .html entry
      input: "/src/frontend/main.ts",
      output: {
        manualChunks: undefined,
        entryFileNames: "plugin.js",
      },
    },
  },
});
