import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwind from "@tailwindcss/vite";

// Basic Vite config for Vercel deployment
export default defineConfig({
  plugins: [tanstackRouter({ autoCodeSplitting: true }), react(), tsconfigPaths(), tailwind()],
});
