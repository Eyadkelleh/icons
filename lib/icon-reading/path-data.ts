export type Vec = { readonly x: number; readonly y: number };

export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export type Seg =
  | { readonly kind: "M"; readonly to: Vec }
  | { readonly kind: "L"; readonly to: Vec }
  | { readonly kind: "C"; readonly c1: Vec; readonly c2: Vec; readonly to: Vec }
  | { readonly kind: "Q"; readonly c: Vec; readonly to: Vec }
  | {
      readonly kind: "A";
      readonly rx: number;
      readonly ry: number;
      readonly rotation: number;
      readonly large: boolean;
      readonly sweep: boolean;
      readonly to: Vec;
    }
  | { readonly kind: "Z" };

export type ArcFit = {
  readonly center: Vec;
  readonly r: number;
  readonly sweepDeg: number;
  readonly mid: Vec;
};

export type Run = {
  readonly points: readonly Vec[];
  readonly closed: boolean;
  readonly arcs: readonly ArcFit[];
};

const PATH_CMD = /[MmLlHhVvCcSsQqTtAaZz]/;
const NUMBER_TOKEN = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const TRANSFORM_CMD =
  /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
const TRANSFORM_NUM = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
const COMMA_WS = /[\s,]+/;

export function vec(x: number, y: number): Vec {
  return { x, y };
}

export function lastOf<T>(items: readonly T[]): T {
  const item = items.at(-1);
  if (item === undefined) {
    throw new Error("empty");
  }
  return item;
}

export function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec, k: number): Vec {
  return { x: a.x * k, y: a.y * k };
}

export function mid(a: Vec, b: Vec): Vec {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Vec, b: Vec): number {
  return a.x * b.y - a.y * b.x;
}

export function len(a: Vec): number {
  return Math.hypot(a.x, a.y);
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function unit(a: Vec): Vec {
  const n = len(a);
  return n < 1e-12 ? vec(0, 0) : scale(a, 1 / n);
}

export function apply(m: Matrix, p: Vec): Vec {
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5],
  };
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function translateM(tx: number, ty: number): Matrix {
  return [1, 0, 0, 1, tx, ty];
}

function scaleM(sx: number, sy: number): Matrix {
  return [sx, 0, 0, sy, 0, 0];
}

function rotateM(deg: number): Matrix {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
}

function skewXM(deg: number): Matrix {
  return [1, 0, Math.tan((deg * Math.PI) / 180), 1, 0, 0];
}

function skewYM(deg: number): Matrix {
  return [1, Math.tan((deg * Math.PI) / 180), 0, 1, 0, 0];
}

function isUniformScale(m: Matrix): boolean {
  const a = Math.hypot(m[0], m[1]);
  const b = Math.hypot(m[2], m[3]);
  return Math.abs(a - b) < 1e-3;
}

function skipSep(d: string, start: number): number {
  let i = start;
  while (i < d.length) {
    const ch = d[i];
    if (ch === "," || ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }
    break;
  }
  return i;
}

function readNumber(
  d: string,
  start: number
): { value: number; next: number } | null {
  const i = skipSep(d, start);
  NUMBER_TOKEN.lastIndex = i;
  const match = NUMBER_TOKEN.exec(d);
  if (!match) {
    return null;
  }
  return { value: Number(match[0]), next: NUMBER_TOKEN.lastIndex };
}

function readFlag(
  d: string,
  start: number
): { value: boolean; next: number } | null {
  const i = skipSep(d, start);
  const ch = d[i];
  if (ch !== "0" && ch !== "1") {
    return null;
  }
  return { value: ch === "1", next: i + 1 };
}

type PathState = {
  cur: Vec;
  start: Vec;
  lastC: Vec | null;
  lastQ: Vec | null;
};

function reflect(origin: Vec, control: Vec): Vec {
  return vec(2 * origin.x - control.x, 2 * origin.y - control.y);
}

function rel(abs: boolean, current: Vec, delta: Vec): Vec {
  return abs ? delta : add(current, delta);
}

