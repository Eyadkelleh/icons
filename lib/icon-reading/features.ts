import {
  type Box,
  boxArea,
  boxCenter,
  boxContains,
  boxHeight,
  boxWidth,
  congruentBy,
  encloses,
  type Frame,
  fmt,
  fmtVec,
  lineIntersect,
  mirrorOf,
  nearestDist,
  onOutline,
  type Part,
  parallel,
  partMid,
  perpendicular,
  polarAngleDeg,
  polylinePasses,
  project,
  samplesOf,
} from "./geometry";
import type { PartKey } from "./parse";
import {
  add,
  dist,
  dot,
  lastOf,
  len,
  scale,
  sub,
  unit,
  type Vec,
  vec,
} from "./path-data";

export type Arrow = {
  readonly head: PartKey;
  readonly shaft: PartKey | null;
  readonly base: PartKey | null;
  readonly tip: Vec;
  readonly dir: Vec;
};

export type Radial = {
  readonly center: Vec;
  readonly rays: readonly PartKey[];
  readonly stepDeg: number;
  readonly radiusCv: number;
  readonly hub: PartKey | null;
  readonly attached: boolean;
};

export type Concentric = {
  readonly center: Vec;
  readonly arcs: readonly { readonly key: PartKey; readonly r: number }[];
  readonly opening: Vec;
  readonly anchor: PartKey | null;
};

export type Bars = {
  readonly bars: readonly PartKey[];
  readonly growDir: Vec;
  readonly fillDir: Vec;
  readonly roots: ReadonlyMap<PartKey, Vec>;
  readonly sharedBaseline: boolean;
  readonly monotonic: boolean;
  readonly cell: PartKey | null;
};

export type Gauge = {
  readonly cell: PartKey;
  readonly terminal: PartKey;
  readonly fillDir: Vec;
  readonly level: number;
};

export type Corners = {
  readonly center: Vec;
  readonly corners: readonly {
    readonly keys: readonly PartKey[];
    readonly vertex: Vec;
    readonly out: Vec;
  }[];
  readonly facing: "out" | "in";
};

export type Stack = {
  readonly layers: readonly PartKey[];
  readonly step: Vec;
};

export type Lattice = {
  readonly marks: readonly PartKey[];
  readonly rows: number;
  readonly cols: number;
};

export type Shackle = {
  readonly body: PartKey;
  readonly shackle: PartKey;
  readonly endsOnBody: 1 | 2;
  readonly startsOnBody: boolean;
};

export type CheckMark = {
  readonly key: PartKey;
  readonly vertex: Vec;
  readonly legRatio: number;
  readonly reversed: boolean;
};

export type Loupe = {
  readonly lens: PartKey;
  readonly handle: PartKey;
  readonly center: Vec;
  readonly r: number;
  readonly handleDir: Vec;
  readonly grip: Vec;
};

export type Face = {
  readonly outline: PartKey;
  readonly eyes: readonly [PartKey, PartKey];
  readonly eyeCenters: readonly [Vec, Vec];
  readonly mouth: PartKey;
  readonly mouthCenter: Vec;
  readonly mood: "smile" | "frown" | "flat" | "open";
  readonly brows: readonly PartKey[];
};

export type Hands = {
  readonly pivot: Vec;
  readonly hands: readonly PartKey[];
  readonly dial: PartKey;
};

export type Silhouette = {
  readonly body: PartKey;
  readonly centroid: Vec;
  readonly bilateral: number;
  readonly taper: number;
  readonly lobes: number;
  readonly hangPoint: Vec;
  readonly pendant: PartKey | null;
  readonly flankers: readonly PartKey[];
  readonly compactness: number;
};

export type Cross = {
  readonly center: Vec;
  readonly arms: readonly PartKey[];
};

export type FeatureSet = {
  readonly arrows: readonly Arrow[];
  readonly checks: readonly CheckMark[];
  readonly radial?: Radial;
  readonly concentric?: Concentric;
  readonly bars?: Bars;
  readonly gauge?: Gauge;
  readonly corners?: Corners;
  readonly stack?: Stack;
  readonly lattice?: Lattice;
  readonly shackle?: Shackle;
  readonly loupe?: Loupe;
  readonly face?: Face;
  readonly hands?: Hands;
  readonly silhouette?: Silhouette;
  readonly cross?: Cross;
};

export type FeatureName = keyof FeatureSet;

function partMap(frame: Frame): Map<PartKey, Part> {
  return new Map(frame.parts.map((part) => [part.key, part]));
}

function byKey(frame: Frame, key: PartKey): Part | undefined {
  return frame.parts.find((part) => part.key === key);
}

function aspectOf(part: Part): number {
  const w = boxWidth(part.bbox);
  const h = boxHeight(part.bbox);
  const a = Math.max(w, h);
  const b = Math.min(w, h);
  return b < 1e-6 ? a : a / b;
}

function elongated(part: Part): boolean {
  return aspectOf(part) >= 2;
}

function circleFit(part: Part): { center: Vec; r: number } | null {
  if (part.arcs.length >= 1 && part.closed) {
    const r = part.arcs.reduce((sum, arc) => sum + arc.r, 0) / part.arcs.length;
    const center = part.arcs.reduce(
      (acc, arc) => add(acc, arc.center),
      vec(0, 0)
    );
    return {
      center: scale(center, 1 / part.arcs.length),
      r,
    };
  }
  if (part.tag === "circle" && part.closed) {
    return { center: part.centroid, r: boxWidth(part.bbox) / 2 };
  }
  return null;
}

function openParts(frame: Frame): Part[] {
  return frame.parts.filter((part) => !part.closed);
}

function closedParts(frame: Frame): Part[] {
  return frame.parts.filter((part) => part.closed);
}

function straightOpen(frame: Frame): Part[] {
  return openParts(frame).filter(
    (part) => part.straightness > 0.95 && part.length >= frame.tol.small / 2
  );
}

function cv(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (Math.abs(mean) < 1e-9) {
    return 0;
  }
  const varSum =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(varSum) / Math.abs(mean);
}

function lineDist(point: Vec, origin: Vec, dir: Vec): number {
  const n = len(dir);
  if (n < 1e-9) {
    return dist(point, origin);
  }
  return Math.abs(dot(vec(-dir.y, dir.x), sub(point, origin))) / n;
}

