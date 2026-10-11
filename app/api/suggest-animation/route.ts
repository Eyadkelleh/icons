import { z } from "zod";

import { adviseWithCursor } from "@/lib/cursor-suggest";
import { IconReadError, MAX_SVG_BYTES, readIcon } from "@/lib/icon-reading";

export const maxDuration = 60;

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

  try {
    const reading = readIcon(body.data.markup);
    const advice = await adviseWithCursor(reading);
    return Response.json(advice);
  } catch (error) {
    if (error instanceof IconReadError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json(
      { error: "Not a valid SVG document." },
      { status: 400 }
    );
  }
}
