import * as T from "three";
export function buildUuv(index) {
  const root = new T.Group();
  const yellow = new T.MeshStandardMaterial({
    color: "#e6aa30",
    roughness: 0.4,
    metalness: 0.3,
  });
  const dark = new T.MeshStandardMaterial({
    color: "#253440",
    roughness: 0.4,
    metalness: 0.55,
  });
  const steel = new T.MeshStandardMaterial({
    color: "#abbcc1",
    roughness: 0.3,
    metalness: 0.8,
  });
  const lens = new T.MeshPhysicalMaterial({
    color: "#123d51",
    roughness: 0.1,
    metalness: 0.6,
    clearcoat: 1,
  });
  const mesh = (g, m, p = [0, 0, 0]) => {
    const o = new T.Mesh(g, m);
    o.position.set(...p);
    root.add(o);
    return o;
  };
  const profile = [
    [-5, 0.05],
    [-4.6, 0.24],
    [-3.8, 0.58],
    [-2.9, 0.77],
    [-1.8, 0.8],
    [0, 0.8],
    [1.8, 0.8],
    [2.9, 0.73],
    [3.8, 0.54],
    [4.4, 0.25],
    [4.6, 0],
  ];
  const hull = mesh(
    new T.LatheGeometry(
      profile.map(([z, r]) => new T.Vector2(r, z)),
      48,
    ),
    yellow,
  );
  hull.rotation.x = Math.PI / 2;
  for (const z of [-2.7, -1.9, 1.8, 2.6])
    mesh(new T.TorusGeometry(0.795, 0.045, 10, 48), dark, [0, 0, z]);
  for (const z of [-0.8, 0.2, 1.2]) {
    const hatch = mesh(new T.CylinderGeometry(0.23, 0.23, 0.06, 24), dark, [
      0,
      0.785,
      z,
    ]);
    hatch.rotation.z = 0.05;
  }
  const rail = mesh(new T.BoxGeometry(0.15, 0.08, 2.2), dark, [0, 0.85, -0.8]);
  mesh(new T.SphereGeometry(0.18, 20, 12), lens, [0, 0.94, 1.9]);
  const finShape = new T.Shape();
  finShape.moveTo(0.45, -0.8);
  finShape.lineTo(1.9, -1.25);
  finShape.lineTo(1.65, 0.25);
  finShape.lineTo(0.5, 0.55);
  finShape.closePath();
  const finGeo = new T.ExtrudeGeometry(finShape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelSize: 0.035,
    bevelThickness: 0.025,
    bevelSegments: 1,
    steps: 1,
  });
  for (let i = 0; i < 4; i++) {
    const fin = mesh(finGeo, dark, [0, 0, -3.4]);
    fin.rotation.x = Math.PI / 2;
    fin.rotateOnWorldAxis(new T.Vector3(0, 0, 1), (i * Math.PI) / 2);
  }
  const shroud = mesh(
    new T.CylinderGeometry(0.49, 0.53, 0.8, 32, 1, true),
    dark,
    [0, 0, -5],
  );
  shroud.rotation.x = Math.PI / 2;
  mesh(new T.TorusGeometry(0.5, 0.055, 10, 32), steel, [0, 0, -5.42]);
  const hub = mesh(
    new T.CylinderGeometry(0.13, 0.18, 0.7, 16),
    steel,
    [0, 0, -5.15],
  );
  hub.rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2,
      blade = mesh(new T.BoxGeometry(0.16, 0.4, 0.05), dark, [
        Math.sin(a) * 0.23,
        Math.cos(a) * 0.23,
        -5.4,
      ]);
    blade.rotation.z = -a;
    blade.rotation.y = 0.4;
  }
  const nose = mesh(new T.CircleGeometry(0.23, 24), lens, [0, 0.05, 4.39]);
  nose.rotation.x = 0.03;
  for (const z of [-2.68, 1.81])
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      mesh(new T.SphereGeometry(0.025, 6, 4), steel, [
        Math.cos(a) * 0.82,
        Math.sin(a) * 0.82,
        z,
      ]);
    }
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#25343c";
  ctx.font = "bold 58px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`UUV-${String(index + 1).padStart(2, "0")}`, 256, 83);
  const decalMat = new T.MeshBasicMaterial({
    map: new T.CanvasTexture(c),
    transparent: true,
    side: T.DoubleSide,
  });
  const decal = mesh(new T.PlaneGeometry(2.6, 0.65), decalMat, [0.81, 0, 0.1]);
  decal.rotation.y = Math.PI / 2;
  root.scale.setScalar(2);
  // X-ray display is intentional: water depth otherwise occludes detected targets.
  root.traverse((o) => {
    if (o.isMesh) {
      o.material.depthTest = false;
      o.material.transparent = true;
      o.material.opacity = 0.9;
      o.renderOrder = 6;
    }
  });
  root.userData.rotor = hub;
  return root;
}