function meetLines(lines: readonly { origin: Vec; dir: Vec }[]): Vec | null {
  if (lines.length < 2) {
    return null;
  }
  let a00 = 0;
  let a01 = 0;
  let a11 = 0;
  let b0 = 0;
  let b1 = 0;
  for (const line of lines) {
    const n = unit(vec(-line.dir.y, line.dir.x));
    a00 += n.x * n.x;
    a01 += n.x * n.y;
    a11 += n.y * n.y;
    const np = n.x * line.origin.x + n.y * line.origin.y;
    b0 += n.x * np;
    b1 += n.y * np;
  }
  const det = a00 * a11 - a01 * a01;
  if (Math.abs(det) < 1e-9) {
    return null;
  }
  return vec((a11 * b0 - a01 * b1) / det, (a00 * b1 - a01 * b0) / det);
}

function usedSet(keys: readonly PartKey[]): Set<PartKey> {
  return new Set(keys);
}

function chevronOf(part: Part): { tip: Vec; dir: Vec; ratio: number } | null {
  if (part.closed || part.vertices.length !== 1 || !part.ends) {
    return null;
  }
  const vertex = part.vertices[0];
  if (vertex.interiorDeg < 60 || vertex.interiorDeg > 120) {
    return null;
  }
  const short = Math.min(vertex.legIn, vertex.legOut);
  const long = Math.max(vertex.legIn, vertex.legOut);
  const ratio = long < 1e-6 ? 0 : short / long;
  const midEnds = scale(add(part.ends.start.at, part.ends.end.at), 0.5);
  const dir = unit(sub(vertex.at, midEnds));
  if (len(dir) < 0.5) {
    return null;
  }
  return { tip: vertex.at, dir, ratio };
}

function findShaft(
  head: Part,
  tip: Vec,
  dir: Vec,
  frame: Frame,
  taken: Set<PartKey>
): Part | null {
  let best: Part | null = null;
  let bestDist = frame.tol.join * 2;
  for (const part of frame.parts) {
    if (part.key === head.key || taken.has(part.key) || part.closed) {
      continue;
    }
    if (part.straightness < 0.97 || !part.ends) {
      continue;
    }
    if (!parallel(part.axis, dir, 8)) {
      continue;
    }
    const gap = Math.min(
      dist(part.ends.start.at, tip),
      dist(part.ends.end.at, tip)
    );
    if (gap <= bestDist) {
      best = part;
      bestDist = gap;
    }
  }
  return bestDist <= frame.tol.join ? best : null;
}

function findBase(
  head: Part,
  shaft: Part | null,
  tip: Vec,
  dir: Vec,
  frame: Frame,
  taken: Set<PartKey>
): Part | null {
  const skip = usedSet([head.key, ...(shaft ? [shaft.key] : [])]);
  for (const part of openParts(frame)) {
    if (skip.has(part.key) || taken.has(part.key) || !part.ends) {
      continue;
    }
    if (!perpendicular(part.axis, dir, 25) && part.straightness > 0.97) {
      continue;
    }
    if (perpendicular(part.axis, dir, 25) || part.vertices.length >= 1) {
      const behind = project(part.centroid, tip, dir) < -frame.tol.join;
      if (behind) {
        return part;
      }
    }
  }
  return null;
}

function detectArrows(frame: Frame): Arrow[] {
  const arrows: Arrow[] = [];
  const taken = new Set<PartKey>();
  for (const part of frame.parts) {
    const chevron = chevronOf(part);
    if (!chevron || chevron.ratio < 0.8) {
      continue;
    }
    const shaft = findShaft(part, chevron.tip, chevron.dir, frame, taken);
    const base = findBase(part, shaft, chevron.tip, chevron.dir, frame, taken);
    arrows.push({
      head: part.key,
      shaft: shaft?.key ?? null,
      base: base?.key ?? null,
      tip: chevron.tip,
      dir: chevron.dir,
    });
    taken.add(part.key);
    if (shaft) {
      taken.add(shaft.key);
    }
    if (base) {
      taken.add(base.key);
    }
  }
  return arrows;
}

function detectChecks(frame: Frame): CheckMark[] {
  const marks: CheckMark[] = [];
  for (const part of openParts(frame)) {
    const chevron = chevronOf(part);
    if (!(chevron && part.ends)) {
      continue;
    }
    if (chevron.ratio < 0.15 || chevron.ratio > 0.7) {
      continue;
    }
    const vertex = part.vertices[0];
    if (vertex.interiorDeg < 70 || vertex.interiorDeg > 110) {
      continue;
    }
    const longIsStart = vertex.legIn >= vertex.legOut;
    const longTip = longIsStart ? part.ends.start.at : part.ends.end.at;
    const rise = sub(longTip, vertex.at);
    if (rise.y >= 0) {
      continue;
    }
    const startIsLong = dist(part.ends.start.at, longTip) < frame.tol.join;
    marks.push({
      key: part.key,
      vertex: vertex.at,
      legRatio: chevron.ratio,
      reversed: startIsLong,
    });
  }
  return marks;
}

function rayCandidates(frame: Frame): Part[] {
  return straightOpen(frame).filter((part) => part.length < 0.3 * frame.size);
}

function angularCoverage(angles: number[]): number {
  if (angles.length < 2) {
    return 0;
  }
  const sorted = [...angles].sort((a, b) => a - b);
  let maxGap = sorted[0] + 360 - lastOf(sorted);
  for (let i = 1; i < sorted.length; i++) {
    maxGap = Math.max(maxGap, sorted[i] - sorted[i - 1]);
  }
  return 360 - maxGap;
}

