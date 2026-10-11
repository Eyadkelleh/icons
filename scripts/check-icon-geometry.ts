import { measureFrame, parseSvg } from "../lib/icon-reading";

const WRAP = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${body}</svg>`;

const ICONS: Record<string, string> = {
  wifi: WRAP(
    '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>'
  ),
  check: WRAP('<path d="M20 6 9 17l-5-5"/>'),
  clock: WRAP('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  bell: WRAP(
    '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>'
  ),
};

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

let ok = true;
let slowest = 0;

const check = (label: string, pass: boolean, detail: string) => {
  console.log(`${pass ? "PASS" : "FAIL"} ${label} ${detail}`);
  ok &&= pass;
};

for (const [name, markup] of Object.entries(ICONS)) {
  const start = performance.now();
  const tree = parseSvg(markup);
  const frame = measureFrame(tree);
  slowest = Math.max(slowest, performance.now() - start);
  const parts = frame.parts;

  if (name === "wifi") {
    const arcs = parts.flatMap((p) => p.arcs);
    check(
      "wifi has 3 open arcs",
      arcs.length === 3,
      `arcs=${arcs.length} parts=${parts.length}`
    );
    const centers = arcs.map((a) => a.center);
    const cx = centers.reduce((s, c) => s + c.x, 0) / centers.length;
    const cy = centers.reduce((s, c) => s + c.y, 0) / centers.length;
    check(
      "wifi arc centers cluster at (12, 20)",
      near(cx, 12, 0.6) && near(cy, 20, 0.6),
      `center=(${cx.toFixed(2)}, ${cy.toFixed(2)}) r=${arcs.map((a) => a.r.toFixed(1)).join(",")}`
    );
    check(
      "wifi has a center dot",
      parts.some((p) => p.dot),
      `dots=${parts.filter((p) => p.dot).length}`
    );
  }

  if (name === "check") {
    const verts = parts.flatMap((p) => p.vertices);
    check("check has one vertex", verts.length === 1, `n=${verts.length}`);
    if (verts[0]) {
      check(
        "check vertex at (9, 17)",
        near(verts[0].at.x, 9, 0.3) && near(verts[0].at.y, 17, 0.3),
        `(${verts[0].at.x.toFixed(2)}, ${verts[0].at.y.toFixed(2)}) interior=${verts[0].interiorDeg.toFixed(1)}`
      );
    }
  }

  if (name === "clock") {
    const hand = parts.find((p) => !p.closed);
    const verts = hand?.vertices ?? [];
    check(
      "clock hand bends at (12, 12)",
      Boolean(
        hand &&
          verts.some((v) => near(v.at.x, 12, 0.3) && near(v.at.y, 12, 0.3))
      ),
      `verts=${verts.map((v) => `(${v.at.x.toFixed(1)},${v.at.y.toFixed(1)})`).join(" ")}`
    );
  }

  if (name === "bell") {
    const body = parts.find((p) => p.closed);
    check(
      "bell body is closed without Z",
      Boolean(body?.closed),
      `closed=${parts.map((p) => `${p.key}:${p.closed}`).join(",")}`
    );
  }
}

check(
  "every icon reads in < 50 ms",
  slowest <= 50,
  `slowest_ms=${slowest.toFixed(2)}`
);
console.log(`slowest_ms=${slowest.toFixed(2)}`);
process.exit(ok ? 0 : 1);
