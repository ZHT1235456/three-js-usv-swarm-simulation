import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Water } from "three/addons/objects/Water.js";
import { Sky } from "three/addons/objects/Sky.js";
import { templates } from "./models.js";
import { buildIsland } from "./islands.js";
import { buildUuv } from "./uuv.js";
import { COLORS, RADIUS, truth } from "./simulation.js";
let boats;
const v = (p, h = 2) => new T.Vector3(p.x, h, -p.y);
export class OceanView {
  constructor(container, state, onEdit) {
    this.state = state;
    this.container = container;
    this.onEdit = onEdit;
    this.scene = new T.Scene();
    this.scene.background = new T.Color("#89b3d9");
    // A 60 km ocean surrounds the 1.2 km mission area. Its edge is not a pedestal.
    this.scene.fog = new T.FogExp2(0x89b3d9, 0.00008);
    this.camera = new T.PerspectiveCamera(43, 1, 1, 150000);
    this.camera.layers.enable(1);
    this.camera.position.set(760, 1020, 1050);
    this.renderer = new T.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.55;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    container.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.addEventListener("start", () => {
      this.autoFrame = false;
    });
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minDistance = 70;
    this.controls.maxDistance = 3600;
    this.scene.add(new T.AmbientLight(0x445566, 0.4));
    this.scene.add(new T.HemisphereLight(0x87ceeb, 0x224433, 0.6));
    const sun = new T.Vector3().setFromSphericalCoords(
      1,
      T.MathUtils.degToRad(90 - 18),
      T.MathUtils.degToRad(210),
    );
    const light = new T.DirectionalLight(0xffeedd, 1.5);
    light.position.copy(sun).multiplyScalar(2000);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, {
      left: -750,
      right: 750,
      top: 750,
      bottom: -750,
      near: 100,
      far: 4000,
    });
    light.shadow.bias = -0.0003;
    this.scene.add(light);
    const sky = new Sky();
    sky.scale.setScalar(100000);
    sky.material.uniforms.sunPosition.value.copy(sun);
    sky.material.uniforms.turbidity.value = 10;
    sky.material.uniforms.rayleigh.value = 2;
    sky.material.uniforms.mieCoefficient.value = 0.005;
    sky.material.uniforms.mieDirectionalG.value = 0.8;
    this.scene.add(sky);
    const pmrem = new T.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(this.scene, 0.04, 1, 150000);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
    // Exact normal asset recommended by notes/水面制作笔记.txt, stored locally.
    const normals = new T.TextureLoader().load("/textures/waternormals.jpg");
    normals.wrapS = normals.wrapT = T.RepeatWrapping;
    normals.repeat.set(4, 4);
    normals.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.water = new Water(new T.CircleGeometry(30000, 256), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals,
      sunDirection: sun,
      sunColor: 0xffffff,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
      side: T.DoubleSide,
      fog: true,
    });
    this.water.rotation.x = -Math.PI / 2;
    this.water.material.uniforms.size.value = 4;
    this.scene.add(this.water);
    this.islandModels = state.islands.map((o, i) => buildIsland(o.r, i + 1));
    this.labels = [];
    this.staticGroup = new T.Group();
    this.scene.add(this.staticGroup);
    this.pathGroup = new T.Group();
    this.scene.add(this.pathGroup);
    this.trailGroup = new T.Group();
    this.scene.add(this.trailGroup);
    this.dynamic = new T.Group();
    this.scene.add(this.dynamic);
    boats ??= templates();
    this.boatModels = state.boats.map((b, i) => {
      const root = new T.Group(),
        model = boats[i % 2].clone();
      model.scale.setScalar(2);
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      root.add(model);
      root.userData = { type: "boats", index: i };
      this.dynamic.add(root);
      return root;
    });
    this.sonar = this.addRing({ x: 0, y: 0 }, 1, COLORS[0], 0.6, this.dynamic);
    this.uuv = Array.from({ length: 4 }, (_, i) => {
      const g = buildUuv(i);
      g.position.copy(v(truth(i, 0), -20));
      g.visible = false;
      this.dynamic.add(g);
      return g;
    });
    this.refresh();
    this.bind();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.home();
  }
  line(points, color, opacity = 1, parent = this.scene, h = 2) {
    const g = new T.BufferGeometry().setFromPoints(points.map((p) => v(p, h)));
    const l = new T.Line(
      g,
      new T.LineBasicMaterial({ color, transparent: true, opacity }),
    );
    parent.add(l);
    l.layers.set(1);
    return l;
  }
  addRing(p, r, color, opacity = 1, parent = this.scene) {
    const points = Array.from({ length: 97 }, (_, i) => ({
      x: p.x + r * Math.cos((i * Math.PI) / 48),
      y: p.y + r * Math.sin((i * Math.PI) / 48),
    }));
    return this.line(points, color, opacity, parent, 2);
  }
  clear(group) {
    for (const o of [...group.children]) {
      group.remove(o);
      o.traverse((c) => {
        c.geometry?.dispose();
        if (c.material) {
          (Array.isArray(c.material) ? c.material : [c.material]).forEach(
            (m) => {
              m.map?.dispose();
              m.bumpMap?.dispose();
              m.dispose();
            },
          );
        }
      });
      if (o.isInstancedMesh) o.dispose();
    }
  }
  label(text, p, color, parent) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#06182cca";
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = color;
    ctx.strokeRect(1, 1, 254, 62);
    ctx.fillStyle = color;
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, 128, 42);
    const t = new T.CanvasTexture(c),
      s = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false }));
    s.position.copy(v(p, 45));
    s.layers.set(1);
    this.labels.push(s);
    parent.add(s);
    return s;
  }
  refresh() {
    this.islandModels.forEach((g) => g.removeFromParent());
    this.clear(this.staticGroup);
    this.labels = [];
    this.pickables = [];
    this.state.islands.forEach((o, i) => {
      const g = this.islandModels[i];
      g.position.copy(v(o, 0));
      g.scale.z = o.aspect || 1;
      g.rotation.y = o.angle || 0;
      g.userData = { type: "islands", index: i };
      this.staticGroup.add(g);
      this.pickables.push(g);
    });
    this.state.targets.forEach((p, i) => {
      const g = new T.Group();
      g.position.copy(v(p, 0));
      const m = new T.Mesh(
        new T.OctahedronGeometry(10),
        new T.MeshStandardMaterial({
          color: COLORS[i],
          emissive: COLORS[i],
          emissiveIntensity: 0.7,
        }),
      );
      m.position.y = 17;
      g.add(m);
      this.line(
        [
          { x: -15, y: 0 },
          { x: 0, y: 15 },
          { x: 15, y: 0 },
          { x: 0, y: -15 },
          { x: -15, y: 0 },
        ],
        COLORS[i],
        0.85,
        g,
        2,
      );
      g.userData = { type: "targets", index: i };
      this.staticGroup.add(g);
      this.pickables.push(g);
      this.label(`T0${i + 1} · 目标区`, p, COLORS[i], this.staticGroup);
    });
    this.boatModels.forEach((m, i) => {
      m.position.copy(v(this.state.boats[i], 1));
      const b = this.state.boats[i],
        target = this.state.targets[b.team];
      m.rotation.y = Math.atan2(target.x - b.x, -(target.y - b.y));
      this.pickables.push(m);
    });
  }
  paths(plans, selected) {
    this.clear(this.pathGroup);
    this.pathFlow = [];
    const p = selected || plans[0];
    if (!p) return;
    p.paths.forEach((path, i) => {
      const lengths = [0];
      for (let j = 1; j < path.length; j++)
        lengths.push(
          lengths[j - 1] +
            Math.hypot(path[j].x - path[j - 1].x, path[j].y - path[j - 1].y),
        );
      const geo = new T.BufferGeometry().setFromPoints(
        path.map((q) => v(q, 3)),
      );
      geo.setAttribute("aDistance", new T.Float32BufferAttribute(lengths, 1));
      const mat = new T.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new T.Color(COLORS[Math.floor(i / 10)]) },
        },
        vertexShader:
          "attribute float aDistance; varying float vDistance; void main(){vDistance=aDistance;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader:
          "uniform float uTime; uniform vec3 uColor; varying float vDistance; void main(){float pulse=pow(1.0-fract(vDistance/65.0-uTime*0.55),5.0);gl_FragColor=vec4(uColor*(0.75+pulse),0.3+pulse*0.7);}",
        transparent: true,
        depthWrite: false,
      });
      const line = new T.Line(geo, mat);
      line.layers.set(1);
      this.pathGroup.add(line);
      this.pathFlow.push(mat);
    });
  }
  bind() {
    const canvas = this.renderer.domElement,
      ray = new T.Raycaster(),
      plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    const cast = (e) => {
      const r = canvas.getBoundingClientRect();
      ray.setFromCamera(
        new T.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        this.camera,
      );
    };
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.editable || e.button !== 0) return;
        cast(e);
        const hits = ray.intersectObjects(this.pickables, true);
        if (!hits.length) return;
        let o = hits[0].object;
        while (o.parent && !o.userData.type) o = o.parent;
        if (!o.userData.type) return;
        this.drag = { ...o.userData };
        this.controls.enabled = false;
        canvas.setPointerCapture(e.pointerId);
        this.onSelect?.(this.drag);
      },
      true,
    );
    canvas.addEventListener("pointermove", (e) => {
      if (!this.drag) return;
      cast(e);
      const p = new T.Vector3();
      if (ray.ray.intersectPlane(plane, p))
        this.onEdit(this.drag, { x: p.x, y: -p.z });
    });
    const end = () => {
      this.drag = null;
      this.controls.enabled = true;
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  }
  resize() {
    const bounds = this.container.getBoundingClientRect();
    const { width, height } = bounds;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    let left = 0,
      right = width,
      top = 0,
      bottom = height;
    if (
      !document.body.classList.contains("immersive") &&
      window.innerWidth > 800
    ) {
      const panelLeft = document.querySelector(".left").getBoundingClientRect(),
        panelRight = document.querySelector(".right").getBoundingClientRect();
      left = Math.max(0, panelLeft.right - bounds.left + 12);
      right = Math.min(width, panelRight.left - bounds.left - 12);
      const toolbar = document
        .querySelector(".scene-toolbar")
        .getBoundingClientRect();
      top = Math.max(0, toolbar.bottom - bounds.top + 16);
      const panel = Array.from(document.querySelectorAll(".bottom-panel")).find(
        (e) => !e.hidden,
      );
      if (panel)
        bottom = Math.min(
          height,
          panel.getBoundingClientRect().top - bounds.top - 16,
        );
    }
    this.frameAspect = Math.max(180, right - left) / height;
    this.visibleFraction = Math.max(180, bottom - top) / height;
    const offset = (left + right) / 2 - width / 2;
    this.camera.setViewOffset(
      width,
      height,
      -offset,
      -((top + bottom) / 2 - height / 2),
      width,
      height,
    );
    this.camera.updateProjectionMatrix();
    if (this.autoFrame) this.home(this.homeTop);
  }
  home(top = false) {
    this.autoFrame = true;
    this.homeTop = top;
    const d =
      (RADIUS / Math.sin((this.camera.fov * Math.PI) / 360)) *
      Math.max(
        1 / Math.min(this.frameAspect || this.camera.aspect, 1),
        (top ? 1 : 0.52) / (this.visibleFraction || 1),
      ) *
      0.92;
    this.camera.position.copy(
      new T.Vector3(...(top ? [0, 1, 0.001] : [0.7, 0.75, 1]))
        .normalize()
        .multiplyScalar(d),
    );
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
  focusObject(selection) {
    this.autoFrame = false;
    const p = this.state[selection.type][selection.index];
    const center = v(p, selection.type === "islands" ? p.r * 0.2 : 3);
    const d =
      selection.type === "islands"
        ? p.r * 3.6
        : selection.type === "boats"
          ? 65
          : 150;
    this.controls.target.copy(center);
    this.camera.position
      .copy(center)
      .add(new T.Vector3(-0.7, 0.65, -1).normalize().multiplyScalar(d));
    this.controls.update();
  }
  render(time, run, selected = 0, showSonar = true) {
    this.controls.update();
    this.motionPreference ??= window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const decorativeTime = this.motionPreference.matches ? 0 : time;
    const compass = this.container.querySelector(".compass");
    if (compass) {
      const center = this.controls.target.clone().project(this.camera);
      const north = this.controls.target
        .clone()
        .add(new T.Vector3(0, 0, -100))
        .project(this.camera);
      const angle = Math.atan2(
        (north.x - center.x) * this.camera.aspect,
        north.y - center.y,
      );
      compass.style.transform = `rotate(${angle}rad)`;
    }
    this.water.material.uniforms.time.value = decorativeTime * 0.5;
    this.pathFlow?.forEach((m) => (m.uniforms.uTime.value = decorativeTime));
    const height = this.container.clientHeight;
    for (const label of this.labels) {
      const unit =
        (2 *
          this.camera.position.distanceTo(label.position) *
          Math.tan((this.camera.fov * Math.PI) / 360)) /
        height;
      const isIsland = label.userData.kind === "island";
      label.visible = !(
        run &&
        isIsland &&
        this.camera.position.distanceTo(label.position) > 600
      );
      label.scale.set(
        (isIsland ? 82 : 96) * unit,
        (isIsland ? 20.5 : 24) * unit,
        1,
      );
    }
    this.boatModels.forEach((m, i) => {
      const b = run ? run.boats[i] : this.state.boats[i];
      m.position.copy(v(b, 1 + Math.sin(time * 1.5 + i) * 0.3));
      if (run && Math.hypot(b.vx, b.vy) > 0.05)
        m.rotation.y = Math.atan2(b.vx, -b.vy);
      else if (!run || run.time === 0) {
        const target = this.state.targets[b.team];
        m.rotation.y = Math.atan2(target.x - b.x, -(target.y - b.y));
      }
    });
    const b = run ? run.boats[selected] : this.state.boats[selected];
    this.sonar.visible = showSonar;
    this.sonar.position.set(b.x, 0, -b.y);
    this.sonar.scale.set(this.state.radius, 1, this.state.radius);
    this.sonar.material.opacity = 0.3 + 0.2 * Math.sin(time * 2);
    this.uuv.forEach((m, i) => {
      m.visible = !!run && run.targets[i]?.n > 0;
      const p = truth(i, run?.time || 0);
      m.position.copy(v(p, p.z));
      const next = truth(i, (run?.time || 0) + 0.1);
      m.rotation.y = Math.atan2(next.x - p.x, -(next.y - p.y));
    });
    if (run && this.lastTrail !== Math.floor(run.time * 3)) {
      this.lastTrail = Math.floor(run.time * 3);
      this.clear(this.trailGroup);
      run.boats.forEach((b) => {
        if (b.trail.length < 2) return;
        const l = this.line(b.trail, COLORS[b.team], 0.8, this.trailGroup, 2.5);
        const color = new T.Color(COLORS[b.team]),
          a = [];
        b.trail.forEach((_, i) =>
          a.push(
            (color.r * i) / b.trail.length,
            (color.g * i) / b.trail.length,
            (color.b * i) / b.trail.length,
          ),
        );
        l.geometry.setAttribute("color", new T.Float32BufferAttribute(a, 3));
        l.material.vertexColors = true;
      });
      run.targets
        .filter((t) => t.n > 0)
        .forEach((t) => {
          const ring = this.addRing(
            t.truth,
            12 + ((run.time * 15) % 35),
            "#ffcc83",
            0.8,
            this.trailGroup,
          );
          ring.material.depthTest = false;
        });
    }
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.environment.dispose();
    this.container.removeChild(this.renderer.domElement);
    this.clear(this.staticGroup);
    this.clear(this.pathGroup);
    this.clear(this.trailGroup);
  }
}
