import { asPartKey, type PartKey, type SvgNode, type SvgTag } from "./parse";
import {
  type ArcFit,
  add,
  apply,
  circleSegs,
  cross,
  dist,
  dot,
  ellipseSegs,
  flatten,
  IDENTITY,
  lastOf,
  len,
  type Matrix,
  multiply,
  parsePathData,
  parsePoints,
  parseTransform,
  polylineSegs,
  type Run,
  rectSegs,
  runLength,
  type Seg,
  scale,
  shoelace,
  sub,
  unit,
  type Vec,
  vec,
} from "./path-data";

export type Box = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

export type End = { readonly at: Vec; readonly heading: Vec };

export type Vertex = {
  readonly at: Vec;
  readonly interiorDeg: number;
  readonly legIn: number;
  readonly legOut: number;
};

export type Part = {
  readonly key: PartKey;
  readonly tag: Exclude<SvgTag, "svg" | "g">;
  readonly paint: "stroke" | "fill" | "both";
  readonly runs: readonly Run[];
  readonly closed: boolean;
  readonly dot: boolean;
  readonly bbox: Box;
  readonly centroid: Vec;
  readonly length: number;
  readonly ends: { readonly start: End; readonly end: End } | null;
  readonly vertices: readonly Vertex[];
  readonly arcs: readonly ArcFit[];
  readonly straightness: number;
  readonly axis: Vec;
  readonly area: number;
};

export type Frame = {
  readonly viewBox: Box;
  readonly size: number;
  readonly center: Vec;
  readonly content: Box;
  readonly parts: readonly Part[];
  readonly tol: {
    readonly join: number;
    readonly align: number;
    readonly dot: number;
    readonly small: number;
  };
};

const VIEWBOX_SPLIT = /[\s,]+/;

const LEAF_TAGS = new Set<string>([
  "path",
  "circle",
  "ellipse",
  "rect",
  "line",
  "polyline",
  "polygon",
]);

