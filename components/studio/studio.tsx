"use client";

import { AnimatePresence, motion } from "motion/react";
import { useReducer } from "react";

import { Dropzone, isSvgFile } from "@/components/studio/dropzone";
import { OptionList } from "@/components/studio/option-list";
import {
  INITIAL_STUDIO_STATE,
  readUpload,
  studioReducer,
} from "@/components/studio/studio-state";
import { SvgFigure } from "@/components/studio/svg-figure";

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
              <SvgFigure size={160} tree={state.upload.tree} />
            </div>
            <div
              className="flex flex-col gap-1 font-mono text-xs"
              data-testid="studio-analysis"
            >
              <span className="text-foreground">{state.upload.fileName}</span>
              <span className="text-secondary leading-relaxed">
                {state.upload.analysis.summary}
              </span>
              <span className="text-secondary">
                complexity {state.upload.analysis.complexity} / ambiguity{" "}
                {state.upload.analysis.ambiguity}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="font-sans text-xl">How it could move</h2>
            <OptionList
              onSelect={(patternId) =>
                dispatch({ type: "selected", patternId })
              }
              selectedId={state.selectedId}
              suggestions={state.upload.suggestions}
            />
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
