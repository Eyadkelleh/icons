export type SvgShapeGuess =
  | "arrow"
  | "rays"
  | "rings"
  | "bars"
  | "face"
  | "lock"
  | "corners"
  | "layers"
  | "gauge"
  | "search"
  | "generic";

export type SvgPrimitiveCounts = {
  path: number;
  group: number;
  circle: number;
  rect: number;
  line: number;
};

export type SvgAnalysis = {
  viewBox: string | null;
  counts: SvgPrimitiveCounts;
  hasStroke: boolean;
  hasFill: boolean;
  shapeGuesses: SvgShapeGuess[];
  complexity: number;
  ambiguity: number;
  summary: string;
};

const TAG_RE = /<\s*([a-zA-Z][\w:-]*)\b/g;
const VIEWBOX_RE = /<svg\b[^>]*\bviewBox\s*=\s*["']([^"']+)["']/i;
const COMMENT_RE = /<!--[\s\S]*?-->/g;
const SCRIPT_RE = /<script[\s\S]*?<\/script>/gi;
const HANDLER_RE = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const SVG_OPEN_RE = /<svg\b/i;
const STROKE_RE = /stroke(\s*=|:)/i;
const FILL_RE = /fill\s*=\s*["'](?!none)[^"']+["']|fill:\s*(?!none)[^;"']+/i;

type ShapeRule = {
  shape: SvgShapeGuess;
  keyword: RegExp;
  structure?: (counts: SvgPrimitiveCounts) => boolean;
};

const SHAPE_RULES: ShapeRule[] = [
  {
    shape: "arrow",
    keyword: /arrow|chevron|upload|download/,
    structure: (c) =>
      c.path >= 2 &&
      c.path <= 3 &&
      c.circle === 0 &&
      c.rect === 0 &&
      c.line === 0,
  },
  {
    shape: "rays",
    keyword: /\b(ray|sun|spark)/,
    structure: (c) => c.line >= 4,
  },
  {
    shape: "rings",
    keyword: /wifi|signal|radio/,
    structure: (c) => c.circle >= 3,
  },
  { shape: "bars", keyword: /chart|\bbar\b/, structure: (c) => c.rect >= 2 },
  {
    shape: "face",
    keyword: /smile|frown|face|mouth/,
    structure: (c) => c.circle === 1 && c.line === 2 && c.path >= 1,
  },
  { shape: "lock", keyword: /lock|shackle/ },
  {
    shape: "corners",
    keyword: /maximize|expand|corner/,
    structure: (c) => c.path === 4,
  },
  {
    shape: "layers",
    keyword: /copy|stack|layer/,
    structure: (c) => c.group >= 2,
  },
  { shape: "gauge", keyword: /battery|gauge|level|progress/ },
  { shape: "search", keyword: /search|loupe|magnif/ },
];

function ruleMatches(
  rule: ShapeRule,
  counts: SvgPrimitiveCounts,
  text: string
): boolean {
  return rule.keyword.test(text) || (rule.structure?.(counts) ?? false);
}

export function sanitizeSvgMarkup(markup: string): string {
  return markup
    .replace(COMMENT_RE, "")
    .replace(SCRIPT_RE, "")
    .replace(HANDLER_RE, "")
    .trim();
}

function countPrimitives(markup: string): SvgPrimitiveCounts {
  const counts: SvgPrimitiveCounts = {
    path: 0,
    group: 0,
    circle: 0,
    rect: 0,
    line: 0,
  };
  for (const match of markup.matchAll(TAG_RE)) {
    switch (match[1].toLowerCase()) {
      case "path":
        counts.path += 1;
        break;
      case "g":
      case "symbol":
        counts.group += 1;
        break;
      case "circle":
      case "ellipse":
        counts.circle += 1;
        break;
      case "rect":
        counts.rect += 1;
        break;
      case "line":
      case "polyline":
      case "polygon":
        counts.line += 1;
        break;
      default:
        break;
    }
  }
  return counts;
}

function scoreComplexity(
  counts: SvgPrimitiveCounts,
  guesses: SvgShapeGuess[]
): number {
  const primitives = counts.path + counts.circle + counts.rect + counts.line;
  return Math.min(
    100,
    primitives * 6 + counts.group * 12 + (guesses.length - 1) * 10
  );
}

function scoreAmbiguity(guesses: SvgShapeGuess[]): number {
  if (guesses.length === 1 && guesses[0] === "generic") {
    return 80;
  }
  return Math.min(90, 20 + (guesses.length - 1) * 25);
}

export function analyzeSvg(markup: string): SvgAnalysis {
  const cleaned = sanitizeSvgMarkup(markup);
  if (!SVG_OPEN_RE.test(cleaned)) {
    throw new Error("Not a valid SVG document");
  }

  const counts = countPrimitives(cleaned);
  const text = cleaned.toLowerCase();
  const matched = SHAPE_RULES.filter((rule) =>
    ruleMatches(rule, counts, text)
  ).map((rule) => rule.shape);
  const shapeGuesses: SvgShapeGuess[] = matched.length ? matched : ["generic"];
  const complexity = scoreComplexity(counts, shapeGuesses);
  const ambiguity = scoreAmbiguity(shapeGuesses);
  const viewBox = cleaned.match(VIEWBOX_RE)?.[1] ?? null;

  const summary = [
    viewBox ? `viewBox ${viewBox}` : "no viewBox",
    `${counts.path} paths`,
    `${counts.circle} circles`,
    `${counts.rect} rects`,
    `${counts.line} lines`,
    `${counts.group} groups`,
    `looks like ${shapeGuesses.join(", ")}`,
  ].join(" / ");

  return {
    viewBox,
    counts,
    hasStroke: STROKE_RE.test(cleaned),
    hasFill: FILL_RE.test(cleaned),
    shapeGuesses,
    complexity,
    ambiguity,
    summary,
  };
}
