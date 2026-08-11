import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwind from "@tailwindcss/vite";

// Basic Vite config for Vercel deployment
export default defineConfig({
  plugins: [react(), tsconfigPaths(), tailwind()],
});
