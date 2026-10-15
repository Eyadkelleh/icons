import { z } from "zod";

import { refineIntent } from "@/lib/cursor-suggest";
import { IconReadError, MAX_SVG_BYTES, readIcon } from "@/lib/icon-reading";
import {
  commitDescription,
  DescriptionError,
  MAX_DESCRIPTION_CHARS,
} from "@/lib/intent";

export const maxDuration = 60;

const RequestSchema = z.object({
  markup: z.string().min(1).max(MAX_SVG_BYTES),
  description: z.string().min(1).max(MAX_DESCRIPTION_CHARS),
});

export async function POST(request: Request) {
  const body = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      {
        error:
          "Send { markup, description } with the SVG source (max 200 KB) and what the icon is for (max 280 characters).",
      },
      { status: 400 }
    );
  }

  try {
    const description = commitDescription(body.data.description);
    const reading = readIcon(body.data.markup);
    return Response.json(await refineIntent(description, reading));
  } catch (error) {
    if (error instanceof DescriptionError || error instanceof IconReadError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json(
      { error: "Not a valid SVG document." },
      { status: 400 }
    );
  }
}
