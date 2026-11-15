// GET /api/stock?range=1D
// The browser calls this when a period tab is clicked. The server does the outside fetch.

import { isRangeKey } from "@/lib/ranges";
import { getStock } from "@/lib/stock";

export async function GET(request: Request) {
  const range = new URL(request.url).searchParams.get("range") ?? "1D";
  if (!isRangeKey(range)) {
    return Response.json({ error: "Unknown range" }, { status: 400 });
  }

  const stock = await getStock(range);
  if (!stock) {
    return Response.json({ error: "No live or saved data for this range" }, { status: 502 });
  }
  return Response.json(stock);
}
