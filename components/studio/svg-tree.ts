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
  tag: SvgTag;
  props: Record<string, string>;
  children: SvgNode[];
};

const ALLOWED_ATTRIBUTES: Record<string, string> = {
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

const SAFE_VALUE = /^[^<>]*$/;
const UNSAFE_VALUE = /url\s*\(|javascript:|expression\s*\(/i;
const BLACK = /^(#000|#000000|black)$/i;

function isSvgTag(tag: string): tag is SvgTag {
  return (SVG_TAGS as readonly string[]).includes(tag);
}

function readProps(element: Element): Record<string, string> {
  const props: Record<string, string> = {};
  for (const attribute of Array.from(element.attributes)) {
    const name = ALLOWED_ATTRIBUTES[attribute.name.toLowerCase()];
    const value = attribute.value.trim();
    if (!(name && SAFE_VALUE.test(value)) || UNSAFE_VALUE.test(value)) {
      continue;
    }
    props[name] =
      (name === "fill" || name === "stroke") && BLACK.test(value)
        ? "currentColor"
        : value;
  }
  return props;
}

function toNode(element: Element): SvgNode | null {
  const tag = element.localName.toLowerCase();
  if (!isSvgTag(tag)) {
    return null;
  }
  const children = Array.from(element.children)
    .map(toNode)
    .filter((child): child is SvgNode => child !== null);
  return { tag, props: readProps(element), children };
}

export function parseSvgTree(markup: string): SvgNode {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = doc.documentElement;
  if (
    doc.getElementsByTagName("parsererror").length > 0 ||
    root.localName !== "svg"
  ) {
    throw new Error("That file isn't a readable SVG.");
  }
  const node = toNode(root);
  if (!node || node.children.length === 0) {
    throw new Error("The SVG has no drawable shapes.");
  }
  if (!node.props.viewBox) {
    const { width, height } = node.props;
    node.props.viewBox = `0 0 ${width ?? 24} ${height ?? 24}`;
  }
  return node;
}

export function countDrawable(node: SvgNode): number {
  const self = node.tag === "svg" || node.tag === "g" ? 0 : 1;
  return node.children.reduce((sum, child) => sum + countDrawable(child), self);
}