function takePair(
  d: string,
  i: number
): { x: number; y: number; next: number } | null {
  const x = readNumber(d, i);
  if (!x) {
    return null;
  }
  const y = readNumber(d, x.next);
  if (!y) {
    return null;
  }
  return { x: x.value, y: y.value, next: y.next };
}

function emitMove(segs: Seg[], state: PathState, to: Vec): void {
  state.cur = to;
  state.start = to;
  state.lastC = null;
  state.lastQ = null;
  segs.push({ kind: "M", to });
}

function emitLine(segs: Seg[], state: PathState, to: Vec): void {
  state.cur = to;
  state.lastC = null;
  state.lastQ = null;
  segs.push({ kind: "L", to });
}

function emitCubic(
  segs: Seg[],
  state: PathState,
  c1: Vec,
  c2: Vec,
  to: Vec
): void {
  state.cur = to;
  state.lastC = c2;
  state.lastQ = null;
  segs.push({ kind: "C", c1, c2, to });
}

function emitQuad(segs: Seg[], state: PathState, c: Vec, to: Vec): void {
  state.cur = to;
  state.lastC = null;
  state.lastQ = c;
  segs.push({ kind: "Q", c, to });
}

function parseArcArgs(
  d: string,
  i: number
): {
  rx: number;
  ry: number;
  rotation: number;
  large: boolean;
  sweep: boolean;
  x: number;
  y: number;
  next: number;
} | null {
  const rx = readNumber(d, i);
  const ry = rx ? readNumber(d, rx.next) : null;
  const rot = ry ? readNumber(d, ry.next) : null;
  const large = rot ? readFlag(d, rot.next) : null;
  const sweep = large ? readFlag(d, large.next) : null;
  const x = sweep ? readNumber(d, sweep.next) : null;
  const y = x ? readNumber(d, x.next) : null;
  if (!(rx && ry && rot && large && sweep && x && y)) {
    return null;
  }
  return {
    rx: rx.value,
    ry: ry.value,
    rotation: rot.value,
    large: large.value,
    sweep: sweep.value,
    x: x.value,
    y: y.value,
    next: y.next,
  };
}

function parseRepeat(
  d: string,
  start: number,
  cmd: string,
  segs: Seg[],
  state: PathState
): number {
  let i = start;
  const abs = cmd === cmd.toUpperCase();
  const kind = cmd.toUpperCase();
  for (;;) {
    const next = parseOne(d, i, kind, abs, segs, state);
    if (next === null) {
      return i;
    }
    i = next;
    if (kind === "M") {
      return parseRepeat(d, i, abs ? "L" : "l", segs, state);
    }
  }
}

function parseHV(
  d: string,
  i: number,
  abs: boolean,
  segs: Seg[],
  state: PathState,
  axis: "x" | "y"
): number | null {
  const n = readNumber(d, i);
  if (!n) {
    return null;
  }
  const x =
    axis === "x" ? (abs ? n.value : state.cur.x + n.value) : state.cur.x;
  const y =
    axis === "y" ? (abs ? n.value : state.cur.y + n.value) : state.cur.y;
  emitLine(segs, state, vec(x, y));
  return n.next;
}

function parseML(
  d: string,
  i: number,
  abs: boolean,
  segs: Seg[],
  state: PathState,
  move: boolean
): number | null {
  const p = takePair(d, i);
  if (!p) {
    return null;
  }
  const to = rel(abs, state.cur, vec(p.x, p.y));
  if (move) {
    emitMove(segs, state, to);
  } else {
    emitLine(segs, state, to);
  }
  return p.next;
}

function parseClose(i: number, segs: Seg[], state: PathState): number {
  segs.push({ kind: "Z" });
  state.cur = state.start;
  state.lastC = null;
  state.lastQ = null;
  return i;
}

