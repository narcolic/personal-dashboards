import { defineConfig } from "vite";
import type { Plugin, ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwind from "@tailwindcss/vite";
import path from "path";
import type { IncomingMessage, ServerResponse } from "node:http";
import marketStatusHandler from "./api/market-status";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: {
    logErrors: false,
    logOptionsErrors: false,
  },
});

type EsbuildResolveArgs = {
  path: string;
};

type EsbuildBuild = {
  onResolve: (
    options: { filter: RegExp },
    callback: (args: EsbuildResolveArgs) => { path: string } | undefined,
  ) => void;
};

const esbuildAliasMap = new Map([
  ["#tanstack-router-entry", path.resolve(__dirname, "src/tanstack-router-entry.ts")],
  ["#tanstack-start-entry", path.resolve(__dirname, "src/tanstack-start-entry.ts")],
  [
    "#tanstack-start-plugin-adapters",
    path.resolve(__dirname, "src/tanstack-start-plugin-adapters.ts"),
  ],
  ["tanstack-start-manifest:v", path.resolve(__dirname, "src/tanstack-start-manifest.ts")],
  [
    "tanstack-start-injected-head-scripts:v",
    path.resolve(__dirname, "src/tanstack-start-injected-head-scripts.ts"),
  ],
  ["node:async_hooks", path.resolve(__dirname, "src/node-async-hooks.ts")],
  ["node:stream/web", path.resolve(__dirname, "src/node-stream-web.ts")],
  ["node:stream", path.resolve(__dirname, "src/node-stream.ts")],
]);

function createEsbuildAliasPlugin() {
  return {
    name: "esbuild-alias-plugin",
    setup(build: EsbuildBuild) {
      build.onResolve(
        {
          filter:
            /^(#tanstack-router-entry|#tanstack-start-entry|#tanstack-start-plugin-adapters|tanstack-start-manifest:v|tanstack-start-injected-head-scripts:v|node:async_hooks|node:stream\/web|node:stream)$/,
        },
        (args) => {
          const replacement = esbuildAliasMap.get(args.path);
          if (replacement) {
            return { path: replacement };
          }
        },
      );
    },
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Quote lookup failed";
}

function createQuotesApiDevPlugin(): Plugin {
  return {
    name: "quotes-api-dev-plugin",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/quotes", async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const raw = url.searchParams.get("symbols") ?? "";
          const symbols = Array.from(
            new Set(
              raw
                .split(",")
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean),
            ),
          ).slice(0, 100);

          if (symbols.length === 0) {
            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ quotes: [] }));
            return;
          }

          const quotes = await yahooFinance.quote(symbols, { return: "array" });
          const out = Array.isArray(quotes) ? quotes : [quotes];
          res.statusCode = 200;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ quotes: out }));
        } catch (error: unknown) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: errorMessage(error) }));
        }
      });
    },
  };
}

function createMarketStatusApiDevPlugin(): Plugin {
  return {
    name: "market-status-api-dev-plugin",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        "/api/market-status",
        async (req: IncomingMessage, res: ServerResponse) => {
          try {
            const url = new URL(req.url ?? "", "http://localhost");
            const exchanges = url.searchParams.getAll("exchanges");
            const query =
              exchanges.length === 0
                ? undefined
                : exchanges.length === 1
                  ? exchanges[0]
                  : exchanges;

            const apiRequest = {
              method: req.method ?? "GET",
              query: { exchanges: query },
            };

            const apiResponse = {
              status(code: number) {
                res.statusCode = code;
                res.setHeader("content-type", "application/json");
                return {
                  json(body: unknown) {
                    res.end(JSON.stringify(body));
                  },
                };
              },
            };

            await marketStatusHandler(apiRequest, apiResponse);
          } catch (error: unknown) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: errorMessage(error) }));
          }
        },
      );
    },
  };
}

function createFxRatesApiDevPlugin(): Plugin {
  return {
    name: "fx-rates-api-dev-plugin",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/api/fx-rates", async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const from = (url.searchParams.get("from") ?? "USD").trim().toUpperCase();

          const frankfurter = await fetch(
            `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}`,
          );
          if (frankfurter.ok) {
            const data = await frankfurter.json();
            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(data));
            return;
          }
        } catch {
          // fallback below
        }

        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const from = (url.searchParams.get("from") ?? "USD").trim().toUpperCase();
          const erApi = await fetch(
            `https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`,
          );
          if (erApi.ok) {
            const data = (await erApi.json()) as { rates?: Record<string, number> };
            if (data.rates) {
              res.statusCode = 200;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ rates: data.rates }));
              return;
            }
          }
        } catch {
          // final fallback below
        }

        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ rates: { USD: 1 } }));
      });
    },
  };
}

// Basic Vite config for Vercel deployment
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    tailwind(),
    createQuotesApiDevPlugin(),
    createMarketStatusApiDevPlugin(),
    createFxRatesApiDevPlugin(),
  ],
  resolve: {
    conditions: ["browser"],
    alias: [
      {
        find: "#tanstack-router-entry",
        replacement: path.resolve(__dirname, "src/tanstack-router-entry.ts"),
      },
      {
        find: "#tanstack-start-entry",
        replacement: path.resolve(__dirname, "src/tanstack-start-entry.ts"),
      },
      {
        find: "#tanstack-start-plugin-adapters",
        replacement: path.resolve(__dirname, "src/tanstack-start-plugin-adapters.ts"),
      },
      {
        find: "tanstack-start-manifest:v",
        replacement: path.resolve(__dirname, "src/tanstack-start-manifest.ts"),
      },
      {
        find: "tanstack-start-injected-head-scripts:v",
        replacement: path.resolve(__dirname, "src/tanstack-start-injected-head-scripts.ts"),
      },
      { find: "node:async_hooks", replacement: path.resolve(__dirname, "src/node-async-hooks.ts") },
      { find: "node:stream/web", replacement: path.resolve(__dirname, "src/node-stream-web.ts") },
      { find: "node:stream", replacement: path.resolve(__dirname, "src/node-stream.ts") },
    ],
  },
  define: {
    "process.env": {},
  },
  optimizeDeps: {
    esbuildOptions: {
      plugins: [createEsbuildAliasPlugin()],
    },
  },
});
