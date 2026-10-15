import { z } from "zod";

import {
  ANIMATION_PATTERNS,
  type AnimationPatternId,
} from "@/lib/animation-patterns";
import {
  type Channel,
  type Evidence,
  type IconReading,
  type Keyframes,
  type MotionPlan,
  makeCasting,
  REST_POSE,
  rank,
} from "@/lib/icon-reading";

export const CUES = [
  "ring",
  "pulse",
  "travel",
  "morph",
  "stagger",
  "explode",
  "peel",
  "spin",
  "grow",
  "draw",
  "search",
  "face",
] as const;

export type Cue = (typeof CUES)[number];

export const AXES = ["up", "down", "left", "right", "in", "out"] as const;
export type Axis = (typeof AXES)[number];

export const INTENSITIES = ["soft", "normal", "strong"] as const;
export type Intensity = (typeof INTENSITIES)[number];

export const REPEAT_MODES = ["once", "loop"] as const;
export type RepeatMode = (typeof REPEAT_MODES)[number];

export const READERS = ["lexicon", "model"] as const;
export type IntentReader = (typeof READERS)[number];

export const CueSchema = z.enum(CUES);
export const AxisSchema = z.enum(AXES);
export const IntensitySchema = z.enum(INTENSITIES);
export const RepeatModeSchema = z.enum(REPEAT_MODES);
export const ReaderSchema = z.enum(READERS);

export const SpanSchema = z.object({
  phrase: z.string().min(1).max(80),
  cue: CueSchema.optional(),
});

export type Span = z.infer<typeof SpanSchema>;

/** Body the Cursor agent may emit. `reader` is owned by the host, never the model. */
export const IntentBodySchema = z.object({
  cues: z.array(CueSchema).max(4),
  axis: AxisSchema.optional(),
  intensity: IntensitySchema,
  repeat: RepeatModeSchema.optional(),
  spans: z.array(SpanSchema).max(12),
  unmatched: z.string().max(280),
});

export const IntentSchema = IntentBodySchema.extend({
  reader: ReaderSchema,
});

export type Intent = z.infer<typeof IntentSchema>;

export const CUE_WEIGHT = {
  lexicon: 2,
  model: 4,
} as const satisfies Record<IntentReader, number>;

export const EMPTY_INTENT: Intent = {
  cues: [],
  intensity: "normal",
  spans: [],
  unmatched: "",
  reader: "lexicon",
};

declare const descriptionBrand: unique symbol;

export type Description = string & {
  readonly [descriptionBrand]: true;
};

export const MAX_DESCRIPTION_CHARS = 280;

export class DescriptionError extends Error {
  readonly reason: "empty" | "too-long";
  constructor(reason: DescriptionError["reason"], message: string) {
    super(message);
    this.reason = reason;
  }
}

export const CUE_PATTERN = {
  ring: "rotate-wiggle",
  pulse: "scale-pulse",
  travel: "directional-nudge",
  morph: "path-morph",
  stagger: "stagger-fade",
  explode: "corner-explode",
  peel: "peel-layers",
  spin: "pivot-rotate",
  grow: "fill-grow",
  draw: "semantic-path-length",
  search: "search-bounce",
  face: "face-morph",
} as const satisfies Record<Cue, AnimationPatternId>;

export function cueGloss(cue: Cue): string {
  const pattern = ANIMATION_PATTERNS.find((p) => p.id === CUE_PATTERN[cue]);
  return pattern?.when ?? cue;
}

export function asModelIntent(body: z.infer<typeof IntentBodySchema>): Intent {
  return { ...body, reader: "model" };
}

const CUE_THEREFORE: Record<Cue, string> = {
  ring: "it rings",
  pulse: "it pulses",
  travel: "it travels",
  morph: "the head leads",
  stagger: "the parts enter in sequence",
  explode: "the corners move",
  peel: "the stack peels apart",
  spin: "it turns",
  grow: "the level fills",
  draw: "only that stroke draws",
  search: "it scans",
  face: "the face moves",
};

const TRAVEL_AXIS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const;

type PhraseRow = {
  readonly stem: string;
  readonly cue?: Cue;
  readonly axis?: Axis;
  readonly intensity?: Intensity;
  readonly repeat?: RepeatMode;
};