function parseOne(
  d: string,
  i: number,
  kind: string,
  abs: boolean,
  segs: Seg[],
  state: PathState
): number | null {
  if (kind === "H") {
    return parseHV(d, i, abs, segs, state, "x");
  }
  if (kind === "V") {
    return parseHV(d, i, abs, segs, state, "y");
  }
  if (kind === "L" || kind === "M") {
    return parseML(d, i, abs, segs, state, kind === "M");
  }
  if (kind === "C") {
    return parseCubic(d, i, abs, segs, state);
  }
  if (kind === "S") {
    return parseSmoothCubic(d, i, abs, segs, state);
  }
  if (kind === "Q") {
    return parseQuad(d, i, abs, segs, state);
  }
  if (kind === "T") {
    return parseSmoothQuad(d, i, abs, segs, state);
  }
  if (kind === "A") {
    return parseArc(d, i, abs, segs, state);
  }
  if (kind === "Z") {
    return parseClose(i, segs, state);
  }
  return null;
}

function parseCubic(
  d: string,
  i: number,
  abs: boolean,
  segs: Seg[],
  state: PathState
): number | null {
  const c1 = takePair(d, i);
  const c2 = c1 ? takePair(d, c1.next) : null;
  const p = c2 ? takePair(d, c2.next) : null;
  if (!(c1 && c2 && p)) {
    return null;
  }
  emitCubic(
    segs,
    state,
    rel(abs, state.cur, vec(c1.x, c1.y)),
    rel(abs, state.cur, vec(c2.x, c2.y)),
    rel(abs, state.cur, vec(p.x, p.y))
  );
  return p.next;
}

function parseSmoothCubic(
  d: string,
  i: number,
  abs: boolean,
  segs: Seg[],
  state: PathState
): number | null {
  const c2 = takePair(d, i);
  const p = c2 ? takePair(d, c2.next) : null;
  if (!(c2 && p)) {
    return null;
  }
  const c1 = state.lastC ? reflect(state.cur, state.lastC) : state.cur;
  emitCubic(
    segs,
    state,
    c1,
    rel(abs, state.cur, vec(c2.x, c2.y)),
    rel(abs, state.cur, vec(p.x, p.y))
  );
  return p.next;
}

function parseQuad(
  d: string,
  i: number,
  abs: boolean,
  segs: Seg[],
  state: PathState
): number | null {
  const c = takePair(d, i);
  const p = c ? takePair(d, c.next) : null;
  if (!(c && p)) {
    return null;
  }
  emitQuad(
    segs,
    state,
    rel(abs, state.cur, vec(c.x, c.y)),
    rel(abs, state.cur, vec(p.x, p.y))
  );
  return p.next;
}

function parseSmoothQuad(
  d: string,
  i: number,
  abs: boolean,
  segs: Seg[],
  state: PathState
): number | null {
  const p = takePair(d, i);
  if (!p) {
    return null;
  }
  const c = state.lastQ ? reflect(state.cur, state.lastQ) : state.cur;
  emitQuad(segs, state, c, rel(abs, state.cur, vec(p.x, p.y)));
  return p.next;
}

function parseArc(
  d: string,
  i: number,
  abs: boolean,
  segs: Seg[],
  state: PathState
): number | null {
  const a = parseArcArgs(d, i);
  if (!a) {
    return null;
  }
  const to = rel(abs, state.cur, vec(a.x, a.y));
  state.lastC = null;
  state.lastQ = null;
  segs.push({
    kind: "A",
    rx: Math.abs(a.rx),
    ry: Math.abs(a.ry),
    rotation: a.rotation,
    large: a.large,
    sweep: a.sweep,
    to,
  });
  state.cur = to;
  return a.next;
}

export function parsePathData(d: string): Seg[] {
  const segs: Seg[] = [];
  const state: PathState = {
    cur: vec(0, 0),
    start: vec(0, 0),
    lastC: null,
    lastQ: null,
  };
  let i = 0;
  while (i < d.length) {
    i = skipSep(d, i);
    if (i >= d.length) {
      break;
    }
    const ch = d[i];
    if (!PATH_CMD.test(ch)) {
      break;
    }
    i++;
    if (ch === "Z" || ch === "z") {
      parseOne(d, i, "Z", true, segs, state);
      continue;
    }
    i = parseRepeat(d, i, ch, segs, state);
  }
  return segs;
}