function detectRadial(frame: Frame): Radial | undefined {
  const rays = rayCandidates(frame);
  if (rays.length < 4) {
    return undefined;
  }
  const lines = rays.map((part) => ({ origin: part.centroid, dir: part.axis }));
  const center = meetLines(lines);
  if (!center) {
    return undefined;
  }
  const near = rays.filter(
    (part) => lineDist(center, part.centroid, part.axis) <= frame.tol.align
  );
  if (near.length < 4) {
    return undefined;
  }
  const angles = near.map((part) => polarAngleDeg(center, part.centroid));
  if (angularCoverage(angles) < 180) {
    return undefined;
  }
  const ordered = [...near].sort(
    (a, b) =>
      polarAngleDeg(center, a.centroid) - polarAngleDeg(center, b.centroid)
  );
  const steps: number[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const a = polarAngleDeg(center, ordered[i].centroid);
    const b = polarAngleDeg(center, ordered[(i + 1) % ordered.length].centroid);
    steps.push((b - a + 360) % 360);
  }
  const radii = ordered.map((part) => dist(part.centroid, center));
  const hub =
    closedParts(frame).find((part) => {
      const fit = circleFit(part);
      return fit ? dist(fit.center, center) <= frame.tol.align : false;
    }) ?? null;
  const attached = Boolean(
    hub &&
      ordered.some(
        (ray) => nearestDist(partMid(hub), ray) <= frame.tol.join * 4
      )
  );
  const hubTouch =
    hub !== null &&
    ordered.some((ray) => {
      const fit = circleFit(hub);
      if (!(fit && ray.ends)) {
        return false;
      }
      const d0 = dist(ray.ends.start.at, fit.center);
      const d1 = dist(ray.ends.end.at, fit.center);
      return (
        Math.min(Math.abs(d0 - fit.r), Math.abs(d1 - fit.r)) <= frame.tol.join
      );
    });
  return {
    center,
    rays: ordered.map((part) => part.key),
    stepDeg: steps.reduce((s, v) => s + v, 0) / steps.length,
    radiusCv: cv(radii),
    hub: hub?.key ?? null,
    attached: attached || hubTouch,
  };
}

function openArcParts(
  frame: Frame
): { part: Part; r: number; center: Vec; mid: Vec }[] {
  const found: { part: Part; r: number; center: Vec; mid: Vec }[] = [];
  for (const part of openParts(frame)) {
    for (const arc of part.arcs) {
      if (arc.sweepDeg >= 300) {
        continue;
      }
      found.push({ part, r: arc.r, center: arc.center, mid: arc.mid });
    }
  }
  return found;
}

function clusterCenters(items: { center: Vec }[], tol: number): Vec | null {
  if (items.length < 2) {
    return null;
  }
  let best: Vec | null = null;
  let bestCount = 0;
  for (const seed of items) {
    const members = items.filter(
      (item) => dist(item.center, seed.center) <= tol
    );
    if (members.length > bestCount) {
      bestCount = members.length;
      best = members.reduce((acc, item) => add(acc, item.center), vec(0, 0));
      best = scale(best, 1 / members.length);
    }
  }
  return bestCount >= 2 ? best : null;
}

function detectConcentric(frame: Frame): Concentric | undefined {
  const arcs = openArcParts(frame);
  const center = clusterCenters(arcs, frame.tol.align);
  if (!center) {
    return undefined;
  }
  const members = arcs.filter(
    (arc) => dist(arc.center, center) <= frame.tol.align
  );
  const unique: { key: PartKey; r: number; mid: Vec }[] = [];
  for (const member of members) {
    const existing = unique.find((u) => u.key === member.part.key);
    if (existing) {
      continue;
    }
    unique.push({ key: member.part.key, r: member.r, mid: member.mid });
  }
  const radii = [...new Set(unique.map((u) => Math.round(u.r * 2) / 2))];
  if (radii.length < 2) {
    return undefined;
  }
  unique.sort((a, b) => a.r - b.r);
  const opening = unit(
    unique.reduce((acc, item) => add(acc, sub(item.mid, center)), vec(0, 0))
  );
  const anchor =
    frame.parts.find((part) => {
      if (
        !(part.dot || (part.closed && boxWidth(part.bbox) <= frame.tol.small))
      ) {
        return false;
      }
      return dist(part.centroid, center) <= frame.tol.align;
    }) ?? null;
  return {
    center,
    arcs: unique.map((item) => ({ key: item.key, r: item.r })),
    opening,
    anchor: anchor?.key ?? null,
  };
}

function barAxis(part: Part): Vec {
  const w = boxWidth(part.bbox);
  const h = boxHeight(part.bbox);
  if (part.closed && w > h * 1.2) {
    return vec(1, 0);
  }
  if (part.closed && h > w * 1.2) {
    return vec(0, 1);
  }
  return part.axis.y >= 0 ? part.axis : scale(part.axis, -1);
}

function isBar(part: Part, frame: Frame): boolean {
  if (part.dot) {
    return false;
  }
  if (!part.closed) {
    return part.straightness > 0.95 && part.length >= frame.tol.small / 2;
  }
  return elongated(part);
}

function enclosingCell(part: Part, frame: Frame): Part | null {
  return (
    closedParts(frame).find(
      (cell) => cell.key !== part.key && encloses(cell, part, frame.tol.join)
    ) ?? null
  );
}

function barRoot(part: Part, growDir: Vec, shared: boolean): Vec {
  if (!shared) {
    return part.centroid;
  }
  if (part.ends) {
    const start = project(part.ends.start.at, part.centroid, growDir);
    const end = project(part.ends.end.at, part.centroid, growDir);
    return start < end ? part.ends.start.at : part.ends.end.at;
  }
  const c = boxCenter(part.bbox);
  return growDir.y < 0
    ? vec(c.x, part.bbox.maxY)
    : growDir.y > 0
      ? vec(c.x, part.bbox.minY)
      : growDir.x < 0
        ? vec(part.bbox.maxX, c.y)
        : vec(part.bbox.minX, c.y);
}

function alignedEnds(
  parts: Part[],
  growDir: Vec,
  tol: number,
  which: "root" | "tip"
): boolean {
  const values = parts.map((part) => {
    const root = barRoot(part, growDir, true);
    const tip =
      part.ends && dist(part.ends.start.at, root) > dist(part.ends.end.at, root)
        ? part.ends.start.at
        : (part.ends?.end.at ?? boxCenter(part.bbox));
    return project(
      which === "root" ? root : tip,
      parts[0].centroid,
      vec(-growDir.y, growDir.x)
    );
  });
  return (
    cv(values) < 0.12 || values.every((v) => Math.abs(v - values[0]) <= tol)
  );
}

