import { defineConfig } from "vite";

export default defineConfig({
  build: {
    manifest: true,
    rollupOptions: {
      // overwrite default .html entry
      input: "/src/frontend/main.ts",
      assetFileNames: "plugin.js",
      output: {
        entryFileNames: "plugin.js",
      },
    },
  },
});