function num(value: string | undefined, fallback = 0): number {
  if (value === undefined) {
    return fallback;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function emptyBox(): Box {
  return {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
}

function includePoint(box: Box, p: Vec): Box {
  return {
    minX: Math.min(box.minX, p.x),
    minY: Math.min(box.minY, p.y),
    maxX: Math.max(box.maxX, p.x),
    maxY: Math.max(box.maxY, p.y),
  };
}

export function boxWidth(b: Box): number {
  return b.maxX - b.minX;
}

export function boxHeight(b: Box): number {
  return b.maxY - b.minY;
}

export function boxCenter(b: Box): Vec {
  return vec((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
}

export function boxArea(b: Box): number {
  return Math.max(0, boxWidth(b)) * Math.max(0, boxHeight(b));
}

export function unionBox(a: Box, b: Box): Box {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function boxContains(outer: Box, inner: Box, pad = 0): boolean {
  return (
    inner.minX >= outer.minX - pad &&
    inner.minY >= outer.minY - pad &&
    inner.maxX <= outer.maxX + pad &&
    inner.maxY <= outer.maxY + pad
  );
}

function parseViewBox(value: string): Box {
  const parts = value.trim().split(VIEWBOX_SPLIT).map(Number);
  const [x, y, w, h] = [
    parts[0] ?? 0,
    parts[1] ?? 0,
    parts[2] ?? 24,
    parts[3] ?? 24,
  ];
  return { minX: x, minY: y, maxX: x + w, maxY: y + h };
}

function paintKind(
  fill: string | undefined,
  stroke: string | undefined
): "stroke" | "fill" | "both" {
  const hasFill = fill !== undefined && fill !== "none";
  const hasStroke = stroke !== undefined && stroke !== "none";
  if (hasFill && hasStroke) {
    return "both";
  }
  if (hasFill) {
    return "fill";
  }
  return "stroke";
}

function segsFor(node: SvgNode): Seg[] {
  const p = node.props;
  if (node.tag === "path") {
    return parsePathData(p.d ?? "");
  }
  if (node.tag === "circle") {
    return circleSegs(num(p.cx), num(p.cy), num(p.r));
  }
  if (node.tag === "ellipse") {
    return ellipseSegs(num(p.cx), num(p.cy), num(p.rx), num(p.ry, num(p.rx)));
  }
  if (node.tag === "rect") {
    return rectSegs(
      num(p.x),
      num(p.y),
      num(p.width),
      num(p.height),
      num(p.rx, num(p.ry)),
      num(p.ry, num(p.rx))
    );
  }
  if (node.tag === "line") {
    return polylineSegs(
      [vec(num(p.x1), num(p.y1)), vec(num(p.x2), num(p.y2))],
      false
    );
  }
  if (node.tag === "polyline") {
    return polylineSegs(parsePoints(p.points ?? ""), false);
  }
  if (node.tag === "polygon") {
    return polylineSegs(parsePoints(p.points ?? ""), true);
  }
  return [];
}

function turnDeg(incoming: Vec, outgoing: Vec): number {
  const a = unit(incoming);
  const b = unit(outgoing);
  const d = Math.min(1, Math.max(-1, dot(a, b)));
  return (Math.acos(d) * 180) / Math.PI;
}

function isCornerSeg(seg: Seg): boolean {
  return seg.kind === "L" || seg.kind === "M" || seg.kind === "Z";
}

function endpoint(seg: Seg, start: Vec, cur: Vec): Vec {
  if (seg.kind === "Z") {
    return start;
  }
  if (seg.kind === "M" || seg.kind === "L") {
    return seg.to;
  }
  if (seg.kind === "C" || seg.kind === "Q" || seg.kind === "A") {
    return seg.to;
  }
  return cur;
}

function verticesFromSegs(segs: readonly Seg[], ctm: Matrix): Vertex[] {
  const out: Vertex[] = [];
  let start = vec(0, 0);
  let cur = vec(0, 0);
  let prev = vec(0, 0);
  let havePrev = false;
  let prevWasLine = false;
  const consider = (a: Vec, b: Vec, c: Vec) => {
    const incoming = sub(b, a);
    const outgoing = sub(c, b);
    const inLen = len(incoming);
    const outLen = len(outgoing);
    if (inLen < 1e-6 || outLen < 1e-6) {
      return;
    }
    const deg = turnDeg(incoming, outgoing);
    if (deg <= 35) {
      return;
    }
    out.push({
      at: apply(ctm, b),
      interiorDeg: deg,
      legIn: inLen,
      legOut: outLen,
    });
  };
  for (const seg of segs) {
    if (seg.kind === "M") {
      start = seg.to;
      cur = seg.to;
      prev = seg.to;
      havePrev = false;
      prevWasLine = false;
      continue;
    }
    const to = endpoint(seg, start, cur);
    if (seg.kind === "L") {
      if (prevWasLine && havePrev) {
        consider(prev, cur, to);
      }
      prev = cur;
      cur = to;
      havePrev = true;
      prevWasLine = true;
      continue;
    }
    if (seg.kind === "Z") {
      if (prevWasLine && havePrev) {
        consider(prev, cur, start);
      }
      prevWasLine = false;
      cur = start;
      continue;
    }
    prevWasLine = false;
    prev = cur;
    cur = to;
    havePrev = isCornerSeg(seg);
  }
  return out;
}

function bboxOf(runs: readonly Run[]): Box {
  let box = emptyBox();
  for (const run of runs) {
    for (const p of run.points) {
      box = includePoint(box, p);
    }
  }
  if (!Number.isFinite(box.minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return box;
}

function lengthOf(runs: readonly Run[]): number {
  return runs.reduce((sum, run) => sum + runLength(run.points), 0);
}

function centroidOf(runs: readonly Run[], closed: boolean, area: number): Vec {
  if (closed && Math.abs(area) > 1e-6) {
    let cx = 0;
    let cy = 0;
    for (const run of runs) {
      const pts = run.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const cross = pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y;
        cx += (pts[i].x + pts[i + 1].x) * cross;
        cy += (pts[i].y + pts[i + 1].y) * cross;
      }
    }
    const denom = 6 * area;
    return vec(cx / denom, cy / denom);
  }
  let sx = 0;
  let sy = 0;
  let w = 0;
  for (const run of runs) {
    for (let i = 1; i < run.points.length; i++) {
      const a = run.points[i - 1];
      const b = run.points[i];
      const l = dist(a, b);
      sx += ((a.x + b.x) / 2) * l;
      sy += ((a.y + b.y) / 2) * l;
      w += l;
    }
  }
  return w > 0 ? vec(sx / w, sy / w) : vec(0, 0);
}

function areaOf(runs: readonly Run[]): number {
  return runs.reduce(
    (sum, run) => sum + (run.closed ? shoelace(run.points) : 0),
    0
  );
}

function chordOf(runs: readonly Run[]): number {
  if (runs.length === 0 || runs[0].points.length === 0) {
    return 0;
  }
  const first = runs[0].points[0];
  const lastRun = lastOf(runs);
  const last = lastOf(lastRun.points);
  return dist(first, last);
}

function endsOf(runs: readonly Run[]): Part["ends"] {
  if (runs.length !== 1 || runs[0].closed || runs[0].points.length < 2) {
    return null;
  }
  const pts = runs[0].points;
  const startAt = pts[0];
  const startNext = pts[1];
  const endAt = lastOf(pts);
  const endPrev = pts.at(-2) ?? startAt;
  return {
    start: { at: startAt, heading: unit(sub(startAt, startNext)) },
    end: { at: endAt, heading: unit(sub(endAt, endPrev)) },
  };
}

function principalAxis(runs: readonly Run[]): Vec {
  const pts = runs.flatMap((run) => run.points);
  if (pts.length < 2) {
    return vec(1, 0);
  }
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const p of pts) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }
  const trace = xx + yy;
  const det = xx * yy - xy * xy;
  const gap = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
  const eig = trace / 2 + gap;
  const axis =
    Math.abs(xy) > 1e-12 ? vec(eig - yy, xy) : xx >= yy ? vec(1, 0) : vec(0, 1);
  const n = unit(axis);
  return n.y < 0 || (n.y === 0 && n.x < 0) ? scale(n, -1) : n;
}

function allArcs(runs: readonly Run[]): ArcFit[] {
  return runs.flatMap((run) => run.arcs);
}

function partFrom(
  node: SvgNode,
  segs: readonly Seg[],
  ctm: Matrix,
  fill: string | undefined,
  stroke: string | undefined,
  joinTol: number,
  dotTol: number
): Part {
  const runs = flatten(segs, ctm, joinTol);
  const closed = runs.length > 0 && runs.every((run) => run.closed);
  const length = lengthOf(runs);
  const area = Math.abs(areaOf(runs));
  return {
    key: node.key === "root" ? asPartKey("0") : node.key,
    tag: node.tag as Exclude<SvgTag, "svg" | "g">,
    paint: paintKind(fill, stroke),
    runs,
    closed,
    dot: length < dotTol,
    bbox: bboxOf(runs),
    centroid: centroidOf(runs, closed, areaOf(runs)),
    length,
    ends: endsOf(runs),
    vertices: verticesFromSegs(segs, ctm),
    arcs: allArcs(runs),
    straightness: length > 1e-6 ? Math.min(1, chordOf(runs) / length) : 1,
    axis: principalAxis(runs),
    area,
  };
}

type WalkPaint = {
  fill: string | undefined;
  stroke: string | undefined;
};

function walk(
  node: SvgNode,
  ctm: Matrix,
  paint: WalkPaint,
  joinTol: number,
  dotTol: number,
  parts: Part[]
): void {
  const local = multiply(ctm, parseTransform(node.props.transform));
  const nextPaint: WalkPaint = {
    fill: node.props.fill ?? paint.fill,
    stroke: node.props.stroke ?? paint.stroke,
  };
  if (LEAF_TAGS.has(node.tag)) {
    parts.push(
      partFrom(
        node,
        segsFor(node),
        local,
        nextPaint.fill,
        nextPaint.stroke,
        joinTol,
        dotTol
      )
    );
    return;
  }
  for (const child of node.children) {
    walk(child, local, nextPaint, joinTol, dotTol, parts);
  }
}

export function measureParts(
  tree: SvgNode,
  joinTol = 0.48,
  dotTol = 1.2
): Part[] {
  const parts: Part[] = [];
  walk(
    tree,
    IDENTITY,
    { fill: "black", stroke: undefined },
    joinTol,
    dotTol,
    parts
  );
  return parts;
}

export function frameOf(tree: SvgNode, parts: readonly Part[]): Frame {
  const viewBox = parseViewBox(tree.props.viewBox ?? "0 0 24 24");
  const size = Math.max(boxWidth(viewBox), boxHeight(viewBox), 1);
  let content = emptyBox();
  for (const part of parts) {
    content = unionBox(content, part.bbox);
  }
  if (!Number.isFinite(content.minX)) {
    content = viewBox;
  }
  return {
    viewBox,
    size,
    center: boxCenter(viewBox),
    content,
    parts,
    tol: {
      join: 0.02 * size,
      align: 0.06 * size,
      dot: 0.05 * size,
      small: 0.15 * size,
    },
  };
}

export function measureFrame(tree: SvgNode): Frame {
  const viewBox = parseViewBox(tree.props.viewBox ?? "0 0 24 24");
  const size = Math.max(boxWidth(viewBox), boxHeight(viewBox), 1);
  const parts = measureParts(tree, 0.02 * size, 0.05 * size);
  return frameOf(tree, parts);
}

export function samplesOf(part: Part, step = 4): Vec[] {
  const pts: Vec[] = [];
  for (const run of part.runs) {
    for (let i = 0; i < run.points.length; i += step) {
      pts.push(run.points[i]);
    }
    const last = lastOf(run.points);
    if (pts.at(-1) !== last) {
      pts.push(last);
    }
  }
  return pts;
}

export function nearestDist(point: Vec, part: Part): number {
  let best = Number.POSITIVE_INFINITY;
  for (const run of part.runs) {
    for (let i = 1; i < run.points.length; i++) {
      const a = run.points[i - 1];
      const b = run.points[i];
      const ab = sub(b, a);
      const t = Math.min(
        1,
        Math.max(0, dot(sub(point, a), ab) / (dot(ab, ab) || 1))
      );
      best = Math.min(best, dist(point, add(a, scale(ab, t))));
    }
  }
  return best;
}

export function onOutline(point: Vec, part: Part, tol: number): boolean {
  return nearestDist(point, part) <= tol;
}

export function polylinePasses(part: Part, point: Vec, tol: number): boolean {
  return nearestDist(point, part) <= tol;
}

export function encloses(outer: Part, inner: Part, tol: number): boolean {
  if (!outer.closed) {
    return false;
  }
  const pad = tol;
  if (!boxContains(outer.bbox, inner.bbox, pad)) {
    return false;
  }
  return samplesOf(inner, 3).every((p) => {
    if (onOutline(p, outer, tol)) {
      return true;
    }
    let hits = 0;
    for (const run of outer.runs) {
      const pts = run.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const crosses =
          a.y > p.y !== b.y > p.y &&
          p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-12) + a.x;
        if (crosses) {
          hits++;
        }
      }
    }
    return hits % 2 === 1;
  });
}

export function congruentBy(a: Part, b: Part, tol: number): boolean {
  return (
    Math.abs(a.length - b.length) <= tol &&
    Math.abs(boxWidth(a.bbox) - boxWidth(b.bbox)) <= tol &&
    Math.abs(boxHeight(a.bbox) - boxHeight(b.bbox)) <= tol
  );
}

export function mirrorOf(
  a: Part,
  b: Part,
  axisX: number,
  tol: number
): boolean {
  const reflected = vec(2 * axisX - a.centroid.x, a.centroid.y);
  return dist(reflected, b.centroid) <= tol && congruentBy(a, b, tol * 2);
}

export function heading(from: Vec, to: Vec): Vec {
  return unit(sub(to, from));
}

export function angleOf(v: Vec): number {
  return Math.atan2(v.x, -v.y);
}

export function polarAngleDeg(from: Vec, to: Vec): number {
  const a = (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;
  return (a + 360) % 360;
}

export function project(p: Vec, origin: Vec, dir: Vec): number {
  return dot(sub(p, origin), dir);
}

export function lineIntersect(p: Vec, u: Vec, q: Vec, v: Vec): Vec | null {
  const den = cross(u, v);
  if (Math.abs(den) < 1e-9) {
    return null;
  }
  const t = cross(sub(q, p), v) / den;
  return add(p, scale(u, t));
}

export function nearly(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

export function parallel(a: Vec, b: Vec, deg = 8): boolean {
  const d = Math.abs(dot(unit(a), unit(b)));
  return d >= Math.cos((deg * Math.PI) / 180);
}

export function perpendicular(a: Vec, b: Vec, deg = 10): boolean {
  return Math.abs(dot(unit(a), unit(b))) <= Math.sin((deg * Math.PI) / 180);
}

export function partMid(part: Part): Vec {
  return boxCenter(part.bbox);
}

export function fmt(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function fmtVec(p: Vec): string {
  return `(${fmt(p.x)}, ${fmt(p.y)})`;
}