function detectBars(frame: Frame): Bars | undefined {
  const candidates = frame.parts.filter((part) => isBar(part, frame));
  if (candidates.length < 2) {
    return undefined;
  }
  let cluster: Part[] = [];
  for (const seed of candidates) {
    const axis = barAxis(seed);
    const group = candidates.filter((part) => parallel(barAxis(part), axis, 5));
    if (group.length > cluster.length) {
      cluster = group;
    }
  }
  if (cluster.length < 2) {
    return undefined;
  }
  const cells = cluster
    .map((part) => enclosingCell(part, frame))
    .filter((cell): cell is Part => Boolean(cell));
  const cell = cells.sort(
    (a, b) =>
      cells.filter((c) => c.key === b.key).length -
      cells.filter((c) => c.key === a.key).length
  )[0];
  const inside = cell
    ? cluster.filter((part) => encloses(cell, part, frame.tol.join))
    : cluster;
  if (inside.length < 2) {
    return undefined;
  }
  const axis = barAxis(inside[0]);
  const fillDir = Math.abs(axis.x) > Math.abs(axis.y) ? vec(0, 1) : vec(1, 0);
  const ordered = [...inside].sort(
    (a, b) =>
      project(a.centroid, frame.center, fillDir) -
      project(b.centroid, frame.center, fillDir)
  );
  const growDir =
    axis.y < -0.3 || (Math.abs(axis.y) < 0.3 && axis.x < 0)
      ? scale(axis, -1)
      : axis;
  const lengths = ordered.map((part) =>
    part.closed
      ? Math.max(boxWidth(part.bbox), boxHeight(part.bbox))
      : part.length
  );
  const rootAligned = alignedEnds(ordered, growDir, frame.tol.join, "root");
  const tipAligned = alignedEnds(ordered, growDir, frame.tol.align, "tip");
  const sharedBaseline = rootAligned && !tipAligned;
  const roots = new Map(
    ordered.map(
      (part) => [part.key, barRoot(part, growDir, sharedBaseline)] as const
    )
  );
  const monotonic = lengths.every(
    (lenValue, i) => i === 0 || lenValue >= lengths[i - 1] - 1e-6
  );
  return {
    bars: ordered.map((part) => part.key),
    growDir,
    fillDir,
    roots,
    sharedBaseline,
    monotonic: monotonic && lengths[0] < lastOf(lengths) - frame.tol.join,
    cell: cell?.key ?? null,
  };
}

function shortSideCenter(
  cell: Part,
  side: "left" | "right" | "top" | "bottom"
): Vec {
  const b = cell.bbox;
  if (side === "right") {
    return vec(b.maxX, (b.minY + b.maxY) / 2);
  }
  if (side === "left") {
    return vec(b.minX, (b.minY + b.maxY) / 2);
  }
  if (side === "top") {
    return vec((b.minX + b.maxX) / 2, b.minY);
  }
  return vec((b.minX + b.maxX) / 2, b.maxY);
}

function detectGauge(frame: Frame): Gauge | undefined {
  for (const cell of closedParts(frame)) {
    if (aspectOf(cell) < 1.2) {
      continue;
    }
    const landscape = boxWidth(cell.bbox) >= boxHeight(cell.bbox);
    const sides = landscape
      ? (["right", "left"] as const)
      : (["top", "bottom"] as const);
    for (const side of sides) {
      const anchor = shortSideCenter(cell, side);
      const terminal = frame.parts.find((part) => {
        if (
          part.key === cell.key ||
          part.closed ||
          part.length > frame.tol.small * 1.5
        ) {
          return false;
        }
        if (part.length < frame.tol.dot) {
          return false;
        }
        const outside = !boxContains(cell.bbox, part.bbox, -frame.tol.join);
        const near = dist(part.centroid, anchor) <= 0.25 * frame.size;
        const dir = landscape ? vec(0, 1) : vec(1, 0);
        return outside && near && parallel(part.axis, dir, 15);
      });
      if (!terminal) {
        continue;
      }
      const fillDir = unit(sub(anchor, boxCenter(cell.bbox)));
      const inner = frame.parts.filter(
        (part) => part.key !== cell.key && encloses(cell, part, frame.tol.join)
      );
      const span = inner.reduce(
        (m, part) => Math.max(m, boxWidth(part.bbox), boxHeight(part.bbox)),
        0
      );
      const cellSpan = landscape ? boxWidth(cell.bbox) : boxHeight(cell.bbox);
      return {
        cell: cell.key,
        terminal: terminal.key,
        fillDir,
        level: cellSpan > 0 ? Math.min(1, span / cellSpan) : 0,
      };
    }
  }
  return undefined;
}

function bracketVertex(part: Part): Vec | null {
  if (!part.ends) {
    return null;
  }
  if (!perpendicular(part.ends.start.heading, part.ends.end.heading, 12)) {
    return null;
  }
  return lineIntersect(
    part.ends.start.at,
    part.ends.start.heading,
    part.ends.end.at,
    part.ends.end.heading
  );
}

function quadrant(point: Vec, center: Vec): number {
  const d = sub(point, center);
  if (d.x >= 0 && d.y < 0) {
    return 0;
  }
  if (d.x >= 0 && d.y >= 0) {
    return 1;
  }
  if (d.x < 0 && d.y >= 0) {
    return 2;
  }
  return 3;
}

function detectCornerBrackets(frame: Frame): Corners | undefined {
  const brackets: { part: Part; vertex: Vec }[] = [];
  for (const part of openParts(frame)) {
    const vertex = bracketVertex(part);
    if (vertex) {
      brackets.push({ part, vertex });
    }
  }
  if (brackets.length < 4) {
    return undefined;
  }
  const center = boxCenter(frame.content);
  const byQ: { part: Part; vertex: Vec }[] = [];
  for (let q = 0; q < 4; q++) {
    const hit = brackets.find((b) => quadrant(b.vertex, center) === q);
    if (!hit) {
      return undefined;
    }
    byQ.push(hit);
  }
  const congruent = byQ.every((b) =>
    congruentBy(b.part, byQ[0].part, frame.tol.align)
  );
  if (!congruent) {
    return undefined;
  }
  const _outSample = unit(sub(byQ[0].vertex, center));
  const endDist = Math.min(
    dist(byQ[0].part.ends?.start.at ?? byQ[0].vertex, center),
    dist(byQ[0].part.ends?.end.at ?? byQ[0].vertex, center)
  );
  const facing =
    dist(byQ[0].vertex, center) >= endDist - frame.tol.join ? "out" : "in";
  return {
    center,
    corners: byQ.map((b) => ({
      keys: [b.part.key],
      vertex: b.vertex,
      out: unit(sub(b.vertex, center)),
    })),
    facing,
  };
}

