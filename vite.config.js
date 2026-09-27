import { defineConfig } from "vite";

export default defineConfig({
  build: {
    minify: false,
    // Built into the Python package, which inlines both files into each Plottery output.
    outDir: "src/plottery/static",
    emptyOutDir: true,
    rollupOptions: {
      // overwrite default .html entry
      input: "/src/frontend/main.ts",
      output: {
        manualChunks: undefined,
        entryFileNames: "plugin.js",
        assetFileNames: (asset) => asset.name?.endsWith(".css") ? "plottery.css" : "assets/[name]-[hash][extname]",
      },
    },
  },
});