type ArcCenter = {
  center: Vec;
  rx: number;
  ry: number;
  phi: number;
  theta1: number;
  dtheta: number;
};

function vectorAngle(u: Vec, v: Vec): number {
  const sign = cross(u, v) < 0 ? -1 : 1;
  const den = len(u) * len(v);
  if (den < 1e-12) {
    return 0;
  }
  return sign * Math.acos(Math.min(1, Math.max(-1, dot(u, v) / den)));
}

function endpointToCenter(
  from: Vec,
  to: Vec,
  rx0: number,
  ry0: number,
  phiDeg: number,
  large: boolean,
  sweep: boolean
): ArcCenter | null {
  if (rx0 === 0 || ry0 === 0) {
    return null;
  }
  const phi = (phiDeg * Math.PI) / 180;
  const cosφ = Math.cos(phi);
  const sinφ = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1p = cosφ * dx + sinφ * dy;
  const y1p = -sinφ * dx + cosφ * dy;
  let rx = Math.abs(rx0);
  let ry = Math.abs(ry0);
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const num = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
  const den = rx2 * y1p * y1p + ry2 * x1p * x1p;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = coef * ((rx * y1p) / ry);
  const cyp = coef * ((-ry * x1p) / rx);
  const center = vec(
    cosφ * cxp - sinφ * cyp + (from.x + to.x) / 2,
    sinφ * cxp + cosφ * cyp + (from.y + to.y) / 2
  );
  const v1 = vec((x1p - cxp) / rx, (y1p - cyp) / ry);
  const v2 = vec((-x1p - cxp) / rx, (-y1p - cyp) / ry);
  const theta1 = vectorAngle(vec(1, 0), v1);
  let dtheta = vectorAngle(v1, v2);
  if (!sweep && dtheta > 0) {
    dtheta -= 2 * Math.PI;
  }
  if (sweep && dtheta < 0) {
    dtheta += 2 * Math.PI;
  }
  return { center, rx, ry, phi, theta1, dtheta };
}

function arcPoint(arc: ArcCenter, t: number): Vec {
  const theta = arc.theta1 + arc.dtheta * t;
  const cosφ = Math.cos(arc.phi);
  const sinφ = Math.sin(arc.phi);
  const x = arc.rx * Math.cos(theta);
  const y = arc.ry * Math.sin(theta);
  return vec(
    cosφ * x - sinφ * y + arc.center.x,
    sinφ * x + cosφ * y + arc.center.y
  );
}

function sampleCubic(p0: Vec, c1: Vec, c2: Vec, p1: Vec): Vec[] {
  const extent = dist(p0, c1) + dist(c1, c2) + dist(c2, p1);
  const n = Math.min(16, Math.max(2, Math.ceil(extent / 0.5)));
  const pts: Vec[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    pts.push(
      vec(
        mt * mt * mt * p0.x +
          3 * mt * mt * t * c1.x +
          3 * mt * t * t * c2.x +
          t * t * t * p1.x,
        mt * mt * mt * p0.y +
          3 * mt * mt * t * c1.y +
          3 * mt * t * t * c2.y +
          t * t * t * p1.y
      )
    );
  }
  return pts;
}

function sampleQuad(p0: Vec, c: Vec, p1: Vec): Vec[] {
  const extent = dist(p0, c) + dist(c, p1);
  const n = Math.min(16, Math.max(2, Math.ceil(extent / 0.5)));
  const pts: Vec[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    pts.push(
      vec(
        mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
        mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y
      )
    );
  }
  return pts;
}

