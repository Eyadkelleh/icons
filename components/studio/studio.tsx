"use client";

import { AnimatePresence, motion } from "motion/react";
import { useReducer } from "react";
import { AdviceStatus } from "@/components/studio/advice-status";
import { mergeAdvice } from "@/components/studio/advised-options";
import { Dropzone, isSvgFile } from "@/components/studio/dropzone";
import { OptionList } from "@/components/studio/option-list";
import { Preview } from "@/components/studio/preview";
import {
  type AdviceState,
  INITIAL_STUDIO_STATE,
  readUpload,
  studioReducer,
} from "@/components/studio/studio-state";
import type { SuggestAdvice } from "@/lib/cursor-suggest";

async function requestAdvice(markup: string): Promise<AdviceState> {
  try {
    const response = await fetch("/api/suggest-animation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markup }),
    });
    if (!response.ok) {
      return {
        status: "failed",
        message: `Advice request failed (${response.status}).`,
      };
    }
    return { status: "done", advice: (await response.json()) as SuggestAdvice };
  } catch {
    return { status: "failed", message: "Advice request failed." };
  }
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
      return;
    }
    requestAdvice(markup).then((advice) =>
      dispatch({ type: "advised", markup, advice })
    );
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

  let errorMessage: string | null = null;
  if (state.status === "error") {
    errorMessage = state.message;
  } else if (state.status === "ready") {
    errorMessage = state.error;
  }

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

      {state.status === "ready" ? (
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
              <Preview
                casting={state.upload.reading.castings[state.selectedId]}
                patternId={state.selectedId}
                selection={state.selections}
                tree={state.upload.reading.tree}
              />
            </div>
            <div
              className="flex flex-col gap-1 font-mono text-xs"
              data-testid="studio-analysis"
            >
              <span className="text-foreground">{state.upload.fileName}</span>
              <span className="text-secondary leading-relaxed">
                {state.upload.reading.summary}
              </span>
              {state.upload.reading.facts.map((fact) => (
                <span className="text-secondary leading-relaxed" key={fact}>
                  {fact}
                </span>
              ))}
              {state.upload.reading.castings[state.selectedId].evidence.map(
                (item) => (
                  <span
                    className="text-secondary leading-relaxed"
                    key={`${item.stat}-${item.therefore}`}
                  >
                    {item.stat}, so {item.therefore}
                  </span>
                )
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="font-sans text-xl">How it could move</h2>
            <OptionList
              onSelect={(patternId) =>
                dispatch({ type: "selected", patternId })
              }
              options={mergeAdvice(
                state.upload.reading,
                state.advice.status === "done" &&
                  state.advice.advice.source === "cursor"
                  ? state.advice.advice.options
                  : null
              )}
              selectedId={state.selectedId}
            />
            <AdviceStatus advice={state.advice} />
          </div>
          <div className="min-[820px]:col-span-2">
            <Dropzone
              compact
              onFile={handleFile}
              onPaste={(markup) => load(markup, "pasted.svg")}
            />
          </div>
        </motion.div>
      ) : (
        <Dropzone
          onFile={handleFile}
          onPaste={(markup) => load(markup, "pasted.svg")}
        />
      )}
    </div>
  );
};
