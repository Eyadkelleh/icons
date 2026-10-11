import { parseSvgTree, type SvgNode } from "@/components/studio/svg-tree";
import type { AnimationPatternId } from "@/lib/animation-patterns";
import {
  type AnimationSuggestion,
  suggestAnimations,
} from "@/lib/suggest-animation";
import { analyzeSvg, type SvgAnalysis } from "@/lib/svg-analyze";

export const MAX_SVG_BYTES = 200_000;

export type StudioUpload = {
  fileName: string;
  markup: string;
  tree: SvgNode;
  analysis: SvgAnalysis;
  suggestions: AnimationSuggestion[];
};

export type StudioState =
  | { status: "empty" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      upload: StudioUpload;
      selectedId: AnimationPatternId;
      error: string | null;
    };

export type StudioAction =
  | { type: "loaded"; upload: StudioUpload }
  | { type: "failed"; message: string }
  | { type: "selected"; patternId: AnimationPatternId }
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
        selectedId: action.upload.suggestions[0].patternId,
        error: null,
      };
    case "failed":
      return state.status === "ready"
        ? { ...state, error: action.message }
        : { status: "error", message: action.message };
    case "selected":
      return state.status === "ready"
        ? { ...state, selectedId: action.patternId }
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
  const tree = parseSvgTree(markup);
  const analysis = analyzeSvg(markup);
  const suggestions = suggestAnimations(analysis, 5);
  return { fileName, markup, tree, analysis, suggestions };
}
