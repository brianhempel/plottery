import { defineConfig } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

export default defineConfig({
  plugins: [cssInjectedByJsPlugin()],
  build: {
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