const PHRASES: readonly PhraseRow[] = [
  { stem: "new messages", cue: "ring" },
  { stem: "team updates", cue: "ring" },
  { stem: "notification", cue: "ring" },
  { stem: "notify", cue: "ring" },
  { stem: "inbox", cue: "ring" },
  { stem: "mention", cue: "ring" },
  { stem: "alert", cue: "ring" },
  { stem: "unread", cue: "ring" },
  { stem: "ping", cue: "ring" },
  { stem: "bell", cue: "ring" },
  { stem: "ring", cue: "ring" },
  { stem: "advanced options", cue: "ring" },
  { stem: "preferences", cue: "ring" },
  { stem: "preference", cue: "ring" },
  { stem: "options", cue: "ring" },
  { stem: "configure", cue: "ring" },
  { stem: "settings", cue: "ring" },
  { stem: "setting", cue: "ring" },
  { stem: "integration", cue: "ring" },
  { stem: "tweak", cue: "ring" },
  { stem: "add new", cue: "ring" },
  { stem: "create", cue: "ring" },
  { stem: "add", cue: "ring" },
  { stem: "save for later", cue: "pulse" },
  { stem: "save this recipe", cue: "pulse" },
  { stem: "personal collection", cue: "pulse" },
  { stem: "heartbeat", cue: "pulse" },
  { stem: "favorite", cue: "pulse" },
  { stem: "bookmark", cue: "pulse" },
  { stem: "collection", cue: "pulse" },
  { stem: "recipe", cue: "pulse" },
  { stem: "health", cue: "pulse" },
  { stem: "vitals", cue: "pulse" },
  { stem: "alive", cue: "pulse" },
  { stem: "love", cue: "pulse" },
  { stem: "like", cue: "pulse" },
  { stem: "pin", cue: "pulse" },
  { stem: "sync to cloud", cue: "travel", axis: "up" },
  { stem: "shared drive", cue: "travel", axis: "up" },
  { stem: "upload file", cue: "travel", axis: "up" },
  { stem: "share externally", cue: "travel", axis: "up" },
  { stem: "move down", cue: "travel", axis: "down" },
  { stem: "move up", cue: "travel", axis: "up" },
  { stem: "go down", cue: "travel", axis: "down" },
  { stem: "go up", cue: "travel", axis: "up" },
  { stem: "sign out", cue: "travel", axis: "left" },
  { stem: "sign in", cue: "travel", axis: "right" },
  { stem: "log out", cue: "travel", axis: "left" },
  { stem: "log in", cue: "travel", axis: "right" },
  { stem: "sign-out", cue: "travel", axis: "left" },
  { stem: "sign-in", cue: "travel", axis: "right" },
  { stem: "logout", cue: "travel", axis: "left" },
  { stem: "login", cue: "travel", axis: "right" },
  { stem: "save the invoice", cue: "travel", axis: "down" },
  { stem: "download", cue: "travel", axis: "down" },
  { stem: "save", cue: "travel", axis: "down" },
  { stem: "upload", cue: "travel", axis: "up" },
  { stem: "export", cue: "travel", axis: "up" },
  { stem: "attach", cue: "travel", axis: "up" },
  { stem: "push", cue: "travel", axis: "up" },
  { stem: "pull", cue: "travel", axis: "down" },
  { stem: "sync", cue: "travel", axis: "up" },
  { stem: "send", cue: "travel", axis: "up" },
  { stem: "share", cue: "travel", axis: "up" },
  { stem: "receive", cue: "travel", axis: "down" },
  { stem: "continue", cue: "travel", axis: "right" },
  { stem: "previous", cue: "travel", axis: "left" },
  { stem: "forward", cue: "travel", axis: "right" },
  { stem: "higher", cue: "travel", axis: "up" },
  { stem: "lower", cue: "travel", axis: "down" },
  { stem: "drop", cue: "travel", axis: "down" },
  { stem: "next", cue: "travel", axis: "right" },
  { stem: "back", cue: "travel", axis: "left" },
  { stem: "stretch the arrow", cue: "morph" },
  { stem: "morph", cue: "morph" },
  { stem: "stretch", cue: "morph" },
  { stem: "light mode", cue: "stagger" },
  { stem: "daytime theme", cue: "stagger" },
  { stem: "drag handle", cue: "stagger" },
  { stem: "reorder cards", cue: "stagger" },
  { stem: "grab", cue: "stagger" },
  { stem: "in sequence", cue: "stagger" },
  { stem: "brightness", cue: "stagger" },
  { stem: "daytime", cue: "stagger" },
  { stem: "network", cue: "stagger" },
  { stem: "online", cue: "stagger" },
  { stem: "signal", cue: "stagger" },
  { stem: "theme", cue: "stagger" },
  { stem: "light", cue: "stagger" },
  { stem: "sound", cue: "stagger" },
  { stem: "audio", cue: "stagger" },
  { stem: "mute", cue: "stagger" },
  { stem: "wifi", cue: "stagger" },
  { stem: "rays", cue: "stagger" },
  { stem: "sun", cue: "stagger" },
  { stem: "collapsed details", cue: "explode", axis: "out" },
  { stem: "show more", cue: "explode", axis: "out" },
  { stem: "fullscreen", cue: "explode", axis: "out" },
  { stem: "maximize", cue: "explode", axis: "out" },
  { stem: "minimize", cue: "explode", axis: "in" },
  { stem: "collapse", cue: "explode", axis: "in" },
  { stem: "hide", cue: "explode", axis: "in" },
  { stem: "expand", cue: "explode", axis: "out" },
  { stem: "shrink", cue: "explode", axis: "in" },
  { stem: "support ticket", cue: "peel" },
  { stem: "invite link", cue: "peel" },
  { stem: "ticket", cue: "peel" },
  { stem: "attachment", cue: "peel" },
  { stem: "documents", cue: "peel" },
  { stem: "document", cue: "peel" },
  { stem: "clipboard", cue: "peel" },
  { stem: "duplicate", cue: "peel" },
  { stem: "versions", cue: "peel" },
  { stem: "version", cue: "peel" },
  { stem: "layouts", cue: "peel" },
  { stem: "layout", cue: "peel" },
  { stem: "layers", cue: "peel" },
  { stem: "layer", cue: "peel" },
  { stem: "stack", cue: "peel" },
  { stem: "copy", cue: "peel" },
  { stem: "peel", cue: "peel" },
  { stem: "until dismissed", repeat: "loop" },
  { stem: "keep going", repeat: "loop" },
  { stem: "repeating", repeat: "loop" },
  { stem: "processing", cue: "spin", repeat: "loop" },
  { stem: "loading", cue: "spin", repeat: "loop" },
  { stem: "spinner", cue: "spin", repeat: "loop" },
  { stem: "parking reservation", cue: "spin" },
  { stem: "countdown", cue: "spin" },
  { stem: "reservation", cue: "spin" },
  { stem: "meeting", cue: "spin" },
  { stem: "expires", cue: "spin" },
  { stem: "history", cue: "spin" },
  { stem: "timer", cue: "spin" },
  { stem: "clock", cue: "spin" },
  { stem: "sweep", cue: "spin" },
  { stem: "wait", cue: "spin", repeat: "loop" },
  { stem: "time", cue: "spin" },
  { stem: "loop", repeat: "loop" },
  { stem: "fully charged", cue: "grow" },
  { stem: "half battery", cue: "grow" },
  { stem: "progress bar", cue: "grow" },
  { stem: "battery", cue: "grow" },
  { stem: "charge", cue: "grow" },
  { stem: "plug in", cue: "grow" },
  { stem: "plug", cue: "grow" },
  { stem: "volume", cue: "grow" },
  { stem: "level", cue: "grow" },
  { stem: "progress", cue: "grow" },
  { stem: "fill", cue: "grow" },
  { stem: "circle check", cue: "draw" },
  { stem: "confirm", cue: "draw" },
  { stem: "unlock", cue: "draw" },
  { stem: "verified", cue: "draw" },
  { stem: "complete", cue: "draw" },
  { stem: "locked", cue: "draw" },
  { stem: "check", cue: "draw" },
  { stem: "done", cue: "draw" },
  { stem: "lock", cue: "draw" },
  { stem: "tick", cue: "draw" },
  { stem: "look up", cue: "search" },
  { stem: "search", cue: "search" },
  { stem: "find", cue: "search" },
  { stem: "zoom", cue: "search" },
  { stem: "bad experience", cue: "face" },
  { stem: "delighted", cue: "face" },
  { stem: "unhappy", cue: "face" },
  { stem: "positive", cue: "face" },
  { stem: "frown", cue: "face" },
  { stem: "smile", cue: "face" },
  { stem: "happy", cue: "face" },
  { stem: "mood", cue: "face" },
  { stem: "face", cue: "face" },
  { stem: "wink", cue: "face" },
  { stem: "on tap", repeat: "once" },
  { stem: "when clicked", repeat: "once" },
  { stem: "once", repeat: "once" },
  { stem: "gentle", intensity: "soft" },
  { stem: "subtle", intensity: "soft" },
  { stem: "slight", intensity: "soft" },
  { stem: "small", intensity: "soft" },
  { stem: "urgent", intensity: "strong" },
  { stem: "dramatic", intensity: "strong" },
  { stem: "strong", intensity: "strong" },
  { stem: "big", intensity: "strong" },
  { stem: "up", axis: "up" },
  { stem: "down", axis: "down" },
  { stem: "left", axis: "left" },
  { stem: "right", axis: "right" },
];