function sampleArc(
  from: Vec,
  seg: Extract<Seg, { kind: "A" }>,
  ctm: Matrix
): { points: Vec[]; fit: ArcFit | null } {
  if (seg.rx === 0 || seg.ry === 0) {
    return { points: [seg.to], fit: null };
  }
  const arc = endpointToCenter(
    from,
    seg.to,
    seg.rx,
    seg.ry,
    seg.rotation,
    seg.large,
    seg.sweep
  );
  if (!arc) {
    return { points: [seg.to], fit: null };
  }
  const n = Math.max(2, Math.ceil((Math.abs(arc.dtheta) * 180) / Math.PI / 15));
  const points: Vec[] = [];
  for (let i = 1; i <= n; i++) {
    points.push(arcPoint(arc, i / n));
  }
  const circular = Math.abs(arc.rx - arc.ry) < 1e-3 && isUniformScale(ctm);
  const fit: ArcFit | null = circular
    ? {
        center: apply(ctm, arc.center),
        r: arc.rx * Math.hypot(ctm[0], ctm[1]),
        sweepDeg: (Math.abs(arc.dtheta) * 180) / Math.PI,
        mid: apply(ctm, arcPoint(arc, 0.5)),
      }
    : null;
  return { points, fit };
}

function closeIfNear(points: Vec[], closed: boolean, joinTol: number): boolean {
  if (closed || points.length < 2) {
    return closed;
  }
  return dist(points[0], lastOf(points)) < joinTol;
}

export function flatten(
  segs: readonly Seg[],
  ctm: Matrix,
  joinTol = 1e-3
): Run[] {
  const runs: Run[] = [];
  let points: Vec[] = [];
  let arcs: ArcFit[] = [];
  let closed = false;
  let cur = vec(0, 0);
  let start = vec(0, 0);

  const pushRun = () => {
    if (points.length < 2) {
      points = [];
      arcs = [];
      closed = false;
      return;
    }
    const isClosed = closeIfNear(points, closed, joinTol);
    if (isClosed && dist(points[0], lastOf(points)) > 1e-9) {
      points.push(points[0]);
    }
    runs.push({ points, closed: isClosed, arcs });
    points = [];
    arcs = [];
    closed = false;
  };

  const addPoint = (p: Vec) => {
    const mapped = apply(ctm, p);
    const last = points.at(-1);
    if (!last || dist(last, mapped) > 1e-9) {
      points.push(mapped);
    }
  };

  for (const seg of segs) {
    if (seg.kind === "M") {
      if (points.length > 1) {
        pushRun();
      } else {
        points = [];
        arcs = [];
        closed = false;
      }
      cur = seg.to;
      start = seg.to;
      addPoint(seg.to);
      continue;
    }
    if (seg.kind === "L") {
      addPoint(seg.to);
      cur = seg.to;
      continue;
    }
    if (seg.kind === "C") {
      for (const p of sampleCubic(cur, seg.c1, seg.c2, seg.to)) {
        addPoint(p);
      }
      cur = seg.to;
      continue;
    }
    if (seg.kind === "Q") {
      for (const p of sampleQuad(cur, seg.c, seg.to)) {
        addPoint(p);
      }
      cur = seg.to;
      continue;
    }
    if (seg.kind === "A") {
      const sampled = sampleArc(cur, seg, ctm);
      for (const p of sampled.points) {
        addPoint(p);
      }
      if (sampled.fit) {
        arcs.push(sampled.fit);
      }
      cur = seg.to;
      continue;
    }
    closed = true;
    addPoint(start);
    cur = start;
  }
  pushRun();
  return runs;
}

function nums(body: string): number[] {
  return [...body.matchAll(TRANSFORM_NUM)].map((m) => Number(m[0]));
}

function transformMatrix(name: string, args: number[]): Matrix | null {
  if (name === "matrix" && args.length >= 6) {
    return [args[0], args[1], args[2], args[3], args[4], args[5]];
  }
  if (name === "translate") {
    return translateM(args[0] ?? 0, args[1] ?? 0);
  }
  if (name === "scale") {
    return scaleM(args[0] ?? 1, args[1] ?? args[0] ?? 1);
  }
  if (name === "rotate") {
    const r = rotateM(args[0] ?? 0);
    if (args.length < 3) {
      return r;
    }
    return multiply(
      translateM(args[1], args[2]),
      multiply(r, translateM(-args[1], -args[2]))
    );
  }
  if (name === "skewX") {
    return skewXM(args[0] ?? 0);
  }
  if (name === "skewY") {
    return skewYM(args[0] ?? 0);
  }
  return null;
}

