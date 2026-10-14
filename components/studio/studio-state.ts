import type { StudioOption } from "@/components/studio/option-list";
import type { AnimationPatternId } from "@/lib/animation-patterns";
import type { RefinedIntent } from "@/lib/cursor-suggest";
import {
  IconReadError,
  type IconReading,
  MAX_SVG_BYTES,
  readIcon,
} from "@/lib/icon-reading";
import {
  commitDescription,
  type Description,
  DescriptionError,
  direct,
  normalizeDescription,
  parseIntent,
} from "@/lib/intent";

export type StudioUpload = {
  fileName: string;
  markup: string;
  reading: IconReading;
};

export type RefineState =
  | { status: "loading"; generationId: number }
  | { status: "done"; generationId: number; refined: RefinedIntent }
  | { status: "failed"; generationId: number; message: string };

type DirectedFields = {
  upload: StudioUpload;
  description: Description;
  directed: IconReading;
  selectedId: AnimationPatternId;
  selections: number;
  generationId: number;
  refine: RefineState;
  error: string | null;
};

export type StudioState =
  | { status: "empty" }
  | { status: "error"; message: string }
  | {
      status: "describing";
      upload: StudioUpload;
      draft: string;
      error: string | null;
    }
  | ({ status: "playing" } & DirectedFields)
  | ({ status: "revising" } & DirectedFields & { draft: string });

export type StudioAction =
  | { type: "loaded"; upload: StudioUpload }
  | { type: "failed"; message: string }
  | { type: "drafted"; text: string }
  | { type: "submitted" }
  | { type: "reverted" }
  | { type: "selected"; patternId: AnimationPatternId }
  | { type: "refined"; generationId: number; refined: RefinedIntent }
  | { type: "refineFailed"; generationId: number; message: string }
  | { type: "reset" };

export const INITIAL_STUDIO_STATE: StudioState = { status: "empty" };

function draftOf(state: StudioState): string {
  if (state.status === "describing" || state.status === "revising") {
    return state.draft;
  }
  if (state.status === "playing") {
    return state.description;
  }
  return "";
}

function play(
  upload: StudioUpload,
  description: Description,
  generationId: number,
  selectedId?: AnimationPatternId
): Extract<StudioState, { status: "playing" }> {
  const directed = direct(upload.reading, parseIntent(description));
  const nextId =
    selectedId && directed.ranking.includes(selectedId)
      ? selectedId
      : directed.ranking[0];
  return {
    status: "playing",
    upload,
    description,
    directed,
    selectedId: nextId,
    selections: 0,
    generationId,
    refine: { status: "loading", generationId },
    error: null,
  };
}

function keepPlaying(
  state: Extract<StudioState, { status: "playing" | "revising" }>
): Extract<StudioState, { status: "playing" }> {
  return {
    status: "playing",
    upload: state.upload,
    description: state.description,
    directed: state.directed,
    selectedId: state.selectedId,
    selections: state.selections,
    generationId: state.generationId,
    refine: state.refine,
    error: state.error,
  };
}

function applyDraft(
  state: Extract<StudioState, { status: "playing" | "revising" }>,
  text: string
): StudioState {
  if (normalizeDescription(text) === state.description) {
    return keepPlaying(state);
  }
  return { ...keepPlaying(state), status: "revising", draft: text };
}

function submit(state: StudioState): StudioState {
  if (
    state.status !== "describing" &&
    state.status !== "playing" &&
    state.status !== "revising"
  ) {
    return state;
  }
  try {
    const description = commitDescription(draftOf(state));
    if (
      (state.status === "playing" || state.status === "revising") &&
      description === state.description
    ) {
      return keepPlaying(state);
    }
    return play(
      state.upload,
      description,
      (state.status === "describing" ? 0 : state.generationId) + 1
    );
  } catch (error) {
    const message =
      error instanceof DescriptionError
        ? error.message
        : "Say what this icon is for.";
    return { ...state, error: message };
  }
}

function applyRefine(
  state: StudioState,
  action: Extract<StudioAction, { type: "refined" | "refineFailed" }>
): StudioState {
  if (state.status !== "playing" && state.status !== "revising") {
    return state;
  }
  if (state.generationId !== action.generationId) {
    return state;
  }
  if (action.type === "refineFailed") {
    return {
      ...state,
      refine: {
        status: "failed",
        generationId: action.generationId,
        message: action.message,
      },
    };
  }
  const directed = direct(state.upload.reading, action.refined.intent);
  const selectedId = directed.ranking.includes(state.selectedId)
    ? state.selectedId
    : directed.ranking[0];
  return {
    ...state,
    directed,
    selectedId,
    refine: {
      status: "done",
      generationId: action.generationId,
      refined: action.refined,
    },
  };
}

export function studioReducer(
  state: StudioState,
  action: StudioAction
): StudioState {
  switch (action.type) {
    case "loaded":
      return {
        status: "describing",
        upload: action.upload,
        draft: draftOf(state),
        error: null,
      };
    case "failed":
      if (
        state.status === "describing" ||
        state.status === "playing" ||
        state.status === "revising"
      ) {
        return { ...state, error: action.message };
      }
      return { status: "error", message: action.message };
    case "drafted":
      if (state.status === "describing") {
        return { ...state, draft: action.text, error: null };
      }
      if (state.status === "playing" || state.status === "revising") {
        return applyDraft(state, action.text);
      }
      return state;
    case "submitted":
      return submit(state);
    case "reverted":
      return state.status === "revising" ? keepPlaying(state) : state;
    case "selected":
      return state.status === "playing" || state.status === "revising"
        ? {
            ...state,
            selectedId: action.patternId,
            selections: state.selections + 1,
          }
        : state;
    case "refined":
    case "refineFailed":
      return applyRefine(state, action);
    case "reset":
      return INITIAL_STUDIO_STATE;
    default:
      return state;
  }
}

export function optionsFrom(reading: IconReading): StudioOption[] {
  return reading.ranking.slice(0, 5).map((patternId) => {
    const casting = reading.castings[patternId];
    const lines = casting.evidence
      .filter((item) => item.weight > 0)
      .map((item) => item.says);
    return {
      patternId,
      rationale: lines.length
        ? lines.join(" ")
        : (casting.evidence[0]?.says ?? ""),
    };
  });
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