function detectCornerArrows(
  frame: Frame,
  arrows: Arrow[]
): Corners | undefined {
  if (arrows.length < 4) {
    return undefined;
  }
  const center = boxCenter(frame.content);
  const byQ: Arrow[] = [];
  for (let q = 0; q < 4; q++) {
    const hit = arrows.find(
      (a) =>
        quadrant(add(center, a.dir), center) === q ||
        quadrant(a.tip, center) === q
    );
    if (!hit) {
      return undefined;
    }
    byQ.push(hit);
  }
  const net = byQ.reduce((acc, a) => add(acc, a.dir), vec(0, 0));
  if (len(net) > 0.8) {
    return undefined;
  }
  return {
    center,
    corners: byQ.map((a) => ({
      keys: [a.head, ...(a.shaft ? [a.shaft] : [])],
      vertex: a.tip,
      out: a.dir,
    })),
    facing: "out",
  };
}

function detectCorners(frame: Frame): Corners | undefined {
  return (
    detectCornerBrackets(frame) ??
    detectCornerArrows(frame, detectArrows(frame))
  );
}

function bboxCorners(b: Box): Vec[] {
  return [
    vec(b.minX, b.minY),
    vec(b.maxX, b.minY),
    vec(b.maxX, b.maxY),
    vec(b.minX, b.maxY),
  ];
}

function translatedOnto(
  shift: Vec,
  from: Part,
  onto: Part,
  tol: number
): boolean {
  const samples = samplesOf(from, 2);
  if (samples.length === 0) {
    return false;
  }
  let hits = 0;
  for (const point of samples) {
    if (onOutline(sub(point, shift), onto, tol)) {
      hits++;
    }
  }
  return hits >= 0.9 * samples.length;
}

function detectStack(frame: Frame): Stack | undefined {
  const sheets = frame.parts.filter(
    (part) => boxArea(part.bbox) >= 0.15 * boxArea(frame.content)
  );
  type Pair = { front: Part; back: Part; step: Vec };
  const pairs: Pair[] = [];
  for (const front of sheets.filter((part) => part.closed)) {
    for (const back of frame.parts) {
      if (back.key === front.key) {
        continue;
      }
      const frontCorners = bboxCorners(front.bbox);
      const backCorners = bboxCorners(back.bbox);
      for (let i = 0; i < 4; i++) {
        const step = sub(backCorners[i], frontCorners[i]);
        if (len(step) < frame.tol.join || len(step) > frame.size) {
          continue;
        }
        if (translatedOnto(step, back, front, frame.tol.join)) {
          pairs.push({ front, back, step });
          break;
        }
      }
    }
  }
  if (pairs.length === 0) {
    return undefined;
  }
  const front = pairs[0].front;
  const backs = pairs.filter((p) => p.front.key === front.key);
  if (backs.length === 0) {
    return undefined;
  }
  const step = scale(
    backs.reduce((acc, p) => add(acc, p.step), vec(0, 0)),
    1 / backs.length
  );
  const layers = [...backs.map((p) => p.back.key), front.key];
  return { layers, step };
}

function detectLattice(frame: Frame): Lattice | undefined {
  const marks = frame.parts.filter((part) => {
    const fit = circleFit(part);
    const small = part.dot || (fit !== null && fit.r <= frame.tol.small);
    return small && (part.closed || part.dot);
  });
  if (marks.length < 4) {
    return undefined;
  }
  const seed = marks[0];
  const congruent = marks.filter((part) =>
    congruentBy(part, seed, frame.tol.join)
  );
  if (congruent.length < 4) {
    return undefined;
  }
  const xs = [...new Set(congruent.map((p) => Math.round(p.centroid.x)))].sort(
    (a, b) => a - b
  );
  const ys = [...new Set(congruent.map((p) => Math.round(p.centroid.y)))].sort(
    (a, b) => a - b
  );
  if (xs.length < 2 || ys.length < 2) {
    return undefined;
  }
  const ordered = [...congruent].sort(
    (a, b) => a.centroid.y - b.centroid.y || a.centroid.x - b.centroid.x
  );
  return {
    marks: ordered.map((part) => part.key),
    rows: ys.length,
    cols: xs.length,
  };
}

function topEdge(part: Part): { y: number; minX: number; maxX: number } {
  return { y: part.bbox.minY, minX: part.bbox.minX, maxX: part.bbox.maxX };
}

function detectShackle(frame: Frame): Shackle | undefined {
  const bodies = closedParts(frame).filter((part) => aspectOf(part) >= 1.1);
  for (const body of bodies) {
    const edge = topEdge(body);
    for (const part of openParts(frame)) {
      const arc = part.arcs.find((a) => a.sweepDeg >= 150 && a.sweepDeg <= 210);
      if (!(arc && part.ends)) {
        continue;
      }
      const onEdge = (p: Vec) =>
        Math.abs(p.y - edge.y) <= frame.tol.join &&
        p.x >= edge.minX - frame.tol.join &&
        p.x <= edge.maxX + frame.tol.join;
      const hits = [
        onEdge(part.ends.start.at),
        onEdge(part.ends.end.at),
      ].filter(Boolean).length;
      if (hits === 0) {
        continue;
      }
      return {
        body: body.key,
        shackle: part.key,
        endsOnBody: hits === 2 ? 2 : 1,
        startsOnBody: onEdge(part.ends.start.at),
      };
    }
  }
  return undefined;
}

function rimPoint(center: Vec, r: number, point: Vec, tol: number): boolean {
  return Math.abs(dist(point, center) - r) <= tol;
}

