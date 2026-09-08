const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mix = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export function segmentDistance(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export function samplePath(path, spacing = 12) {
  const samples = [{ x: path[0].x, y: path[0].y }];
  for (let i = 1; i < path.length; i++) {
    const n = Math.max(1, Math.ceil(dist(path[i - 1], path[i]) / spacing));
    for (let j = 1; j <= n; j++) samples.push(mix(path[i - 1], path[i], j / n));
  }
  return samples;
}

export function cubicBezier(a, b, c, d, t) {
  const u = 1 - t;
  return {
    x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
    y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y,
  };
}

// Tangent cubic Bezier fillets. Shrink each corner until every navigation chord is safe.
// The returned samples are shared by the renderer, distance metrics and controller.
export function smoothBezier(path, isClear) {
  const out = [{ x: path[0].x, y: path[0].y }];
  const append = (p) => {
    if (dist(out.at(-1), p) > 1e-7) out.push({ x: p.x, y: p.y });
  };
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1],
      b = path[i],
      c = path[i + 1];
    const incoming = dist(a, b),
      outgoing = dist(b, c);
    if (incoming < 1e-6 || outgoing < 1e-6) continue;
    let radius = Math.min(55, incoming * 0.42, outgoing * 0.42),
      accepted = false;
    for (let attempt = 0; attempt < 16; attempt++, radius *= 0.55) {
      const p0 = mix(b, a, radius / incoming),
        p3 = mix(b, c, radius / outgoing);
      const p1 = mix(p0, b, 2 / 3),
        p2 = mix(p3, b, 2 / 3);
      const n = Math.max(8, Math.ceil((2 * radius) / 2));
      const points = Array.from({ length: n + 1 }, (_, j) =>
        cubicBezier(p0, p1, p2, p3, j / n),
      );
      if (
        isClear(out.at(-1), p0) &&
        points.every((p, j) => !j || isClear(points[j - 1], p)) &&
        isClear(p3, c)
      ) {
        points.forEach(append);
        accepted = true;
        break;
      }
    }
    if (!accepted) append(b);
  }
  append(path.at(-1));
  return out;
}

// Cached distance-field reservations: formations prefer 80 m of separation.
// Sampling adds half its interval to the cost radius to account for gaps between samples.
export function reservationCost(paths, gap = 80) {
  const cell = 10,
    extent = 620,
    width = 125,
    reach = gap + 8;
  const field = new Float32Array(width * width).fill(reach * reach);
  for (const path of paths)
    for (const p of samplePath(path, 16)) {
      const x0 = Math.max(0, Math.floor((p.x - reach + extent) / cell)),
        x1 = Math.min(width - 1, Math.ceil((p.x + reach + extent) / cell)),
        y0 = Math.max(0, Math.floor((p.y - reach + extent) / cell)),
        y1 = Math.min(width - 1, Math.ceil((p.y + reach + extent) / cell));
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const d2 =
            (x * cell - extent - p.x) ** 2 + (y * cell - extent - p.y) ** 2;
          const i = y * width + x;
          field[i] = Math.min(field[i], d2);
        }
    }
  for (let i = 0; i < field.length; i++)
    field[i] =
      10 * Math.max(0, 1 - Math.max(0, Math.sqrt(field[i]) - 8) / gap) ** 2;
  const proximity = (p) => {
    const x = Math.max(0, Math.min(width - 1.001, (p.x + extent) / cell)),
      y = Math.max(0, Math.min(width - 1.001, (p.y + extent) / cell));
    const ix = Math.floor(x),
      iy = Math.floor(y),
      tx = x - ix,
      ty = y - iy,
      i = iy * width + ix;
    return (
      (field[i] * (1 - tx) + field[i + 1] * tx) * (1 - ty) +
      (field[i + width] * (1 - tx) + field[i + width + 1] * tx) * ty
    );
  };
  return (a, b) => {
    const length = dist(a, b),
      n = Math.max(1, Math.ceil(length / 18));
    let penalty = 0;
    for (let i = 0; i < n; i++) penalty += proximity(mix(a, b, (i + 0.5) / n));
    return length * (1 + penalty / n);
  };
}

export function corridorNodes(a, b) {
  const length = dist(a, b) || 1,
    normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
  const nodes = [];
  for (const t of [0.25, 0.5, 0.75])
    for (const offset of [-120, -60, 0, 60, 120]) {
      const p = mix(a, b, t);
      nodes.push({ x: p.x + normal.x * offset, y: p.y + normal.y * offset });
    }
  return nodes;
}
