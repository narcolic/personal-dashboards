import YahooFinance from "yahoo-finance2";

type ApiRequest = {
  method?: string;
  query?: {
    symbols?: string | string[];
  };
};

type ApiResponse = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: {
    logErrors: false,
    logOptionsErrors: false,
  },
});

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Quote lookup failed";
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const raw = typeof req.query?.symbols === "string" ? req.query.symbols : "";
    const symbols = Array.from(
      new Set(
        raw
          .split(",")
          .map((s: string) => s.trim().toUpperCase())
          .filter((s: string): s is string => s.length > 0),
      ),
    ).slice(0, 100) as string[];

    if (symbols.length === 0) {
      res.status(200).json({ quotes: [] });
      return;
    }

    const settled = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const quote = await yahooFinance.quote(symbol);
        return quote;
      }),
    );

    const quotes: unknown[] = [];
    const failed: Array<{ symbol: string; error: string }> = [];

    settled.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        quotes.push(result.value);
        return;
      }
      failed.push({ symbol: symbols[idx], error: messageFrom(result.reason) });
    });

    res.status(200).json({ quotes, failed });
  } catch (error: unknown) {
    res.status(500).json({
      error: messageFrom(error),
      provider: "yahoo-finance2",
      hint: "Check Vercel function runtime/logs for outbound fetch failures.",
    });
  }
}
