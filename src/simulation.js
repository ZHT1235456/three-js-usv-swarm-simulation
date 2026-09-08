import {
  segmentDistance,
  smoothBezier,
  reservationCost,
  corridorNodes,
} from "./paths.js";
export const RADIUS = 600,
  COLORS = ["#41d8e8", "#ac9aff", "#ffbd71"];
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function defaults() {
  return {
    radius: 95,
    boats: Array.from({ length: 30 }, (_, i) => ({
      id: i,
      team: Math.floor(i / 10),
      x: -240 + Math.floor(i / 10) * 240 + ((i % 5) - 2) * 24,
      y: -340 - Math.floor((i % 10) / 5) * 35,
    })),
    targets: [
      { x: -310, y: 310 },
      { x: 0, y: 400 },
      { x: 315, y: 270 },
    ],
    islands: [
      { x: -170, y: 45, r: 83, aspect: 0.43, angle: 0.55 },
      { x: 135, y: 100, r: 95, aspect: 0.62, angle: -0.5 },
      { x: 0, y: -160, r: 48 },
      { x: 360, y: -90, r: 43 },
    ],
  };
}
export function valid(p, s, margin = 16) {
  return (
    Math.hypot(p.x, p.y) < RADIUS - margin &&
    s.islands.every((o) => distance(p, o) > o.r + margin)
  );
}
export function clear(a, b, s) {
  return (
    valid(a, s) &&
    valid(b, s) &&
    s.islands.every((o) => segmentDistance(o, a, b) > o.r + 16)
  );
}
// Visibility graph with conservative polygonal obstacle envelopes; Dijkstra shortest path.
export function route(a, b, s, cost = null) {
  if (!valid(a, s) || !valid(b, s))
    throw Error("起点或目标位于岛屿安全区或海域边界外，请调整位置。");
  if (clear(a, b, s) && (!cost || cost(a, b) <= distance(a, b) + 0.01))
    return [a, b];
  const nodes = [
    a,
    b,
    ...(cost ? corridorNodes(a, b).filter((p) => valid(p, s)) : []),
  ];
  for (const o of s.islands)
    for (let k = 0; k < 20; k++) {
      const t = (k * Math.PI) / 10,
        p = {
          x: o.x + (o.r + 23) * Math.cos(t),
          y: o.y + (o.r + 23) * Math.sin(t),
        };
      if (valid(p, s)) nodes.push(p);
    }
  const d = nodes.map(() => Infinity),
    prev = [],
    seen = new Set();
  d[0] = 0;
  while (seen.size < nodes.length) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!seen.has(i) && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0 || !Number.isFinite(d[u])) break;
    if (u === 1) {
      const path = [];
      for (let j = 1; j !== undefined; j = prev[j])
        path.unshift({ ...nodes[j] });
      return path;
    }
    seen.add(u);
    for (let v = 0; v < nodes.length; v++)
      if (!seen.has(v)) {
        if (
          d[u] + distance(nodes[u], nodes[v]) >= d[v] ||
          !clear(nodes[u], nodes[v], s)
        )
          continue;
        const nd =
          d[u] +
          (cost ? cost(nodes[u], nodes[v]) : distance(nodes[u], nodes[v]));
        if (nd < d[v]) {
          d[v] = nd;
          prev[v] = u;
        }
      }
  }
  throw Error("没有找到安全航路，请移动目标或岛屿后重新规划。");
}
export function plan(s, kind) {
  const start = performance.now();
  const goals = [];
  for (const b of s.boats) {
    const center = s.targets[b.team],
      slot = b.id % 10;
    let goal = {
      x: center.x + ((slot % 5) - 2) * 25,
      y: center.y + (0.5 - Math.floor(slot / 5)) * 28,
    };
    if (!valid(goal, s) || goals.some((g) => distance(g, goal) < 25)) {
      let found = false;
      for (let k = 0; k < 200; k++) {
        const a = k * 2.3999,
          r = 20 + Math.sqrt(k) * 6,
          p = { x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r };
        if (valid(p, s) && goals.every((g) => distance(g, p) >= 25)) {
          goal = p;
          found = true;
          break;
        }
      }
      if (!found) throw Error("目标区没有足够的安全编队位置，请分散目标。");
    }
    goals.push(goal);
  }
  const makePath = (b, i, cost = null) => {
    const target = goals[i];
    // Vary conservative envelopes per vessel to avoid reusing the same obstacle vertices.
    const laneScene = {
      ...s,
      islands: s.islands.map((o) => ({
        ...o,
        r: o.r + (i % 5) * 8 + Math.floor((i % 10) / 5) * 3,
      })),
    };
    const routeScene =
      valid(b, laneScene) && valid(target, laneScene) ? laneScene : s;
    const finish = (path) =>
      smoothBezier(path, (a, b) => clear(a, b, routeScene));
    if (kind === "short") return finish(route(b, target, routeScene, cost));
    const spread = ((i % 5) - 2) * 45;
    let mid = {
      x: target.x * 0.55 + b.x * 0.45 + spread,
      y: 40 + (0.5 - Math.floor((i % 10) / 5)) * 30,
    };
    if (!valid(mid, s)) {
      let found = false;
      for (let j = 1; j < 25; j++) {
        const p = { x: mid.x, y: mid.y + j * 15 };
        if (valid(p, s)) {
          mid = p;
          found = true;
          break;
        }
      }
      if (!found) return finish(route(b, target, routeScene, cost));
    }
    if (cost) {
      const desired = mid;
      let best = Infinity;
      for (const dx of [-100, -75, -50, -25, 0, 25, 50, 75, 100])
        for (const dy of [-30, 0, 30]) {
          const candidate = { x: desired.x + dx, y: desired.y + dy };
          if (!valid(candidate, routeScene)) continue;
          const score =
            distance(candidate, desired) +
            160 * (cost(candidate, { x: candidate.x + 1, y: candidate.y }) - 1);
          if (score < best) {
            best = score;
            mid = candidate;
          }
        }
    }
    const midScene = valid(mid, routeScene) ? routeScene : s;
    return smoothBezier(
      [
        ...route(b, mid, midScene, cost).slice(0, -1),
        ...route(mid, target, midScene, cost),
      ],
      (a, b) => clear(a, b, midScene),
    );
  };
  const paths = s.boats.map((b, i) => makePath(b, i));
  // Each formation reserves its current corridor while its neighbours replan.
  // Two sweeps reduce dependence on which formation was planned first.
  for (const order of [
    [1, 0, 2],
    [2, 0, 1],
  ])
    for (const team of order) {
      const cost = reservationCost(
        paths.filter((_, i) => s.boats[i].team !== team),
      );
      for (let i = 0; i < s.boats.length; i++)
        if (s.boats[i].team === team) paths[i] = makePath(s.boats[i], i, cost);
    }
  const length = paths.reduce(
    (sum, p) => sum + p.slice(1).reduce((n, q, i) => n + distance(p[i], q), 0),
    0,
  );
  const samples = [];
  paths.forEach((p) =>
    p.slice(1).forEach((q, i) => {
      const a = p[i],
        n = Math.ceil(distance(a, q) / 20);
      for (let k = 0; k <= n; k++)
        samples.push({
          x: a.x + ((q.x - a.x) * k) / n,
          y: a.y + ((q.y - a.y) * k) / n,
        });
    }),
  );
  let covered = 0,
    total = 0;
  for (let x = -590; x < 600; x += 20)
    for (let y = -590; y < 600; y += 20) {
      const p = { x, y };
      if (!valid(p, s, 0)) continue;
      total++;
      if (samples.some((q) => distance(p, q) <= s.radius)) covered++;
    }
  return {
    kind,
    paths,
    goals,
    length,
    area: covered * 400,
    ratio: covered / total,
    time: performance.now() - start,
  };
}
export function reference(path, t) {
  let remain = t * 6;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      l = distance(a, b);
    if (remain < l)
      return {
        x: a.x + ((b.x - a.x) * remain) / l,
        y: a.y + ((b.y - a.y) * remain) / l,
        vx: ((b.x - a.x) * 6) / l,
        vy: ((b.y - a.y) * 6) / l,
      };
    remain -= l;
  }
  return { ...path.at(-1), vx: 0, vy: 0 };
}
export function makeRun(s, p, kind) {
  return {
    kind,
    time: 0,
    boats: s.boats.map((b) => ({ ...b, vx: 0, vy: 0, trail: [], error: 0 })),
    plan: p,
    filters: Array.from({ length: 4 }, () => null),
    observations: [],
    observationHistory: [],
    targets: [],
    history: [],
    rms: 0,
    single: null,
    fused: null,
    violations: 0,
    avoidanceCount: 0,
    minSeparation: Infinity,
    done: false,
  };
}
export function truth(i, t) {
  return {
    x: [-230, 50, 255, -70][i] + 18 * Math.sin(t * 0.013 + i),
    y: [-210, -60, 210, 250][i] + 12 * Math.cos(t * 0.017 + i),
    z: -[22, 36, 28, 45][i],
  };
}
function gaussian(seed) {
  const fract = (x) => x - Math.floor(x);
  const u = Math.max(1e-8, fract(Math.sin(seed * 12.9898) * 43758.5453)),
    v = fract(Math.sin((seed + 91) * 78.233) * 23421.631);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function tick(run, s, dt) {
  run.time += dt;
  const t = run.time,
    rho = 18 * Math.exp(-0.045 * t) + 1.5;
  const previous = run.boats.map((b) => ({ x: b.x, y: b.y }));
  for (const b of run.boats) {
    const ref = reference(run.plan.paths[b.id], t);
    const old = { x: b.x, y: b.y };
    for (const [axis, vel, feed] of [
      ["x", "vx", "vx"],
      ["y", "vy", "vy"],
    ]) {
      const e = b[axis] - ref[axis],
        drift = 0.38 * Math.sin(t * 0.19 + b.id * 0.6 + (axis === "y" ? 1 : 0));
      if (run.kind === "ppc") {
        const z = Math.max(-0.98, Math.min(0.98, e / rho));
        b[vel] = ref[feed] - 0.9 * rho * Math.atanh(z) + drift;
      } else {
        const key = "command" + vel;
        b[key] ??= 0;
        b[key] += dt * (0.8 * (ref[feed] - b[key]) - 0.35 * e + drift);
        b[key] = Math.max(-12, Math.min(12, b[key]));
        b[vel] = b[key];
      }
      b[axis] += Math.max(-12, Math.min(12, b[vel])) * dt;
    }
    if (!clear(old, b, s)) {
      b.x = old.x;
      b.y = old.y;
      b.vx = b.vy = 0;
      try {
        const waypoint = route(old, ref, s)[1],
          len = distance(old, waypoint);
        if (len > 0) {
          b.vx = ((waypoint.x - old.x) / len) * 6;
          b.vy = ((waypoint.y - old.y) / len) * 6;
          const safe = { x: old.x + b.vx * dt, y: old.y + b.vy * dt };
          if (clear(old, safe, s)) {
            b.x = safe.x;
            b.y = safe.y;
          }
        }
      } catch {}
    }
    if (b.recovery?.length) {
      while (b.recovery.length && distance(old, b.recovery[0]) < 4)
        b.recovery.shift();
      if (b.recovery.length) {
        const waypoint = b.recovery[0],
          l = distance(old, waypoint),
          p = {
            x: old.x + ((waypoint.x - old.x) / l) * Math.min(5 * dt, l),
            y: old.y + ((waypoint.y - old.y) / l) * Math.min(5 * dt, l),
          };
        if (clear(old, p, s)) {
          b.x = p.x;
          b.y = p.y;
          b.commandvx = (p.x - old.x) / dt;
          b.commandvy = (p.y - old.y) / dt;
        }
      }
    }
  }
  const avoidance = avoidBoats(previous, run.boats, dt, (a, b) =>
    clear(a, b, s),
  );
  run.avoidanceCount += avoidance.interventions;
  for (const b of run.boats) {
    const p = avoidance.positions[b.id],
      old = previous[b.id];
    b.x = p.x;
    b.y = p.y;
    b.vx = (p.x - old.x) / dt;
    b.vy = (p.y - old.y) / dt;
    const ref = reference(run.plan.paths[b.id], t);
    b.error = distance(b, ref);
    if (Math.floor(t / 5) !== Math.floor((t - dt) / 5)) {
      const goal = run.plan.paths[b.id].at(-1),
        goalDistance = distance(b, goal);
      if (
        t > 35 &&
        goalDistance > 8 &&
        b.checkpoint &&
        distance(b, b.checkpoint) < 4
      ) {
        const neighbors = run.boats
          .filter(
            (o) =>
              o.id !== b.id && distance(b, o) < 130 && distance(goal, o) > 22,
          )
          .map((o) => ({ x: o.x, y: o.y, r: 1 }));
        try {
          b.recovery = route(b, goal, {
            ...s,
            islands: [...s.islands, ...neighbors],
          }).slice(1);
          run.avoidanceCount++;
        } catch {}
      }
      b.checkpoint = { x: b.x, y: b.y };
    }
    if (
      run.kind === "ppc" &&
      Math.max(Math.abs(b.x - ref.x), Math.abs(b.y - ref.y)) > rho
    )
      run.violations++;
    if (Math.floor(t * 3) !== Math.floor((t - dt) * 3)) {
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 75) b.trail.shift();
    }
  }
  run.minSeparation = Infinity;
  for (let i = 0; i < 30; i++)
    for (let j = i + 1; j < 30; j++)
      run.minSeparation = Math.min(
        run.minSeparation,
        distance(run.boats[i], run.boats[j]),
      );
  run.rms = Math.sqrt(run.boats.reduce((a, b) => a + b.error ** 2, 0) / 30);
  run.done =
    run.plan.paths.every(
      (p) => reference(p, t).vx === 0 && reference(p, t).vy === 0,
    ) && run.boats.every((b) => b.error < 8);
  if (Math.floor(t * 2) === Math.floor((t - dt) * 2)) return;
  run.observations = [];
  run.targets = [];
  let singleSum = 0,
    fusedSum = 0,
    count = 0,
    fusedCount = 0;
  for (let i = 0; i < 4; i++) {
    const p = truth(i, t),
      obs = [];
    for (const b of run.boats) {
      const range = Math.hypot(b.x - p.x, b.y - p.y, p.z);
      if (range > s.radius) continue;
      const sigma = 2 + range * 0.035,
        seed = Math.floor(t * 2) * 1800 + b.id * 30 + i * 3;
      const q = {
        x: p.x + sigma * gaussian(seed + 1),
        y: p.y + sigma * gaussian(seed + 2),
        z: p.z + sigma * gaussian(seed + 3),
      };
      const error = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
      obs.push({ boat: b.id, target: i, ...q, error, variance: sigma ** 2 });
      singleSum += error;
      count++;
    }
    let f = run.filters[i];
    if (f) f.p += 1.5;
    for (const o of obs) {
      if (!f) f = { x: o.x, y: o.y, z: o.z, p: o.variance };
      else {
        const k = f.p / (f.p + o.variance);
        for (const axis of ["x", "y", "z"]) f[axis] += k * (o[axis] - f[axis]);
        f.p *= 1 - k;
      }
    }
    run.filters[i] = f;
    const error =
      f && obs.length ? Math.hypot(f.x - p.x, f.y - p.y, f.z - p.z) : null;
    if (error !== null) {
      fusedSum += error;
      fusedCount++;
    }
    run.targets.push({
      id: i,
      truth: p,
      estimate: f ? { ...f } : null,
      error,
      n: obs.length,
    });
    run.observations.push(...obs);
    run.observationHistory.push(...obs.map((o) => ({ ...o, time: t })));
  }
  if (run.observationHistory.length > 2000)
    run.observationHistory.splice(0, run.observationHistory.length - 2000);
  run.single = count ? singleSum / count : null;
  run.fused = fusedCount ? fusedSum / fusedCount : null;
  run.history.push({
    t,
    rms: run.rms,
    rho,
    single: run.single,
    fused: run.fused,
  });
  if (run.history.length > 600) run.history.shift();
}
import { avoidBoats, BOAT_SEPARATION } from "./avoidance.js";
