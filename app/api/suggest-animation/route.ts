import { z } from "zod";

import { adviseWithCursor } from "@/lib/cursor-suggest";
import { suggestAnimations, suggestionSpread } from "@/lib/suggest-animation";
import { analyzeSvg } from "@/lib/svg-analyze";

export const maxDuration = 60;

const MAX_SVG_BYTES = 200_000;

const RequestSchema = z.object({
  markup: z.string().min(1).max(MAX_SVG_BYTES),
});

export async function POST(request: Request) {
  const body = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "Send { markup } with the SVG source (max 200 KB)." },
      { status: 400 }
    );
  }

  let analysis: ReturnType<typeof analyzeSvg>;
  try {
    analysis = analyzeSvg(body.data.markup);
  } catch {
    return Response.json(
      { error: "Not a valid SVG document." },
      { status: 400 }
    );
  }

  const heuristic = suggestAnimations(analysis);
  const advice = await adviseWithCursor(
    analysis,
    heuristic,
    suggestionSpread(heuristic)
  );
  return Response.json({ heuristic, ...advice });
}
