"use client";

import { AnimatePresence, motion } from "motion/react";
import { useReducer } from "react";
import { AdviceStatus } from "@/components/studio/advice-status";
import { Dropzone, isSvgFile } from "@/components/studio/dropzone";
import { OptionList } from "@/components/studio/option-list";
import { Preview } from "@/components/studio/preview";
import { StaticIcon } from "@/components/studio/static-icon";
import {
  INITIAL_STUDIO_STATE,
  optionsFrom,
  readUpload,
  type StudioState,
  studioReducer,
} from "@/components/studio/studio-state";
import type { RefinedIntent } from "@/lib/cursor-suggest";
import { MAX_DESCRIPTION_CHARS, normalizeDescription } from "@/lib/intent";

async function requestRefine(
  markup: string,
  description: string,
  generationId: number
): Promise<
  | { type: "refined"; generationId: number; refined: RefinedIntent }
  | { type: "refineFailed"; generationId: number; message: string }
> {
  try {
    const response = await fetch("/api/suggest-animation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markup, description }),
    });
    if (!response.ok) {
      return {
        type: "refineFailed",
        generationId,
        message: `Reread failed (${response.status}).`,
      };
    }
    return {
      type: "refined",
      generationId,
      refined: (await response.json()) as RefinedIntent,
    };
  } catch {
    return {
      type: "refineFailed",
      generationId,
      message: "Reread failed.",
    };
  }
}

function errorOf(state: StudioState): string | null {
  if (state.status === "error") {
    return state.message;
  }
  if (state.status === "empty") {
    return null;
  }
  return state.error;
}

function draftValue(state: StudioState): string {
  if (state.status === "describing" || state.status === "revising") {
    return state.draft;
  }
  if (state.status === "playing") {
    return state.description;
  }
  return "";
}

export const Studio = () => {
  const [state, dispatch] = useReducer(studioReducer, INITIAL_STUDIO_STATE);

  const load = (markup: string, fileName: string) => {
    try {
      dispatch({ type: "loaded", upload: readUpload(markup, fileName) });
    } catch (error) {
      dispatch({
        type: "failed",
        message: error instanceof Error ? error.message : "Could not read SVG.",
      });
    }
  };

  const handleFile = async (file: File) => {
    if (!isSvgFile(file)) {
      dispatch({
        type: "failed",
        message: `“${file.name}” isn't an SVG. Upload a .svg file.`,
      });
      return;
    }
    load(await file.text(), file.name);
  };

  const submit = () => {
    const before =
      state.status === "playing" || state.status === "revising"
        ? state.generationId
        : 0;
    const next = studioReducer(state, { type: "submitted" });
    dispatch({ type: "submitted" });
    if (next.status !== "playing" || next.generationId === before) {
      return;
    }
    requestRefine(next.upload.markup, next.description, next.generationId).then(
      (action) => dispatch(action)
    );
  };

  const errorMessage = errorOf(state);
  const canSubmit = normalizeDescription(draftValue(state)).length > 0;

  return (
    <div className="mx-auto mt-10 flex w-full max-w-[960px] flex-col gap-6 px-4 pb-24">
      <AnimatePresence initial={false} mode="popLayout">
        {errorMessage && (
          <motion.p
            animate={{ opacity: 1 }}
            className="rounded-[12px] bg-primary/10 px-4 py-3 font-mono text-primary text-sm"
            data-testid="studio-error"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key={errorMessage}
            role="alert"
          >
            {errorMessage}
          </motion.p>
        )}
      </AnimatePresence>

      {state.status === "empty" || state.status === "error" ? (
        <Dropzone
          onFile={handleFile}
          onPaste={(markup) => load(markup, "pasted.svg")}
        />
      ) : (
        <motion.div
          animate={{ opacity: 1 }}
          className="grid gap-6 min-[820px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
          initial={{ opacity: 0 }}
          key={state.upload.markup}
        >
          <div className="flex flex-col gap-4">
            <div
              className="supports-[corner-shape:squircle]:corner-squircle flex aspect-square w-full items-center justify-center rounded-[20px] bg-white text-foreground supports-[corner-shape:squircle]:rounded-[30px] dark:bg-[#0A0A0A]"
              data-testid="studio-preview"
            >
              {state.status === "describing" ? (
                <StaticIcon size={160} tree={state.upload.reading.tree} />
              ) : (
                <Preview
                  casting={state.directed.castings[state.selectedId]}
                  generationId={state.generationId}
                  patternId={state.selectedId}
                  selection={state.selections}
                  tree={state.upload.reading.tree}
                />
              )}
            </div>
            <div
              className="flex flex-col gap-1 font-mono text-xs"
              data-testid="studio-analysis"
            >
              <span className="text-foreground">{state.upload.fileName}</span>
              {state.status !== "describing" && (
                <>
                  <span className="text-secondary leading-relaxed">
                    {state.directed.summary}
                  </span>
                  {state.directed.facts.map((fact) => (
                    <span className="text-secondary leading-relaxed" key={fact}>
                      {fact}
                    </span>
                  ))}
                  {state.directed.castings[state.selectedId].evidence.map(
                    (item) => (
                      <span
                        className="text-secondary leading-relaxed"
                        key={`${item.stat}-${item.therefore}`}
                      >
                        {item.stat}, so {item.therefore}
                      </span>
                    )
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-2" htmlFor="studio-description">
              <span className="font-sans text-xl">What is this icon for?</span>
              <textarea
                className="min-h-28 w-full rounded-[12px] border border-neutral-300 bg-white p-3 font-mono text-foreground text-sm outline-none focus:border-primary dark:border-neutral-700 dark:bg-[#0A0A0A]"
                data-testid="studio-description"
                id="studio-description"
                maxLength={MAX_DESCRIPTION_CHARS}
                onChange={(event) =>
                  dispatch({ type: "drafted", text: event.target.value })
                }
                placeholder="alerts, upload, favorite…"
                value={draftValue(state)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className="cursor-pointer rounded-[10px] bg-primary px-3 py-1.5 font-mono text-white text-xs disabled:opacity-40"
                data-testid="studio-submit"
                disabled={!canSubmit}
                onClick={submit}
                type="button"
              >
                Animate
              </button>
              {state.status === "revising" && (
                <button
                  className="cursor-pointer rounded-[10px] px-3 py-1.5 font-mono text-secondary text-xs hover:text-foreground"
                  data-testid="studio-revert"
                  onClick={() => dispatch({ type: "reverted" })}
                  type="button"
                >
                  Keep this
                </button>
              )}
            </div>
            {state.status !== "describing" && (
              <>
                <h2 className="font-sans text-xl">How it could move</h2>
                <OptionList
                  onSelect={(patternId) =>
                    dispatch({ type: "selected", patternId })
                  }
                  options={optionsFrom(state.directed)}
                  selectedId={state.selectedId}
                />
                <AdviceStatus refine={state.refine} />
              </>
            )}
          </div>
          <div className="min-[820px]:col-span-2">
            <Dropzone
              compact
              onFile={handleFile}
              onPaste={(markup) => load(markup, "pasted.svg")}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
};
