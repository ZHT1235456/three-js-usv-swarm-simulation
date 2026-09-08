import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  plan,
  clear,
  valid,
  route,
  makeRun,
  tick,
  reference,
  truth,
} from "../src/simulation.js";
import {
  avoidBoats,
  BOAT_SEPARATION,
  sweptSeparation,
} from "../src/avoidance.js";
import { smoothBezier, segmentDistance } from "../src/paths.js";

test("Bezier corners remain tangent, preserve endpoints and shrink away from obstacles", () => {
  const path = [
    { x: -100, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 100 },
  ];
  const obstacle = { x: -20, y: 20 };
  const safe = (a, b) => segmentDistance(obstacle, a, b) > 15;
  const smooth = smoothBezier(path, safe);
  assert.deepEqual(smooth[0], path[0]);
  assert.deepEqual(smooth.at(-1), path.at(-1));
  assert.ok(smooth.length > 10);
  assert.ok(!smooth.some((p) => p.x === 0 && p.y === 0));
  assert.equal(smooth[1].y, 0);
  assert.equal(smooth.at(-2).x, 0);
  for (let i = 1; i < smooth.length; i++)
    assert.ok(safe(smooth[i - 1], smooth[i]));
  assert.ok(
    smooth[1].x > smoothBezier(path, () => true)[1].x,
    "unsafe wide fillet must shrink",
  );
});

test("island clearance checks the entire segment between samples", () => {
  assert.equal(
    clear(
      { x: -100, y: 15.99 },
      { x: 100, y: 15.99 },
      { islands: [{ x: 2.5, y: 0, r: 0 }] },
    ),
    false,
  );
});

test("default formation corridors remain at least 70 m apart after Bezier smoothing", () => {
  const s = defaults();
  const cross = (a, b, p) =>
    (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  for (const kind of ["short", "coverage"]) {
    const { paths } = plan(s, kind);
    for (let i = 0; i < paths.length; i++)
      for (let j = i + 1; j < paths.length; j++) {
        if (s.boats[i].team === s.boats[j].team) continue;
        for (let u = 1; u < paths[i].length; u++)
          for (let v = 1; v < paths[j].length; v++) {
            const a = paths[i][u - 1],
              b = paths[i][u],
              c = paths[j][v - 1],
              d = paths[j][v];
            const dx = Math.max(
              0,
              Math.min(a.x, b.x) - Math.max(c.x, d.x),
              Math.min(c.x, d.x) - Math.max(a.x, b.x),
            );
            const dy = Math.max(
              0,
              Math.min(a.y, b.y) - Math.max(c.y, d.y),
              Math.min(c.y, d.y) - Math.max(a.y, b.y),
            );
            if (Math.hypot(dx, dy) >= 70) continue;
            const crossing =
              cross(a, b, c) * cross(a, b, d) < 0 &&
              cross(c, d, a) * cross(c, d, b) < 0;
            const gap = crossing
              ? 0
              : Math.min(
                  segmentDistance(a, c, d),
                  segmentDistance(b, c, d),
                  segmentDistance(c, a, b),
                  segmentDistance(d, a, b),
                );
            assert.ok(
              gap >= 70,
              `${kind}: boats ${i + 1}/${j + 1}, corridor gap ${gap}`,
            );
          }
      }
  }
});
test("both planners produce 30 safe routes ending at assigned goals", () => {
  const s = defaults();
  for (const kind of ["short", "coverage"]) {
    const p = plan(s, kind);
    assert.equal(p.paths.length, 30);
    assert.ok(p.area > 0 && p.ratio <= 1);
    for (let i = 0; i < 30; i++) {
      const path = p.paths[i];
      assert.deepEqual(path.at(-1), p.goals[i]);
      assert.ok(
        Math.hypot(
          p.goals[i].x - s.targets[Math.floor(i / 10)].x,
          p.goals[i].y - s.targets[Math.floor(i / 10)].y,
        ) < 110,
      );
      for (let j = 0; j < i; j++)
        assert.ok(
          Math.hypot(
            p.goals[i].x - p.goals[j].x,
            p.goals[i].y - p.goals[j].y,
          ) >= 25,
        );
      for (let j = 1; j < path.length; j++)
        assert.ok(clear(path[j - 1], path[j], s));
    }
  }
});
test("obstructed direct segment is rerouted; unsafe endpoints rejected", () => {
  const s = defaults(),
    a = { x: -300, y: 45 },
    b = { x: -40, y: 45 };
  assert.ok(!clear(a, b, s));
  assert.ok(route(a, b, s).length > 2);
  assert.throws(() => route(s.islands[0], b, s));
  assert.equal(valid({ x: 610, y: 0 }, s), false);
});
test("reference stops at destination", () => {
  assert.deepEqual(
    reference(
      [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
      ],
      2,
    ),
    { x: 6, y: 0, vx: 0, vy: 0 },
  );
});
test("both controllers finish both default missions without entering land", () => {
  const s = defaults();
  for (const k of ["short", "coverage"]) {
    const p = plan(s, k);
    for (const c of ["ppc", "pd"]) {
      const r = makeRun(s, p, c);
      for (let i = 0; i < 5000 && !r.done; i++) {
        tick(r, s, 0.05);
        assert.ok(r.boats.every((b) => valid(b, s)));
        assert.ok(
          r.minSeparation >= BOAT_SEPARATION - 1e-6,
          `${k}/${c} separation ${r.minSeparation}`,
        );
      }
      assert.ok(r.done, `${k}/${c} must finish`);
    }
  }
});
test("reciprocal avoidance prevents continuous head-on collision", () => {
  let p = [
      { x: -25, y: 0 },
      { x: 25, y: 0 },
    ],
    min = Infinity,
    interventions = 0;
  for (let i = 0; i < 200; i++) {
    const proposed = [
        { x: p[0].x + 0.3, y: p[0].y },
        { x: p[1].x - 0.3, y: p[1].y },
      ],
      result = avoidBoats(p, proposed, 0.05, () => true);
    min = Math.min(
      min,
      sweptSeparation(p[0], result.positions[0], p[1], result.positions[1]),
    );
    interventions += result.interventions;
    p = result.positions;
  }
  assert.ok(min >= BOAT_SEPARATION - 1e-6);
  assert.ok(interventions > 0);
  assert.ok(p[0].x > p[1].x, "vessels should pass one another");
});
test("independent deterministic runs, valid observations, finite Kalman estimates", () => {
  const s = defaults(),
    p = plan(s, "short"),
    a = makeRun(s, p, "ppc"),
    b = makeRun(s, p, "ppc"),
    pd = makeRun(s, p, "pd");
  let observations = 0;
  for (let i = 0; i < 800; i++) {
    tick(a, s, 0.05);
    tick(b, s, 0.05);
    tick(pd, s, 0.05);
    for (const o of a.observations) {
      observations++;
      assert.ok(o.z < 0);
      assert.ok(Number.isFinite(o.error));
    }
    assert.ok(a.boats.every((q) => valid(q, s)));
  }
  assert.ok(observations > 0);
  assert.deepEqual(a, b);
  assert.notEqual(a.rms, pd.rms);
  assert.ok(a.filters.some((f) => f && f.p > 0));
  assert.ok(truth(0, 1).z < 0);
});