function loupeFromHandle(
  lens: Part,
  fit: { center: Vec; r: number },
  handle: Part,
  tol: number
): Loupe | null {
  if (handle.key === lens.key || !handle.ends) {
    return null;
  }
  const startOn = rimPoint(fit.center, fit.r, handle.ends.start.at, tol);
  const endOn = rimPoint(fit.center, fit.r, handle.ends.end.at, tol);
  if (!(startOn || endOn)) {
    return null;
  }
  const rim = startOn ? handle.ends.start.at : handle.ends.end.at;
  const grip = startOn ? handle.ends.end.at : handle.ends.start.at;
  if (dist(grip, fit.center) <= fit.r + tol) {
    return null;
  }
  if (polylinePasses(handle, fit.center, tol)) {
    return null;
  }
  const handleDir = unit(sub(grip, fit.center));
  const radial = unit(sub(rim, fit.center));
  if (dot(handleDir, radial) < Math.cos((15 * Math.PI) / 180)) {
    return null;
  }
  return {
    lens: lens.key,
    handle: handle.key,
    center: fit.center,
    r: fit.r,
    handleDir,
    grip,
  };
}

function detectLoupe(frame: Frame): Loupe | undefined {
  if (detectHands(frame)) {
    return undefined;
  }
  for (const lens of frame.parts) {
    const fit = circleFit(lens);
    if (!fit) {
      continue;
    }
    for (const handle of straightOpen(frame)) {
      const loupe = loupeFromHandle(lens, fit, handle, frame.tol.join);
      if (loupe) {
        return loupe;
      }
    }
  }
  return undefined;
}

function smallMarks(frame: Frame): Part[] {
  return frame.parts.filter(
    (part) =>
      part.dot ||
      part.length <= frame.tol.small ||
      boxWidth(part.bbox) <= frame.tol.small
  );
}

function mouthMood(part: Part): Face["mood"] {
  if (part.closed) {
    return "open";
  }
  if (part.arcs.length > 0) {
    const arc = part.arcs[0];
    const mouthY = part.centroid.y;
    if (arc.center.y + 0.2 < mouthY) {
      return "smile";
    }
    if (arc.center.y - 0.2 > mouthY) {
      return "frown";
    }
  }
  if (part.straightness > 0.95) {
    return "flat";
  }
  return "smile";
}

function detectFace(frame: Frame): Face | undefined {
  for (const outline of closedParts(frame)) {
    const fit = circleFit(outline);
    if (!fit) {
      continue;
    }
    const inner = frame.parts.filter(
      (part) =>
        part.key !== outline.key && encloses(outline, part, frame.tol.join)
    );
    const marks = inner.filter(
      (part) =>
        smallMarks(frame).includes(part) || part.length <= frame.tol.small
    );
    const upper = marks.filter(
      (part) => part.centroid.y < fit.center.y - frame.tol.join
    );
    let eyes: [Part, Part] | null = null;
    for (let i = 0; i < upper.length; i++) {
      for (let j = i + 1; j < upper.length; j++) {
        if (mirrorOf(upper[i], upper[j], fit.center.x, frame.tol.align)) {
          eyes = [upper[i], upper[j]];
        }
      }
    }
    if (!eyes) {
      continue;
    }
    const leftFirst =
      eyes[0].centroid.x <= eyes[1].centroid.x ? eyes : [eyes[1], eyes[0]];
    const mouth = inner.find((part) => {
      if (part.key === leftFirst[0].key || part.key === leftFirst[1].key) {
        return false;
      }
      return (
        part.centroid.y > fit.center.y &&
        Math.abs(part.centroid.x - fit.center.x) <= frame.tol.align
      );
    });
    if (!mouth) {
      continue;
    }
    const brows = upper.filter(
      (part) =>
        part.key !== leftFirst[0].key &&
        part.key !== leftFirst[1].key &&
        part.centroid.y < leftFirst[0].centroid.y
    );
    return {
      outline: outline.key,
      eyes: [leftFirst[0].key, leftFirst[1].key],
      eyeCenters: [leftFirst[0].centroid, leftFirst[1].centroid],
      mouth: mouth.key,
      mouthCenter: mouth.centroid,
      mood: mouthMood(mouth),
      brows: brows.map((part) => part.key),
    };
  }
  return undefined;
}

function dialOf(
  frame: Frame
): { part: Part; center: Vec; r: number } | undefined {
  for (const part of frame.parts) {
    const fit = circleFit(part);
    if (fit) {
      return { part, center: fit.center, r: fit.r };
    }
    const wide = part.arcs.find((arc) => arc.sweepDeg >= 270);
    if (wide) {
      return { part, center: wide.center, r: wide.r };
    }
  }
  return undefined;
}

function detectHands(frame: Frame): Hands | undefined {
  const dial = dialOf(frame);
  if (!dial) {
    return undefined;
  }
  const maxLen = 0.8 * 2 * dial.r;
  const hands = openParts(frame).filter((part) => {
    if (part.key === dial.part.key || part.length >= maxLen) {
      return false;
    }
    if (!polylinePasses(part, dial.center, frame.tol.join)) {
      return false;
    }
    const nearPivot = (p: Vec) => dist(p, dial.center) <= frame.tol.align;
    const anchored =
      part.vertices.some((vertex) => nearPivot(vertex.at)) ||
      Boolean(
        part.ends &&
          (nearPivot(part.ends.start.at) || nearPivot(part.ends.end.at))
      );
    if (!anchored) {
      return false;
    }
    const farthest = Math.max(
      ...part.runs.flatMap((run) => run.points.map((p) => dist(p, dial.center)))
    );
    return farthest <= dial.r + frame.tol.join;
  });
  if (hands.length === 0) {
    return undefined;
  }
  return {
    pivot: dial.center,
    hands: hands.map((part) => part.key),
    dial: dial.part.key,
  };
}

function widthAt(part: Part, y: number, band: number): number {
  const pts = samplesOf(part, 1).filter((p) => Math.abs(p.y - y) <= band);
  if (pts.length < 2) {
    return boxWidth(part.bbox);
  }
  return Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
}

function taperOf(part: Part): number {
  const h = boxHeight(part.bbox);
  const band = Math.max(0.08 * h, 0.4);
  const top = widthAt(part, part.bbox.minY + 0.25 * h, band);
  const bot = widthAt(part, part.bbox.minY + 0.75 * h, band);
  return bot < 1e-6 ? 1 : top / bot;
}

