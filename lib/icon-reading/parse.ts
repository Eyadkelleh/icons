export type PartKey = string & { readonly __brand: "PartKey" };

export const SVG_TAGS = [
  "svg",
  "g",
  "path",
  "circle",
  "ellipse",
  "rect",
  "line",
  "polyline",
  "polygon",
] as const;
export type SvgTag = (typeof SVG_TAGS)[number];

export type SvgNode = {
  readonly key: PartKey | "root";
  readonly tag: SvgTag;
  readonly props: Readonly<Record<string, string>>;
  readonly children: readonly SvgNode[];
};

export class IconReadError extends Error {
  readonly reason: "not-svg" | "no-shapes" | "too-large";
  constructor(reason: IconReadError["reason"], message: string) {
    super(message);
    this.reason = reason;
  }
}

export const MAX_SVG_BYTES = 200_000;

const ALLOWED_ATTRIBUTES: Readonly<Record<string, string>> = {
  d: "d",
  cx: "cx",
  cy: "cy",
  r: "r",
  rx: "rx",
  ry: "ry",
  x: "x",
  y: "y",
  x1: "x1",
  x2: "x2",
  y1: "y1",
  y2: "y2",
  width: "width",
  height: "height",
  points: "points",
  fill: "fill",
  stroke: "stroke",
  opacity: "opacity",
  transform: "transform",
  viewbox: "viewBox",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-opacity": "strokeOpacity",
  "fill-opacity": "fillOpacity",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
};

