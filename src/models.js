import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { buildAstra } from "./models/astra.js";
import { buildAdditionalVessels } from "./models/vessels.js";
export function templates() {
  const mat = {};
  for (const [key, color] of Object.entries({
    white: "#edf4ed",
    orange: "#f48b45",
    dark: "#263940",
    rubber: "#14232b",
    metal: "#a7bdc5",
    deck: "#becfcb",
    glass: "#0e526d",
    lens: "#16668a",
    red: "#ef4d45",
    green: "#43ffba",
  }))
    mat[key] = new T.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.3,
    });
  const group = (name, parent) => {
    const g = new T.Group();
    g.name = name;
    parent.add(g);
    return g;
  };
  const mesh = (geo, m, pos, parent, name = "") => {
    const g = new T.Mesh(geo, m);
    g.position.set(...pos);
    g.name = name;
    parent.add(g);
    return g;
  };
  const cylinder = (a, b, h, pos, m, parent, n = 10) =>
    mesh(new T.CylinderGeometry(a, b, h, n), m, pos, parent);
  const box = (size, pos, m, parent) =>
    mesh(new T.BoxGeometry(...size), m, pos, parent);
  const rod = (a, b, r, m, parent) => {
    const av = new T.Vector3(...a),
      bv = new T.Vector3(...b),
      d = bv.clone().sub(av),
      g = cylinder(
        r,
        r,
        d.length(),
        av.add(bv).multiplyScalar(0.5).toArray(),
        m,
        parent,
      );
    g.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    return g;
  };
  const tube = (points, r, m, parent) =>
    mesh(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        points.length * 2,
        r,
        4,
        false,
      ),
      m,
      [0, 0, 0],
      parent,
    );
  const label = (text, w, h, color) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.fillStyle = color || "#ddd";
    x.font = `bold ${h * 0.5}px Arial`;
    x.textAlign = "center";
    x.fillText(text, w / 2, h * 0.7);
    return new T.CanvasTexture(c);
  };
  const api = {
    group,
    mesh,
    box,
    cylinder,
    rod,
    tube,
    label,
    mat,
    nonSlip: mat.deck,
    solarMat: new T.MeshStandardMaterial({
      color: "#173e66",
      metalness: 0.5,
      roughness: 0.3,
    }),
  };
  function compact(root) {
    root.updateMatrixWorld(true);
    const buckets = new Map();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      const geo = o.geometry.index
        ? o.geometry.toNonIndexed()
        : o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      if (!geo.attributes.uv)
        geo.setAttribute(
          "uv",
          new T.Float32BufferAttribute(
            new Float32Array(geo.attributes.position.count * 2),
            2,
          ),
        );
      const groups = Array.isArray(o.material)
        ? geo.groups
        : [
            {
              start: 0,
              count: geo.attributes.position.count,
              materialIndex: 0,
            },
          ];
      for (const g of groups) {
        const m = materials[g.materialIndex],
          sub = new T.BufferGeometry();
        for (const [name, a] of Object.entries(geo.attributes))
          sub.setAttribute(
            name,
            new T.BufferAttribute(
              a.array.slice(
                g.start * a.itemSize,
                (g.start + g.count) * a.itemSize,
              ),
              a.itemSize,
            ),
          );
        if (!buckets.has(m)) buckets.set(m, []);
        buckets.get(m).push(sub);
      }
    });
    const result = new T.Group();
    for (const [m, gs] of buckets) {
      result.add(new T.Mesh(mergeGeometries(gs), m));
      gs.forEach((g) => g.dispose());
    }
    return result;
  }
  return [
    compact(buildAstra(api).root),
    compact(buildAdditionalVessels(api)[0].root),
  ];
}