export function parseTransform(value: string | undefined): Matrix {
  if (!value) {
    return IDENTITY;
  }
  let m: Matrix = IDENTITY;
  TRANSFORM_CMD.lastIndex = 0;
  for (const match of value.matchAll(TRANSFORM_CMD)) {
    const next = transformMatrix(match[1], nums(match[2]));
    if (next) {
      m = multiply(m, next);
    }
  }
  return m;
}

export function polylineSegs(points: readonly Vec[], closed: boolean): Seg[] {
  if (points.length === 0) {
    return [];
  }
  const segs: Seg[] = [{ kind: "M", to: points[0] }];
  for (let i = 1; i < points.length; i++) {
    segs.push({ kind: "L", to: points[i] });
  }
  if (closed) {
    segs.push({ kind: "Z" });
  }
  return segs;
}

export function parsePoints(value: string): Vec[] {
  const parts = value
    .trim()
    .split(COMMA_WS)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const pts: Vec[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    pts.push(vec(parts[i], parts[i + 1]));
  }
  return pts;
}

export function circleSegs(cx: number, cy: number, r: number): Seg[] {
  const right = vec(cx + r, cy);
  const left = vec(cx - r, cy);
  return [
    { kind: "M", to: right },
    {
      kind: "A",
      rx: r,
      ry: r,
      rotation: 0,
      large: false,
      sweep: true,
      to: left,
    },
    {
      kind: "A",
      rx: r,
      ry: r,
      rotation: 0,
      large: false,
      sweep: true,
      to: right,
    },
    { kind: "Z" },
  ];
}

export function ellipseSegs(
  cx: number,
  cy: number,
  rx: number,
  ry: number
): Seg[] {
  const right = vec(cx + rx, cy);
  const left = vec(cx - rx, cy);
  return [
    { kind: "M", to: right },
    {
      kind: "A",
      rx,
      ry,
      rotation: 0,
      large: false,
      sweep: true,
      to: left,
    },
    {
      kind: "A",
      rx,
      ry,
      rotation: 0,
      large: false,
      sweep: true,
      to: right,
    },
    { kind: "Z" },
  ];
}

export function rectSegs(
  x: number,
  y: number,
  w: number,
  h: number,
  rx0: number,
  ry0: number
): Seg[] {
  const rx = Math.min(Math.abs(rx0), w / 2);
  const ry = Math.min(Math.abs(ry0), h / 2);
  if (rx < 1e-6 || ry < 1e-6) {
    return polylineSegs(
      [vec(x, y), vec(x + w, y), vec(x + w, y + h), vec(x, y + h)],
      true
    );
  }
  const arc = (to: Vec): Extract<Seg, { kind: "A" }> => ({
    kind: "A",
    rx,
    ry,
    rotation: 0,
    large: false,
    sweep: true,
    to,
  });
  return [
    { kind: "M", to: vec(x + rx, y) },
    { kind: "L", to: vec(x + w - rx, y) },
    arc(vec(x + w, y + ry)),
    { kind: "L", to: vec(x + w, y + h - ry) },
    arc(vec(x + w - rx, y + h)),
    { kind: "L", to: vec(x + rx, y + h) },
    arc(vec(x, y + h - ry)),
    { kind: "L", to: vec(x, y + ry) },
    arc(vec(x + rx, y)),
    { kind: "Z" },
  ];
}

export function runLength(points: readonly Vec[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += dist(points[i - 1], points[i]);
  }
  return total;
}

export function shoelace(points: readonly Vec[]): number {
  if (points.length < 3) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    sum += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
  }
  return sum / 2;
}