function bilateralOf(part: Part, axisX: number, size: number): number {
  const pts = samplesOf(part, 1);
  if (pts.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const p of pts) {
    const mirrored = vec(2 * axisX - p.x, p.y);
    let best = Number.POSITIVE_INFINITY;
    for (const q of pts) {
      best = Math.min(best, dist(mirrored, q));
    }
    sum += best;
  }
  return Math.max(0, Math.min(1, 1 - sum / pts.length / (0.12 * size)));
}

function lobeCount(part: Part, centroid: Vec): number {
  const n = 72;
  const radii: number[] = [];
  const pts = samplesOf(part, 1);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 2 * Math.PI;
    const dir = vec(Math.cos(ang), Math.sin(ang));
    let best = 0;
    for (const p of pts) {
      const d = sub(p, centroid);
      if (dot(unit(d), dir) > 0.92) {
        best = Math.max(best, len(d));
      }
    }
    radii.push(best);
  }
  const mean = radii.reduce((s, v) => s + v, 0) / n;
  let peaks = 0;
  for (let i = 0; i < n; i++) {
    const prev = radii[(i + n - 1) % n];
    const next = radii[(i + 1) % n];
    if (radii[i] > prev && radii[i] >= next && radii[i] > mean * 1.04) {
      peaks++;
    }
  }
  return peaks >= 2 ? peaks : 1;
}

function hangPointOf(part: Part, axisX: number, tol: number): Vec {
  const pts = samplesOf(part, 1).filter(
    (p) => Math.abs(p.x - axisX) <= tol * 2
  );
  if (pts.length === 0) {
    return vec(axisX, part.bbox.minY);
  }
  return pts.reduce((best, p) => (p.y < best.y ? p : best), pts[0]);
}

function detectSilhouette(frame: Frame): Silhouette | undefined {
  const contentArea = boxArea(frame.content);
  const body = [...closedParts(frame)].sort((a, b) => b.area - a.area)[0];
  if (!body || boxArea(body.bbox) < 0.4 * contentArea) {
    return undefined;
  }
  const axisX = body.centroid.x;
  const compactness =
    body.length > 1e-6
      ? (4 * Math.PI * body.area) / (body.length * body.length)
      : 0;
  const innerHub = closedParts(frame).find((part) => {
    if (part.key === body.key) {
      return false;
    }
    const fit = circleFit(part);
    return Boolean(fit && encloses(body, part, frame.tol.join));
  });
  const lobes = Math.max(lobeCount(body, body.centroid), innerHub ? 6 : 1);
  const pendant =
    frame.parts.find((part) => {
      if (part.key === body.key) {
        return false;
      }
      const below = part.bbox.minY >= body.bbox.maxY - frame.tol.join;
      const onAxis = Math.abs(part.centroid.x - axisX) <= frame.tol.align;
      return below && onAxis && part.length < body.length;
    }) ?? null;
  const outside = frame.parts.filter(
    (part) =>
      part.key !== body.key &&
      part.key !== pendant?.key &&
      !encloses(body, part, frame.tol.join)
  );
  const flankers: PartKey[] = [];
  for (let i = 0; i < outside.length; i++) {
    for (let j = i + 1; j < outside.length; j++) {
      if (mirrorOf(outside[i], outside[j], axisX, frame.tol.align)) {
        flankers.push(outside[i].key, outside[j].key);
      }
    }
  }
  return {
    body: body.key,
    centroid: body.centroid,
    bilateral: bilateralOf(body, axisX, frame.size),
    taper: taperOf(body),
    lobes,
    hangPoint: hangPointOf(body, axisX, frame.tol.join),
    pendant: pendant?.key ?? null,
    flankers: [...new Set(flankers)],
    compactness,
  };
}

function detectCross(frame: Frame): Cross | undefined {
  const arms = straightOpen(frame).filter(
    (part) => part.length >= frame.tol.small
  );
  for (let i = 0; i < arms.length; i++) {
    for (let j = i + 1; j < arms.length; j++) {
      if (!perpendicular(arms[i].axis, arms[j].axis, 5)) {
        continue;
      }
      const a = partMid(arms[i]);
      const b = partMid(arms[j]);
      if (dist(a, b) <= frame.tol.join) {
        return {
          center: scale(add(a, b), 0.5),
          arms: [arms[i].key, arms[j].key],
        };
      }
    }
  }
  return undefined;
}

const DETECTORS: {
  readonly [K in FeatureName]-?: (f: Frame) => FeatureSet[K];
} = {
  arrows: detectArrows,
  checks: detectChecks,
  radial: detectRadial,
  concentric: detectConcentric,
  bars: detectBars,
  gauge: detectGauge,
  corners: detectCorners,
  stack: detectStack,
  lattice: detectLattice,
  shackle: detectShackle,
  loupe: detectLoupe,
  face: detectFace,
  hands: detectHands,
  silhouette: detectSilhouette,
  cross: detectCross,
};

export function detectFeatures(frame: Frame): FeatureSet {
  return {
    arrows: DETECTORS.arrows(frame),
    checks: DETECTORS.checks(frame),
    radial: DETECTORS.radial(frame),
    concentric: DETECTORS.concentric(frame),
    bars: DETECTORS.bars(frame),
    gauge: DETECTORS.gauge(frame),
    corners: DETECTORS.corners(frame),
    stack: DETECTORS.stack(frame),
    lattice: DETECTORS.lattice(frame),
    shackle: DETECTORS.shackle(frame),
    loupe: DETECTORS.loupe(frame),
    face: DETECTORS.face(frame),
    hands: DETECTORS.hands(frame),
    silhouette: DETECTORS.silhouette(frame),
    cross: DETECTORS.cross(frame),
  };
}

function describeArrows(arrows: readonly Arrow[]): string {
  const dirs = arrows.map((a) => a.dir);
  const net = dirs.reduce((acc, d) => add(acc, d), vec(0, 0));
  return `${arrows.length} chevron${arrows.length === 1 ? "" : "s"} pointing ${fmtVec(unit(net) || vec(0, -1))}; apex ${fmtVec(arrows[0].tip)}`;
}

function describeChecks(checks: readonly CheckMark[]): string {
  const mark = checks[0];
  return `${checks.length} check mark${checks.length === 1 ? "" : "s"} bent at ${fmtVec(mark.vertex)}, leg ratio ${fmt(mark.legRatio)}${mark.reversed ? ", path starts on the long leg" : ""}`;
}