const MARKUP_TAGS = /<[^>]+>/g;
const SPACE = /\s+/;

const PHRASE_MATCHERS = [...PHRASES]
  .sort((a, b) => b.stem.length - a.stem.length)
  .map((row) => ({
    ...row,
    re: new RegExp(inflectionSource(row.stem), "gi"),
  }));

function escapeRe(stem: string): string {
  return stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inflectionSource(stem: string): string {
  if (stem.includes(" ")) {
    return `\\b${escapeRe(stem)}\\b`;
  }
  return `\\b${escapeRe(stem)}(?:s|es|ed|ing)?\\b`;
}

function collapse(text: string): string {
  return text.trim().split(SPACE).filter(Boolean).join(" ");
}

export function normalizeDescription(raw: string): string {
  MARKUP_TAGS.lastIndex = 0;
  return collapse(raw.replace(MARKUP_TAGS, " "));
}

export function commitDescription(raw: string): Description {
  if (raw.length > MAX_DESCRIPTION_CHARS) {
    throw new DescriptionError("too-long", "Keep it to 280 characters.");
  }
  const text = normalizeDescription(raw);
  if (text.length === 0) {
    throw new DescriptionError("empty", "Say what this icon is for.");
  }
  if (text.length > MAX_DESCRIPTION_CHARS) {
    throw new DescriptionError("too-long", "Keep it to 280 characters.");
  }
  return text as Description;
}

type Range = { start: number; end: number };

function overlaps(used: readonly Range[], start: number, end: number): boolean {
  return used.some((span) => start < span.end && end > span.start);
}

function leftover(text: string, used: readonly Range[]): string {
  const chars = [...text];
  for (const span of used) {
    for (let i = span.start; i < span.end && i < chars.length; i++) {
      chars[i] = " ";
    }
  }
  return collapse(chars.join(""));
}

function thereforeFor(cue: Cue, axis: Axis | undefined): string {
  if (cue === "travel" && axis && axis in TRAVEL_AXIS) {
    return `it travels ${axis}`;
  }
  if (cue === "explode" && (axis === "in" || axis === "out")) {
    return `the corners move ${axis}`;
  }
  return CUE_THEREFORE[cue];
}

function isIdle(intent: Intent): boolean {
  return (
    intent.cues.length === 0 &&
    intent.axis === undefined &&
    intent.intensity === "normal" &&
    intent.repeat === undefined
  );
}

function asFrames(values: number[]): readonly [number, ...number[]] {
  if (values.length === 0) {
    return [0];
  }
  return values as [number, ...number[]];
}

function scaleChannel(
  channel: Channel,
  values: readonly [number, ...number[]],
  intensity: Intensity
): readonly [number, ...number[]] {
  if (channel === "pathLength" || channel === "pathOffset") {
    return values;
  }
  const factor = intensity === "soft" ? 0.6 : intensity === "strong" ? 1.5 : 1;
  const rest = REST_POSE[channel];
  return asFrames(values.map((value) => rest + (value - rest) * factor));
}

function scaleFrames(frames: Keyframes, intensity: Intensity): Keyframes {
  if (intensity === "normal") {
    return frames;
  }
  const next: Keyframes = {};
  for (const channel of Object.keys(frames) as Channel[]) {
    const values = frames[channel];
    if (values) {
      next[channel] = scaleChannel(channel, values, intensity);
    }
  }
  return next;
}

function rewriteTravel(frames: Keyframes, axis: Axis): Keyframes {
  if (!(axis in TRAVEL_AXIS)) {
    return frames;
  }
  const dir = TRAVEL_AXIS[axis as keyof typeof TRAVEL_AXIS];
  const xs = frames.x;
  const ys = frames.y;
  if (!(xs || ys)) {
    return frames;
  }
  const length = Math.max(xs?.length ?? 0, ys?.length ?? 0);
  const nextX: number[] = [];
  const nextY: number[] = [];
  for (let i = 0; i < length; i++) {
    const dx = (xs?.[i] ?? REST_POSE.x) - REST_POSE.x;
    const dy = (ys?.[i] ?? REST_POSE.y) - REST_POSE.y;
    const amp = Math.hypot(dx, dy);
    nextX.push(REST_POSE.x + dir.x * amp);
    nextY.push(REST_POSE.y + dir.y * amp);
  }
  return { ...frames, x: asFrames(nextX), y: asFrames(nextY) };
}

function patchPlan(
  plan: MotionPlan,
  intent: Intent,
  patternId: AnimationPatternId
): MotionPlan {
  const travel =
    Boolean(intent.axis) &&
    (patternId === "directional-nudge" || patternId === "path-morph");
  const repeat = intent.repeat ?? plan.repeat;
  if (intent.intensity === "normal" && !travel && repeat === plan.repeat) {
    return plan;
  }
  const tracks = new Map();
  for (const [target, track] of plan.tracks) {
    let frames = scaleFrames(track.frames, intent.intensity);
    if (travel && intent.axis) {
      frames = rewriteTravel(frames, intent.axis);
    }
    tracks.set(target, { ...track, frames });
  }
  return { ...plan, tracks, repeat };
}

type EvidenceDraft = Pick<Evidence, "weight" | "parts" | "stat" | "therefore">;

function evidenceFor(
  patternId: AnimationPatternId,
  intent: Intent
): EvidenceDraft[] {
  const drafts: EvidenceDraft[] = [];
  const base = CUE_WEIGHT[intent.reader];
  for (const [index, cue] of intent.cues.entries()) {
    if (CUE_PATTERN[cue] !== patternId) {
      continue;
    }
    const span = intent.spans.find((item) => item.cue === cue)?.phrase ?? cue;
    drafts.push({
      weight: index === 0 ? base : Math.ceil(base / 2),
      parts: [],
      stat: `you said ${span}`,
      therefore: thereforeFor(cue, intent.axis),
    });
  }
  return drafts;
}

function asDrafts(
  evidence: IconReading["castings"][AnimationPatternId]["evidence"]
): EvidenceDraft[] {
  return evidence.map((item) => ({
    weight: item.weight,
    parts: item.parts,
    stat: item.stat,
    therefore: item.therefore,
  }));
}

function collectMatches(source: string): Intent {
  const lower = source.toLowerCase();
  const used: Range[] = [];
  const cues: Cue[] = [];
  const spans: Span[] = [];
  let axis: Axis | undefined;
  let intensity: Intensity = "normal";
  let repeat: RepeatMode | undefined;
  for (const phrase of PHRASE_MATCHERS) {
    phrase.re.lastIndex = 0;
    for (const match of lower.matchAll(phrase.re)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (overlaps(used, start, end)) {
        continue;
      }
      used.push({ start, end });
      if (phrase.cue && cues.length < 4 && !cues.includes(phrase.cue)) {
        cues.push(phrase.cue);
      }
      if (phrase.axis) {
        axis = phrase.axis;
      }
      if (phrase.intensity) {
        intensity = phrase.intensity;
      }
      if (phrase.repeat) {
        repeat = phrase.repeat;
      }
      spans.push({ phrase: source.slice(start, end), cue: phrase.cue });
    }
  }
  return {
    cues,
    axis,
    intensity,
    repeat,
    spans,
    unmatched: leftover(lower, used),
    reader: "lexicon",
  };
}

export function parseIntent(text: string): Intent {
  const source = collapse(text);
  return source.length === 0 ? EMPTY_INTENT : collectMatches(source);
}

export function direct(reading: IconReading, intent: Intent): IconReading {
  if (isIdle(intent)) {
    return reading;
  }
  const castings = {} as IconReading["castings"];
  for (const pattern of ANIMATION_PATTERNS) {
    const geo = reading.castings[pattern.id];
    castings[pattern.id] = makeCasting(
      pattern.id,
      [...asDrafts(geo.evidence), ...evidenceFor(pattern.id, intent)],
      patchPlan(geo.plan, intent, pattern.id)
    );
  }
  return {
    ...reading,
    castings,
    ranking: rank(castings),
  };
}