const TAG_NAME = /^[A-Za-z_][\w:.-]*/;
const ATTR_NAME = /^[A-Za-z_][\w:.-]*/;
const ENTITY = /&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);/g;
const UNSAFE_VALUE = /url\s*\(|javascript:|expression\s*\(/i;
const BLACK = /^(#000|#000000|black)$/i;
const WS = /[ \t\n\r\f]/;

const ALLOWED_TAG_SET = new Set<string>(SVG_TAGS);

type Cursor = { readonly s: string; i: number };

export function asPartKey(value: string): PartKey {
  return value as PartKey;
}

function isSvgTag(tag: string): tag is SvgTag {
  return ALLOWED_TAG_SET.has(tag);
}

function atEnd(cur: Cursor): boolean {
  return cur.i >= cur.s.length;
}

function peek(cur: Cursor): string {
  return cur.s[cur.i] ?? "";
}

function startsWith(cur: Cursor, token: string): boolean {
  return cur.s.startsWith(token, cur.i);
}

function skipWs(cur: Cursor): void {
  while (cur.i < cur.s.length && WS.test(cur.s[cur.i])) {
    cur.i++;
  }
}

function skipUntil(cur: Cursor, token: string): boolean {
  const at = cur.s.indexOf(token, cur.i);
  if (at < 0) {
    cur.i = cur.s.length;
    return false;
  }
  cur.i = at + token.length;
  return true;
}

function skipSpecial(cur: Cursor): boolean {
  if (startsWith(cur, "<!--")) {
    skipUntil(cur, "-->");
    return true;
  }
  if (startsWith(cur, "<![CDATA[")) {
    skipUntil(cur, "]]>");
    return true;
  }
  if (startsWith(cur, "<?")) {
    skipUntil(cur, "?>");
    return true;
  }
  if (startsWith(cur, "<!")) {
    skipUntil(cur, ">");
    return true;
  }
  return false;
}

function skipJunk(cur: Cursor): void {
  for (;;) {
    skipWs(cur);
    if (!skipSpecial(cur)) {
      return;
    }
  }
}

function readMatch(cur: Cursor, pattern: RegExp): string | null {
  const slice = cur.s.slice(cur.i);
  const match = slice.match(pattern);
  if (match?.index !== 0) {
    return null;
  }
  cur.i += match[0].length;
  return match[0];
}

function decodeEntity(entity: string): string {
  if (entity === "&amp;") {
    return "&";
  }
  if (entity === "&lt;") {
    return "<";
  }
  if (entity === "&gt;") {
    return ">";
  }
  if (entity === "&quot;") {
    return '"';
  }
  if (entity === "&apos;") {
    return "'";
  }
  if (entity.startsWith("&#x")) {
    return String.fromCodePoint(Number.parseInt(entity.slice(3, -1), 16) || 0);
  }
  return String.fromCodePoint(Number.parseInt(entity.slice(2, -1), 10) || 0);
}

function decodeValue(raw: string): string {
  return raw.replace(ENTITY, decodeEntity);
}

function sanitizeValue(name: string, raw: string): string | null {
  const value = decodeValue(raw).trim();
  if (value.includes("<") || value.includes(">") || UNSAFE_VALUE.test(value)) {
    return null;
  }
  if ((name === "fill" || name === "stroke") && BLACK.test(value)) {
    return "currentColor";
  }
  return value;
}

function readQuoted(cur: Cursor, quote: string): string {
  cur.i++;
  const start = cur.i;
  while (cur.i < cur.s.length && cur.s[cur.i] !== quote) {
    cur.i++;
  }
  const value = cur.s.slice(start, cur.i);
  if (peek(cur) === quote) {
    cur.i++;
  }
  return value;
}

function readUnquoted(cur: Cursor): string {
  const start = cur.i;
  while (cur.i < cur.s.length) {
    const ch = cur.s[cur.i];
    if (WS.test(ch) || ch === ">" || ch === "/") {
      break;
    }
    cur.i++;
  }
  return cur.s.slice(start, cur.i);
}

function readAttributeValue(cur: Cursor): string {
  skipWs(cur);
  const ch = peek(cur);
  if (ch === '"' || ch === "'") {
    return readQuoted(cur, ch);
  }
  return readUnquoted(cur);
}

function readAttributes(cur: Cursor): {
  props: Record<string, string>;
  selfClosing: boolean;
} {
  const props: Record<string, string> = {};
  for (;;) {
    skipWs(cur);
    if (atEnd(cur)) {
      return { props, selfClosing: true };
    }
    if (startsWith(cur, "/>")) {
      cur.i += 2;
      return { props, selfClosing: true };
    }
    if (peek(cur) === ">") {
      cur.i++;
      return { props, selfClosing: false };
    }
    const rawName = readMatch(cur, ATTR_NAME);
    if (!rawName) {
      cur.i++;
      continue;
    }
    skipWs(cur);
    let raw = "";
    if (peek(cur) === "=") {
      cur.i++;
      raw = readAttributeValue(cur);
    }
    const mapped = ALLOWED_ATTRIBUTES[rawName.toLowerCase()];
    if (!mapped) {
      continue;
    }
    const value = sanitizeValue(mapped, raw);
    if (value !== null) {
      props[mapped] = value;
    }
  }
}

function skipElementBody(cur: Cursor): void {
  let depth = 1;
  while (depth > 0 && !atEnd(cur)) {
    skipJunk(cur);
    if (atEnd(cur) || peek(cur) !== "<") {
      cur.i++;
      continue;
    }
    if (startsWith(cur, "</")) {
      cur.i += 2;
      readMatch(cur, TAG_NAME);
      skipUntil(cur, ">");
      depth--;
      continue;
    }
    cur.i++;
    readMatch(cur, TAG_NAME);
    const { selfClosing } = readAttributes(cur);
    if (!selfClosing) {
      depth++;
    }
  }
}

function childKey(parent: PartKey | "root", index: number): PartKey {
  return asPartKey(parent === "root" ? `${index}` : `${parent}-${index}`);
}

function countDrawable(node: SvgNode): number {
  const self = node.tag === "svg" || node.tag === "g" ? 0 : 1;
  return node.children.reduce((sum, child) => sum + countDrawable(child), self);
}

function parseChildren(cur: Cursor, parentKey: PartKey | "root"): SvgNode[] {
  const children: SvgNode[] = [];
  for (;;) {
    skipJunk(cur);
    if (atEnd(cur) || startsWith(cur, "</")) {
      return children;
    }
    if (peek(cur) !== "<") {
      cur.i++;
      continue;
    }
    const child = parseElement(cur, childKey(parentKey, children.length));
    if (child) {
      children.push(child);
    }
  }
}

function parseElement(cur: Cursor, key: PartKey | "root"): SvgNode | null {
  if (peek(cur) !== "<") {
    return null;
  }
  cur.i++;
  const rawTag = readMatch(cur, TAG_NAME);
  if (!rawTag) {
    skipUntil(cur, ">");
    return null;
  }
  const tag = rawTag.toLowerCase();
  const { props, selfClosing } = readAttributes(cur);
  if (!isSvgTag(tag)) {
    if (!selfClosing) {
      skipElementBody(cur);
    }
    return null;
  }
  const children = selfClosing ? [] : parseChildren(cur, key);
  if (!selfClosing) {
    skipJunk(cur);
    if (startsWith(cur, "</")) {
      cur.i += 2;
      readMatch(cur, TAG_NAME);
      skipUntil(cur, ">");
    }
  }
  return { key, tag, props, children };
}

function ensureViewBox(node: SvgNode): SvgNode {
  if (node.props.viewBox) {
    return node;
  }
  const width = node.props.width ?? "24";
  const height = node.props.height ?? "24";
  return {
    ...node,
    props: { ...node.props, viewBox: `0 0 ${width} ${height}` },
  };
}

export function parseSvg(markup: string): SvgNode {
  if (markup.length > MAX_SVG_BYTES) {
    throw new IconReadError(
      "too-large",
      "That SVG is larger than 200 KB. Try a simpler icon."
    );
  }
  const cur: Cursor = { s: markup, i: 0 };
  skipJunk(cur);
  if (peek(cur) !== "<") {
    throw new IconReadError("not-svg", "That file isn't a readable SVG.");
  }
  const root = parseElement(cur, "root");
  if (root?.tag !== "svg") {
    throw new IconReadError("not-svg", "That file isn't a readable SVG.");
  }
  const tree = ensureViewBox(root);
  if (countDrawable(tree) === 0) {
    throw new IconReadError("no-shapes", "The SVG has no drawable shapes.");
  }
  return tree;
}
