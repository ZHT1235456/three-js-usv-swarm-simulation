import * as T from "three";

// Deterministic, continuous terrain; every visible coast stays inside its obstacle disk.
export function buildIsland(radius, seed) {
  const root = new T.Group();
  const phase = seed * 1.731;
  const fract = (x) => x - Math.floor(x);
  const random = (n) => fract(Math.sin(n * 127.1 + seed * 311.7) * 43758.5453);
  const valueNoise = (x, z) => {
    const ix = Math.floor(x),
      iz = Math.floor(z),
      tx = x - ix,
      tz = z - iz,
      sx = tx * tx * (3 - 2 * tx),
      sz = tz * tz * (3 - 2 * tz);
    const hash = (a, b) => random(a * 43 + b * 197);
    return (
      T.MathUtils.lerp(
        T.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), sx),
        T.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), sx),
        sz,
      ) *
        2 -
      1
    );
  };
  const noise = (x, z) =>
    valueNoise(x * 9, z * 9) * 0.055 +
    valueNoise(x * 23, z * 23) * 0.025 +
    valueNoise(x * 55, z * 55) * 0.009;
  const boundary = (angle) =>
    0.79 +
    0.09 * Math.sin(angle * 3 + phase) +
    0.035 * Math.cos(angle * 7 - phase) +
    0.02 * Math.sin(angle * 11 + phase);
  const height = (x, z) => {
    const a = Math.atan2(z, x),
      q = Math.hypot(x, z) / boundary(a);
    if (q > 1) return -2 - (q - 1) * radius * 0.15;
    const beach = Math.max(0, 1 - q);
    const peak1 =
      0.49 * Math.exp(-((x + 0.23) ** 2 * 12 + (z - 0.13) ** 2 * 8));
    const peak2 =
      0.41 * Math.exp(-((x - 0.31) ** 2 * 16 + (z + 0.19) ** 2 * 12));
    const peak3 =
      0.28 * Math.exp(-((x + 0.36) ** 2 * 18 + (z + 0.3) ** 2 * 16));
    const ridge = peak1 + peak2 + peak3 + noise(x, z);
    return radius * ridge * Math.min(1, beach * 3.8) - 0.6;
  };
  const radial = 58,
    angular = 144,
    positions = [],
    indices = [],
    colors = [],
    uvs = [];
  for (let r = 0; r <= radial; r++)
    for (let a = 0; a <= angular; a++) {
      const angle = (a / angular) * Math.PI * 2,
        q = (r / radial) * 1.045;
      const x = Math.cos(angle) * boundary(angle) * q,
        z = Math.sin(angle) * boundary(angle) * q;
      const h = height(x, z),
        slope =
          Math.hypot(
            height(x + 0.006, z) - height(x - 0.006, z),
            height(x, z + 0.006) - height(x, z - 0.006),
          ) /
          (radius * 0.012);
      positions.push(x * radius, h, z * radius);
      uvs.push(x * 0.5 + 0.5, z * 0.5 + 0.5);
      const color = new T.Color(
        h < 2.7
          ? "#cbbf91"
          : slope > 1.6
            ? "#83867e"
            : h > radius * 0.5
              ? "#839075"
              : "#638452",
      );
      color.multiplyScalar(0.82 + random(r * angular + a) * 0.26);
      colors.push(color.r, color.g, color.b);
      if (r < radial && a < angular) {
        const k = r * (angular + 1) + a;
        indices.push(
          k,
          k + 1,
          k + angular + 1,
          k + 1,
          k + angular + 2,
          k + angular + 1,
        );
      }
    }
  const terrain = new T.BufferGeometry();
  terrain.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  terrain.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  terrain.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  terrain.setIndex(indices);
  terrain.computeVertexNormals();
  const textureData = new Uint8Array(256 * 256 * 4);
  for (let z = 0; z < 256; z++)
    for (let x = 0; x < 256; x++) {
      const i = (z * 256 + x) * 4,
        n =
          178 +
          valueNoise(x / 9, z / 9) * 36 +
          valueNoise(x / 2, z / 2) * 18 +
          random(i) * 20;
      textureData[i] = n;
      textureData[i + 1] = n;
      textureData[i + 2] = n;
      textureData[i + 3] = 255;
    }
  const detail = new T.DataTexture(textureData, 256, 256);
  detail.wrapS = detail.wrapT = T.RepeatWrapping;
  detail.repeat.set(6, 6);
  detail.magFilter = T.LinearFilter;
  detail.minFilter = T.LinearMipmapLinearFilter;
  detail.generateMipmaps = true;
  detail.needsUpdate = true;
  const land = new T.Mesh(
    terrain,
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.93,
      metalness: 0,
      bumpMap: detail,
      bumpScale: 0.55,
    }),
  );
  land.castShadow = true;
  land.receiveShadow = true;
  root.add(land);

  const rockGeometry = new T.IcosahedronGeometry(1, 1),
    rockMaterial = new T.MeshStandardMaterial({
      color: "#9e9e8c",
      roughness: 1,
      flatShading: true,
    });
  const rockCount = 55,
    rocks = new T.InstancedMesh(rockGeometry, rockMaterial, rockCount),
    dummy = new T.Object3D();
  for (let i = 0; i < rockCount; i++) {
    const a = random(i * 7 + 11) * Math.PI * 2,
      q = 0.68 + random(i * 7 + 12) * 0.29,
      x = Math.cos(a) * boundary(a) * q,
      z = Math.sin(a) * boundary(a) * q;
    const size = radius * (0.015 + random(i * 7 + 13) * 0.035);
    dummy.position.set(x * radius, Math.max(0.2, height(x, z)), z * radius);
    dummy.scale.set(size * (1 + random(i + 50)), size * 0.65, size);
    dummy.rotation.set(random(i) * 2, random(i + 4) * 6, random(i + 8));
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  root.add(rocks);

  const trees = [];
  for (let i = 0; i < 800 && trees.length < 175; i++) {
    const x = random(i * 3 + 100) * 1.4 - 0.7,
      z = random(i * 3 + 101) * 1.4 - 0.7,
      h = height(x, z);
    const slope =
      Math.hypot(height(x + 0.01, z) - h, height(x, z + 0.01) - h) /
      (radius * 0.01);
    if (h > 4 && h < radius * 0.43 && slope < 1.4)
      trees.push({
        x: x * radius,
        z: z * radius,
        h,
        size: radius * (0.018 + random(i + 202) * 0.022),
      });
  }
  const leaves = new T.InstancedMesh(
    new T.IcosahedronGeometry(1, 1),
    new T.MeshStandardMaterial({ color: "#52754a", roughness: 1 }),
    trees.length * 2,
  );
  const trunks = new T.InstancedMesh(
    new T.CylinderGeometry(0.18, 0.3, 1, 5),
    new T.MeshStandardMaterial({ color: "#686046", roughness: 1 }),
    trees.length,
  );
  trees.forEach((p, i) => {
    dummy.position.set(p.x, p.h + p.size * 0.9, p.z);
    dummy.scale.set(p.size * 0.4, p.size * 1.8, p.size * 0.4);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let j = 0; j < 2; j++) {
      dummy.position.set(
        p.x + j * p.size * 0.3,
        p.h + p.size * (1.5 + j * 0.65),
        p.z,
      );
      dummy.scale.set(
        p.size * (1.1 - j * 0.25),
        p.size * (0.9 - j * 0.15),
        p.size,
      );
      dummy.rotation.set(0, random(i + 1) * 6, random(i + 2) * 0.25);
      dummy.updateMatrix();
      leaves.setMatrixAt(i * 2 + j, dummy.matrix);
      leaves.setColorAt(
        i * 2 + j,
        new T.Color().setHSL(
          0.23 + random(i + 3) * 0.07,
          0.23 + random(i + 9) * 0.15,
          0.25 + random(i + 7) * 0.12,
        ),
      );
    }
  });
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  root.add(leaves, trunks);

  // Broken surf follows the irregular coastline, never a circular outline.
  const foam = [];
  for (let i = 0; i < 360; i++) {
    const a = (i / 360) * Math.PI * 2,
      b = ((i + 0.72) / 360) * Math.PI * 2;
    if (random(i + 901) < 0.22) continue;
    for (const t of [a, b]) {
      const q = boundary(t) * (1.005 + random(i + 902) * 0.015);
      foam.push(Math.cos(t) * q * radius, 0.3, Math.sin(t) * q * radius);
    }
  }
  const surfGeometry = new T.BufferGeometry();
  surfGeometry.setAttribute("position", new T.Float32BufferAttribute(foam, 3));
  const surf = new T.LineSegments(
    surfGeometry,
    new T.LineBasicMaterial({
      color: "#d9f1e6",
      transparent: true,
      opacity: 0.5,
    }),
  );
  root.add(surf);
  return root;
}
