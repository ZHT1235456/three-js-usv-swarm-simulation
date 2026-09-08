export const BOAT_SEPARATION = 18;
export function sweptSeparation(a0, a1, b0, b1) {
  const x = a0.x - b0.x,
    y = a0.y - b0.y,
    dx = a1.x - a0.x - b1.x + b0.x,
    dy = a1.y - a0.y - b1.y + b0.y;
  const t = Math.max(
    0,
    Math.min(1, -(x * dx + y * dy) / (dx * dx + dy * dy || 1)),
  );
  return Math.hypot(x + t * dx, y + t * dy);
}

// Reciprocal velocity projection with a control-barrier distance constraint.
// A final swept-segment check stops conflicting local pairs if needed.
export function avoidBoats(previous, proposed, dt, safeSegment) {
  const velocity = proposed.map((p, i) => ({
    x: (p.x - previous[i].x) / dt,
    y: (p.y - previous[i].y) / dt,
  }));
  let interventions = 0;
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 0; i < previous.length; i++)
      for (let j = i + 1; j < previous.length; j++) {
        const x = previous[i].x - previous[j].x,
          y = previous[i].y - previous[j].y,
          d2 = x * x + y * y;
        if (d2 > 65 * 65 || d2 < 1e-9) continue;
        let vx = velocity[i].x - velocity[j].x,
          vy = velocity[i].y - velocity[j].y;
        const closing = x * vx + y * vy,
          tcpa = Math.max(0, Math.min(3, -closing / (vx * vx + vy * vy || 1))),
          closest = Math.hypot(x + vx * tcpa, y + vy * tcpa);
        if (pass === 0 && tcpa > 0 && closest < BOAT_SEPARATION + 3) {
          const scale = 0.9 / Math.sqrt(d2);
          velocity[i].x -= y * scale;
          velocity[i].y += x * scale;
          velocity[j].x += y * scale;
          velocity[j].y -= x * scale;
          interventions++;
        }
        vx = velocity[i].x - velocity[j].x;
        vy = velocity[i].y - velocity[j].y;
        const lower = (-0.6 * (d2 - (BOAT_SEPARATION + 0.5) ** 2)) / 2,
          dot = x * vx + y * vy;
        if (dot < lower) {
          const correction = (lower - dot) / (2 * d2);
          velocity[i].x += x * correction;
          velocity[i].y += y * correction;
          velocity[j].x -= x * correction;
          velocity[j].y -= y * correction;
          interventions++;
        }
      }
  }
  const candidates = velocity.map((v, i) => {
    const p = { x: previous[i].x + v.x * dt, y: previous[i].y + v.y * dt };
    return safeSegment(previous[i], p) ? p : { ...previous[i] };
  });
  for (let pass = 0; pass < previous.length; pass++) {
    let changed = false;
    for (let i = 0; i < previous.length; i++)
      for (let j = i + 1; j < previous.length; j++) {
        if (
          sweptSeparation(
            previous[i],
            candidates[i],
            previous[j],
            candidates[j],
          ) <
          BOAT_SEPARATION - 1e-7
        ) {
          candidates[i] = { ...previous[i] };
          candidates[j] = { ...previous[j] };
          changed = true;
          interventions++;
        }
      }
    if (!changed) break;
  }
  return { positions: candidates, interventions };
}