function describeRadial(radial: Radial): string {
  return `${radial.rays.length} rays around ${fmtVec(radial.center)} at ${fmt(radial.stepDeg)}° steps${radial.attached ? ", attached to a hub" : ", detached"}`;
}

function describeConcentric(c: Concentric): string {
  const radii = c.arcs.map((a) => fmt(a.r)).join("/");
  return `${c.arcs.length} open arcs share center ${fmtVec(c.center)} at radii ${radii}${c.anchor ? "; a dot sits at the center" : ""}`;
}

function describeBars(bars: Bars): string {
  return `${bars.bars.length} parallel bars${bars.sharedBaseline ? " on a shared baseline" : ""}${bars.monotonic ? ", lengths rise" : ""}${bars.cell ? " inside a cell" : ""}`;
}

function describeGauge(g: Gauge): string {
  return `closed cell with a terminal nub; fill grows toward ${fmtVec(g.fillDir)}`;
}

function describeCorners(c: Corners): string {
  return `four corner marks facing ${c.facing}, vertices around ${fmtVec(c.center)}`;
}

function describeStack(s: Stack): string {
  return `${s.layers.length} stacked sheets offset by ${fmtVec(s.step)}`;
}

function describeLattice(l: Lattice): string {
  return `${l.marks.length} marks on a ${l.rows}×${l.cols} lattice`;
}

function describeShackle(s: Shackle): string {
  return `U-stroke ${s.endsOnBody === 2 ? "locked onto" : "leaving"} the body's top edge`;
}

function describeLoupe(l: Loupe): string {
  return `handle leaves the r${fmt(l.r)} lens radially at ${fmtVec(l.grip)}`;
}

function describeFace(f: Face): string {
  return `two mirrored marks and a ${f.mood} mouth inside the outline`;
}

function describeHands(h: Hands): string {
  return `${h.hands.length} hand${h.hands.length === 1 ? "" : "s"} pivot at ${fmtVec(h.pivot)}`;
}

function describeSilhouette(s: Silhouette): string {
  return `closed body${s.taper < 0.8 ? " tapering toward the top" : ""}${s.pendant ? " with a pendant" : ""}${s.flankers.length ? " and ringing marks" : ""}`;
}

function describeCross(c: Cross): string {
  return `two arms cross at ${fmtVec(c.center)}`;
}

export function describe(features: FeatureSet, _frame: Frame): string[] {
  const facts: string[] = [];
  if (features.arrows.length) {
    facts.push(describeArrows(features.arrows));
  }
  if (features.checks.length) {
    facts.push(describeChecks(features.checks));
  }
  if (features.radial) {
    facts.push(describeRadial(features.radial));
  }
  if (features.concentric) {
    facts.push(describeConcentric(features.concentric));
  }
  if (features.bars) {
    facts.push(describeBars(features.bars));
  }
  if (features.gauge) {
    facts.push(describeGauge(features.gauge));
  }
  if (features.corners) {
    facts.push(describeCorners(features.corners));
  }
  if (features.stack) {
    facts.push(describeStack(features.stack));
  }
  if (features.lattice) {
    facts.push(describeLattice(features.lattice));
  }
  if (features.shackle) {
    facts.push(describeShackle(features.shackle));
  }
  if (features.loupe) {
    facts.push(describeLoupe(features.loupe));
  }
  if (features.face) {
    facts.push(describeFace(features.face));
  }
  if (features.hands) {
    facts.push(describeHands(features.hands));
  }
  if (features.silhouette) {
    facts.push(describeSilhouette(features.silhouette));
  }
  if (features.cross) {
    facts.push(describeCross(features.cross));
  }
  return facts;
}

function optionalKey(key: PartKey | null | undefined): PartKey[] {
  return key ? [key] : [];
}

const KEY_OF: { readonly [K in FeatureName]: (f: FeatureSet) => string[] } = {
  arrows: (f) =>
    f.arrows.flatMap((a) => [
      a.head,
      ...optionalKey(a.shaft),
      ...optionalKey(a.base),
    ]),
  checks: (f) => f.checks.map((c) => c.key),
  radial: (f) =>
    f.radial ? [...f.radial.rays, ...optionalKey(f.radial.hub)] : [],
  concentric: (f) =>
    f.concentric
      ? [
          ...f.concentric.arcs.map((a) => a.key),
          ...optionalKey(f.concentric.anchor),
        ]
      : [],
  bars: (f) => (f.bars ? [...f.bars.bars, ...optionalKey(f.bars.cell)] : []),
  gauge: (f) => (f.gauge ? [f.gauge.cell, f.gauge.terminal] : []),
  corners: (f) => f.corners?.corners.flatMap((c) => [...c.keys]) ?? [],
  stack: (f) => (f.stack ? [...f.stack.layers] : []),
  lattice: (f) => (f.lattice ? [...f.lattice.marks] : []),
  shackle: (f) => (f.shackle ? [f.shackle.body, f.shackle.shackle] : []),
  loupe: (f) => (f.loupe ? [f.loupe.lens, f.loupe.handle] : []),
  face: (f) =>
    f.face
      ? [f.face.outline, ...f.face.eyes, f.face.mouth, ...f.face.brows]
      : [],
  hands: (f) => (f.hands ? [f.hands.dial, ...f.hands.hands] : []),
  silhouette: (f) =>
    f.silhouette
      ? [
          f.silhouette.body,
          ...optionalKey(f.silhouette.pendant),
          ...f.silhouette.flankers,
        ]
      : [],
  cross: (f) => (f.cross ? [...f.cross.arms] : []),
};

export function boundKeys(features: FeatureSet): Record<string, string[]> {
  const keys: Record<string, string[]> = {};
  for (const name of Object.keys(KEY_OF) as FeatureName[]) {
    const bound = KEY_OF[name](features);
    if (bound.length) {
      keys[name] = bound;
    }
  }
  return keys;
}

export function summarize(frame: Frame, features: FeatureSet): string {
  const w = fmt(boxWidth(frame.viewBox));
  const h = fmt(boxHeight(frame.viewBox));
  const names = Object.keys(boundKeys(features));
  const extra = names.length ? names.join(" + ") : "no structure";
  return `${frame.parts.length} parts · ${w}×${h} · ${extra}`;
}

export { byKey, partMap };
