type ApiRequest = {
  method?: string;
  query?: {
    from?: string | string[];
  };
};

type ApiResponse = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

function getFrom(queryValue: string | string[] | undefined) {
  const raw = Array.isArray(queryValue) ? queryValue[0] : queryValue;
  const from = (raw ?? "USD").trim().toUpperCase();
  return from || "USD";
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const from = getFrom(req.query?.from);

  try {
    const frankfurter = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}`,
    );
    if (frankfurter.ok) {
      const data = await frankfurter.json();
      res.status(200).json(data);
      return;
    }
  } catch {
    // fallback below
  }

  try {
    const erApi = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`);
    if (erApi.ok) {
      const data = await erApi.json();
      if (data?.rates) {
        res.status(200).json({ rates: data.rates });
        return;
      }
    }
  } catch {
    // final fallback below
  }

  res.status(200).json({ rates: { [from]: 1 } });
}
