import type { AnimationPatternId } from "@/lib/animation-patterns";
import type { SuggestAdvice } from "@/lib/cursor-suggest";
import {
  IconReadError,
  type IconReading,
  MAX_SVG_BYTES,
  readIcon,
} from "@/lib/icon-reading";

export type StudioUpload = {
  fileName: string;
  markup: string;
  reading: IconReading;
};

export type AdviceState =
  | { status: "loading" }
  | { status: "done"; advice: SuggestAdvice }
  | { status: "failed"; message: string };

export type StudioState =
  | { status: "empty" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      upload: StudioUpload;
      selectedId: AnimationPatternId;
      selections: number;
      error: string | null;
      advice: AdviceState;
    };

export type StudioAction =
  | { type: "loaded"; upload: StudioUpload }
  | { type: "failed"; message: string }
  | { type: "selected"; patternId: AnimationPatternId }
  | { type: "advised"; markup: string; advice: AdviceState }
  | { type: "reset" };

export const INITIAL_STUDIO_STATE: StudioState = { status: "empty" };

export function studioReducer(
  state: StudioState,
  action: StudioAction
): StudioState {
  switch (action.type) {
    case "loaded":
      return {
        status: "ready",
        upload: action.upload,
        selectedId: action.upload.reading.ranking[0],
        selections: 0,
        error: null,
        advice: { status: "loading" },
      };
    case "failed":
      return state.status === "ready"
        ? { ...state, error: action.message }
        : { status: "error", message: action.message };
    case "selected":
      return state.status === "ready"
        ? {
            ...state,
            selectedId: action.patternId,
            selections: state.selections + 1,
          }
        : state;
    case "advised":
      return state.status === "ready" && state.upload.markup === action.markup
        ? { ...state, advice: action.advice }
        : state;
    case "reset":
      return INITIAL_STUDIO_STATE;
    default:
      return state;
  }
}

export function readUpload(markup: string, fileName: string): StudioUpload {
  if (markup.length > MAX_SVG_BYTES) {
    throw new Error("That SVG is larger than 200 KB. Try a simpler icon.");
  }
  try {
    return { fileName, markup, reading: readIcon(markup) };
  } catch (error) {
    if (error instanceof IconReadError) {
      throw new Error(error.message, { cause: error });
    }
    throw error;
  }
}
