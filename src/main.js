import "./style.css";
import "./workbench.css";
import {
  defaults,
  valid,
  distance,
  makeRun,
  tick,
  COLORS,
  RADIUS,
} from "./simulation.js";
import { OceanView } from "./scene.js";
import { BOAT_SEPARATION } from "./avoidance.js";
const $ = (id) => document.getElementById(id);
let state = defaults(),
  plans = [],
  chosen = null,
  stage = 1,
  running = false,
  runs = [],
  second = null,
  selected = { type: "targets", index: 0 },
  speed = 1,
  elapsed = 0,
  accum = 0,
  uiTime = 0;
document.querySelector("#app").innerHTML = `
<header><div class="brand"><span class="brand-symbol">◈</span><div><strong>无人艇集群仿真平台</strong><small>场景规划 · 航行控制 · 协同探测</small></div></div><nav aria-label="仿真阶段"><button id="stage1" class="step active"><b>01</b> 场景与路径规划</button><span class="step-line"></span><button id="stage2" class="step" disabled><b>02</b> 控制与协同探测 <span id="lock"></span></button></nav><div class="system"><span class="live-dot"></span> 仿真引擎就绪 <small>LOCAL / SI</small></div></header>
<div class="workspace"><aside class="left"><div class="panel-heading"><span id="panelTitle">任务配置</span><small>MISSION CONFIGURATION</small></div><section><div class="section-title">海域场景 <span class="tag">SCENE 01</span></div><div class="scene-card"><span class="scene-icon">◎</span><div>近海岛礁 · 集群搜索<small>开阔海域 60 km / 任务区 1.2 km</small></div></div><div class="stats"><div><b>30</b><small>无人艇</small></div><div><b>03</b><small>任务编队</small></div><div><b>04</b><small>海岛障碍</small></div></div></section>
<div id="planningControls"><section><div class="section-title">场景编辑 <span class="muted">拖动或输入坐标</span></div><label>编辑对象<select id="objectType"><option value="targets">任务目标</option><option value="boats">无人艇</option><option value="islands">海岛</option></select></label><select id="objectIndex" aria-label="对象编号"></select><div class="coordinate-inputs"><label>东 E / m<input id="coordX" type="number" step="1"></label><label>北 N / m<input id="coordY" type="number" step="1"></label></div><button id="applyCoord" class="secondary full">应用坐标</button><p class="hint">海岛边缘外保留 16 m 安全距离。</p></section><section><div class="section-title">探测参数</div><label class="range-label">单艇探测半径 <b id="radiusValue">95 m</b></label><input id="radius" type="range" min="50" max="160" step="5" value="95"><div class="range-limits"><span>50 m</span><span>160 m</span></div></section><section><div class="section-title">编队分配 <span class="muted">均衡分组</span></div>${COLORS.map((c, i) => `<div class="fleet-row"><span class="dot" style="background:${c}"></span><div>编队${i + 1}<small>USV ${String(i * 10 + 1).padStart(2, "0")}–${i * 10 + 10}</small></div><span>10 艘 <small>→ T0${i + 1}</small></span></div>`).join("")}</section><div class="aside-actions"><button id="plan" class="primary full">⌁ 运行双算法规划</button><button id="resetScene" class="text-button full">恢复默认场景</button></div></div>
<div id="controlControls" hidden><section><div class="section-title">路径跟踪控制</div><label>演示方式<select id="mode"><option value="both">左右对比 · PPC / PD</option><option value="ppc">预设性能控制 · PPC</option><option value="pd">PD 跟踪控制</option></select></label><p class="hint">相同初始场景、航速和确定性扰动；各自独立演算。</p><label>仿真倍率<select id="speed"><option value="1" selected>1 ×</option><option value="2">2 ×</option><option value="4">4 ×</option></select></label><button id="run" class="primary full">▶ 开始仿真</button><button id="restart" class="secondary full">↺ 重置航行</button></section><section><div class="section-title">观测无人艇</div><select id="selectedBoat" aria-label="观测无人艇">${state.boats.map((b, i) => `<option value="${i}">USV-${String(i + 1).padStart(2, "0")}</option>`).join("")}</select><div id="boatDetail" class="hint">选择无人艇查看探测观测。</div><label class="check"><input id="sonar" type="checkbox" checked> 显示选中艇探测范围</label></section><div class="aside-actions"><button id="back" class="secondary full">← 返回规划阶段</button></div></div></aside>
<main><div class="scene-toolbar"><div><span class="live-dot"></span><strong id="viewTitle">任务海域</strong><span id="viewSubtitle">场景可编辑</span></div><div class="tools"><button id="top" title="俯视海域">⊞ 俯视</button><button id="home" title="恢复全景">⌖ 全景</button><button id="export">↓ 导出数据</button></div></div><div id="views"><div class="viewport" id="viewA"><div class="view-badge" id="badgeA">PLANNING <span>场景预览</span></div><div class="compass">N<span>↑</span></div></div><div class="viewport" id="viewB" hidden><div class="view-badge">PD <span>基准控制</span></div></div><div class="map-footer"><span>◉ E / N / H · 米</span><span>海域 60 km · 任务区 1.2 km</span><span class="scale">高度基准：海平面</span></div></div><div class="scene-bottom"><span id="sceneHint">左键拖动目标 / 艇 / 岛屿 · 拖动空白旋转 · 滚轮缩放</span><span id="clock">T + 000.0 s</span></div>
<div id="planningResults" class="bottom-panel"><div class="results-heading"><div><h2>路径方案对比</h2><p>在相同海域与探测半径下评估两种规划策略</p></div><span id="planStatus" class="tag">等待规划</span></div><div id="planCards" class="plan-cards"><div class="empty-card"><span>⌁</span><div>场景已就绪，开始规划航路<small>两种算法将展示总航程、覆盖面积与计算耗时。</small></div></div></div><div class="next-row"><span id="selectedPlan">完成规划并选择路径方案后进入控制阶段</span><button id="enter" class="primary" disabled>确认方案，进入控制与探测 →</button></div></div>
<div id="controlResults" class="bottom-panel" hidden><div class="results-heading"><div><h2>路径跟踪误差</h2><p>全艇瞬时 RMSE / m · 仿真时间 / s</p></div><div class="chart-legend"><span style="color:#41d8e8">━ PPC</span><span style="color:#ffbd71">━ PD</span></div></div><svg id="chart" viewBox="0 0 800 130" preserveAspectRatio="none" aria-label="路径跟踪误差曲线"></svg><div id="trackingStats" class="tracking-stats"></div></div></main>
<aside class="right"><div class="panel-heading"><span id="rightTitle">任务态势</span><small>MISSION TELEMETRY</small></div><section><div class="section-title">任务进程 <span id="missionState" class="tag">待规划</span></div><div class="timeline"><div id="progress1" class="current"><b>01</b><span>编辑与路径规划<small>配置任务海域，比较规划方案</small></span></div><div id="progress2"><b>02</b><span>控制与协同探测<small>航路跟踪，多艇融合定位</small></span></div></div></section><div id="rightPlanning"><section><div class="section-title">目标位置 <span class="muted">E / N / H</span></div><div id="targetList"></div></section><section><div class="section-title">算法说明</div><div class="algorithm-note"><b>A <span>避障最短路</span></b><p>在岛屿安全边界外搜索短航路，并留出编队间通道。</p></div><div class="algorithm-note"><b>B <span>覆盖导向规划</span></b><p>增加横向分散的搜索航点，结合避障搜索扩大沿途探测覆盖。</p></div><p class="hint">覆盖面积以 20 m 网格估计，剔除陆地；独立到达点、编队分隔与贝塞尔平滑；航行中启用艇间避碰。</p></section><section><div class="section-title">运行说明</div><p class="hint">30 艘无人艇分为 3 个编队。编辑任一对象或探测半径后，已有规划自动失效。</p><p class="hint">水下潜航器默认 4 艘，进入控制阶段后按预设轨迹运动。</p></section></div>
<div id="rightControl" hidden><section><div class="section-title">定位算法数据源</div><select id="dataSource" aria-label="定位数据源"></select><div class="metric-pair"><div><small>单艇平均误差</small><strong id="single">—</strong><span>m</span></div><div><small>协同定位误差</small><strong id="fused">—</strong><span>m</span></div></div><div class="improvement"><span>定位精度提升</span><b id="improvement">—</b></div><p class="hint">同一采样时刻，对已探测目标进行独立高斯观测和顺序卡尔曼融合。</p></section><section><div class="section-title">潜航器融合结果 <span class="muted">4 UUV</span></div><div id="uuvList"></div></section><section><div class="section-title">选中艇观测 <span class="muted">E / N / H · m</span></div><div id="observations" class="observation-list">暂无探测观测</div></section></div><div class="right-footer"><span class="live-dot"></span> 本地数值仿真 <span>v1.0</span></div></aside></div><footer><span>无人艇集群仿真平台</span><span id="status">场景就绪 · 可编辑 30 艘无人艇、3 个目标与 4 座海岛</span><span>坐标系：东 / 北 / 高度 ↑</span></footer><div id="toast" role="status"></div>`;
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 4000);
}
// Keep the primary action outside the scrolling configuration area.
const leftPanel = document.querySelector(".left");
const planningActions = $("plan").closest(".aside-actions");
planningActions.id = "planningActions";
leftPanel.append(planningActions);
const controlActions = $("back").closest(".aside-actions");
controlActions.id = "controlActions";
controlActions.hidden = true;
leftPanel.append(controlActions);
const fleetSection = document.querySelector(".fleet-row").closest("section");
const fleetDisclosure = document.createElement("details");
fleetDisclosure.className = "section-fold";
fleetDisclosure.innerHTML =
  "<summary>编队与艇型 <span>3 个编队 / 30 艘</span></summary>";
fleetSection.replaceWith(fleetDisclosure);
fleetDisclosure.append(fleetSection);
document
  .querySelector(".tools")
  .insertAdjacentHTML(
    "afterbegin",
    '<button id="immersive" title="隐藏配置和数据面板">⛶ 纯海域</button>',
  );
$("applyCoord").insertAdjacentHTML(
  "afterend",
  '<button id="locate" class="text-button full">⌖ 定位并查看对象</button>',
);
// Keep comparison telemetry in the sidebar so it never covers the sea.
$("controlResults").className = "telemetry-comparison chart-collapsed";
$("rightControl").prepend($("controlResults"));
$("controlResults")
  .querySelector(".results-heading")
  .insertAdjacentHTML(
    "beforeend",
    '<button id="chartToggle" class="text-button" aria-expanded="false">展开曲线</button>',
  );
$("chartToggle").onclick = () => {
  const collapsed = $("controlResults").classList.toggle("chart-collapsed");
  $("chartToggle").textContent = collapsed ? "展开曲线" : "收起曲线";
  $("chartToggle").setAttribute("aria-expanded", String(!collapsed));
};
$("observations").insertAdjacentHTML(
  "afterend",
  `<details id="observationDetails" class="observation-details"><summary>单艇定位明细 <span id="obsCount">0 条记录</span></summary><p class="hint">各艇对潜航器的坐标观测及三维误差；历史记录保留采样时间。</p><label>筛选无人艇<select id="obsBoat"><option value="all">全部无人艇</option>${state.boats.map((b, i) => `<option value="${i}">USV-${String(i + 1).padStart(2, "0")}</option>`).join("")}</select></label><div class="observation-table"><table><thead><tr><th>艇号 / 目标 / 时刻</th><th>东 / 北 / 高度 (m)</th><th>误差 (m)</th></tr></thead><tbody id="observationRows"></tbody></table></div><p id="recordLimit" class="hint"></p></details>`,
);
$("observationDetails").ontoggle = updateTelemetry;
$("obsBoat").onchange = updateTelemetry;
let view;
try {
  view = new OceanView($("viewA"), state, edit);
} catch (e) {
  $("viewA").insertAdjacentHTML(
    "beforeend",
    '<div class="render-error">无法启动三维场景。请启用浏览器硬件加速并刷新。</div>',
  );
  throw e;
}
view.editable = true;
view.onSelect = (s) => {
  selected = s;
  syncEditor();
};
function invalidate() {
  plans = [];
  chosen = null;
  $("enter").disabled = true;
  $("stage2").disabled = true;
  $("planStatus").textContent = "等待规划";
  $("selectedPlan").textContent = "场景已修改，请重新规划";
  $("planCards").innerHTML =
    '<div class="empty-card"><span>⌁</span><div>场景已就绪，开始规划航路<small>算法将在当前场景重新计算。</small></div></div>';
  view.paths([], null);
  $("missionState").textContent = "待规划";
  requestAnimationFrame(() => view.resize());
}
function edit(s, p) {
  const old = state[s.type][s.index],
    candidate = { ...old, ...p };
  if (s.type === "islands") {
    if (Math.hypot(p.x, p.y) + old.r + 20 > RADIUS) return;
    const test = {
      ...state,
      islands: state.islands.map((o, i) => (i === s.index ? candidate : o)),
    };
    if (
      !state.boats.concat(state.targets).every((o) => valid(o, test)) ||
      state.islands.some(
        (o, i) => i !== s.index && distance(o, candidate) < o.r + old.r + 35,
      )
    )
      return;
  } else if (!valid(candidate, state)) return;
  if (
    s.type === "boats" &&
    state.boats.some(
      (b, i) => i !== s.index && distance(b, candidate) < BOAT_SEPARATION + 1,
    )
  )
    return;
  Object.assign(old, p);
  selected = s;
  invalidate();
  view.refresh();
  syncEditor();
  renderTargets();
  return true;
}
function syncEditor() {
  $("objectType").value = selected.type;
  const items = state[selected.type];
  $("objectIndex").innerHTML = items
    .map(
      (_, i) =>
        `<option value="${i}">${selected.type === "boats" ? "USV" : selected.type === "targets" ? "目标 T" : "海岛 "}${String(i + 1).padStart(2, "0")}</option>`,
    )
    .join("");
  $("objectIndex").value = selected.index;
  const p = items[selected.index];
  $("coordX").value = p.x.toFixed(0);
  $("coordY").value = p.y.toFixed(0);
}
function renderTargets() {
  $("targetList").innerHTML = state.targets
    .map(
      (p, i) =>
        `<div class="target-row"><b style="color:${COLORS[i]}">T0${i + 1}</b><div>${p.x.toFixed(0)}, ${p.y.toFixed(0)}, 0 <small>编队${i + 1} · 10 艘</small></div><span class="dot" style="background:${COLORS[i]}"></span></div>`,
    )
    .join("");
}
$("objectType").onchange = (e) => {
  selected = { type: e.target.value, index: 0 };
  syncEditor();
};
$("objectIndex").onchange = (e) => {
  selected.index = +e.target.value;
  syncEditor();
};
$("applyCoord").onclick = () => {
  const x = +$("coordX").value,
    y = +$("coordY").value;
  if (!Number.isFinite(x + y) || !edit(selected, { x, y }))
    toast("该位置超出海域或与安全区重叠，请调整。");
  else toast("坐标已更新");
};
$("radius").oninput = (e) => {
  state.radius = +e.target.value;
  $("radiusValue").textContent = `${state.radius} m`;
  invalidate();
};
$("resetScene").onclick = () => {
  state = defaults();
  view.state = state;
  selected = { type: "targets", index: 0 };
  $("radius").value = state.radius;
  $("radiusValue").textContent = state.radius + " m";
  invalidate();
  view.refresh();
  syncEditor();
  renderTargets();
  toast("已恢复默认场景");
};
$("plan").onclick = async () => {
  $("plan").disabled = true;
  $("plan").textContent = "正在计算两种路径…";
  await new Promise((r) => setTimeout(r, 40));
  try {
    const snapshot = structuredClone(state);
    plans = await Promise.all(
      ["short", "coverage"].map(
        (kind) =>
          new Promise((resolve, reject) => {
            const w = new Worker(
              new URL("./planner.worker.js", import.meta.url),
              { type: "module" },
            );
            w.onmessage = (e) => {
              w.terminate();
              e.data.error
                ? reject(Error(e.data.error))
                : resolve(e.data.result);
            };
            w.onerror = (e) => {
              w.terminate();
              reject(Error(e.message));
            };
            w.postMessage({ scene: snapshot, kind });
          }),
      ),
    );
    if (JSON.stringify(state) !== JSON.stringify(snapshot)) {
      invalidate();
      toast("规划期间场景已改变，请重新规划");
      return;
    }
    chosen = null;
    renderPlans();
    view.paths(plans, null);
    $("planStatus").textContent = "规划完成";
    $("missionState").textContent = "待选方案";
    toast("两种规划已完成，请选择一种航路");
  } catch (e) {
    toast(e.message);
  } finally {
    $("plan").disabled = false;
    $("plan").textContent = "⌁ 运行双算法规划";
  }
};
function renderPlans() {
  requestAnimationFrame(() => {
    view.resize();
    view.home();
  });
  $("planCards").innerHTML = plans
    .map(
      (p, i) =>
        `<button class="plan-card ${chosen === p ? "selected" : ""}" data-plan="${i}"><div class="plan-name"><b>${i ? "B" : "A"}</b><strong>${i ? "覆盖导向规划" : "避障最短路"}</strong><span>${chosen === p ? "● 已选择" : "○ 选择方案"}</span></div><div class="plan-metrics"><div><strong>${(p.length / 1000).toFixed(2)}<small> km</small></strong><span>总路径长度</span></div><div><strong>${(p.area / 1e6).toFixed(3)}<small> km²</small></strong><span>覆盖面积 · ${(p.ratio * 100).toFixed(1)}%</span></div><div><strong>${p.time.toFixed(0)}<small> ms</small></strong><span>计算时间</span></div></div><div class="coverage-bar"><i style="width:${p.ratio * 100}%"></i></div></button>`,
    )
    .join("");
  document.querySelectorAll("[data-plan]").forEach(
    (b) =>
      (b.onclick = () => {
        chosen = plans[+b.dataset.plan];
        renderPlans();
        view.paths(plans, chosen);
        $("enter").disabled = false;
        $("stage2").disabled = false;
        $("missionState").textContent = "方案已选";
        $("selectedPlan").textContent =
          `已选择方案 ${chosen.kind === "short" ? "A · 避障最短路" : "B · 覆盖导向规划"}`;
      }),
  );
}
function setStage(next) {
  if (next === 2 && !chosen) return;
  stage = next;
  running = false;
  const control = next === 2;
  for (const id of [
    "planningControls",
    "planningResults",
    "rightPlanning",
    "planningActions",
  ])
    $(id).hidden = control;
  for (const id of [
    "controlControls",
    "controlResults",
    "rightControl",
    "controlActions",
  ])
    $(id).hidden = !control;
  $("stage1").classList.toggle("active", !control);
  $("stage2").classList.toggle("active", control);
  $("progress1").classList.toggle("current", !control);
  $("progress2").classList.toggle("current", control);
  $("viewTitle").textContent = control ? "控制与协同探测" : "任务海域";
  $("viewSubtitle").textContent = control
    ? "独立仿真 · 同条件对比"
    : "场景可编辑";
  $("sceneHint").textContent = control
    ? "滚轮缩放 · 拖动旋转 · 从左侧选择观测无人艇"
    : "左键拖动目标 / 艇 / 岛屿 · 拖动空白旋转 · 滚轮缩放";
  view.editable = !control;
  if (control) resetRuns();
  else {
    second?.dispose();
    second = null;
    $("viewB").hidden = true;
    view.refresh();
    view.clear(view.trailGroup);
    view.paths(plans, chosen);
    $("badgeA").innerHTML = "PLANNING <span>场景预览</span>";
  }
  $("missionState").textContent = control ? "准备航行" : "规划完成";
  $("planningControls").scrollTop = 0;
  $("controlControls").scrollTop = 0;
  document.querySelector(".right").scrollTop = 0;
  if (window.innerWidth <= 800) window.scrollTo({ top: 0, behavior: "instant" });
}
function resetRuns() {
  running = false;
  $("missionState").textContent = "准备航行";
  $("run").textContent = "▶ 开始仿真";
  accum = 0;
  const mode = $("mode").value,
    kinds = mode === "both" ? ["ppc", "pd"] : [mode];
  runs = kinds.map((k) => makeRun(state, chosen, k));
  document.querySelector(".chart-legend").innerHTML = kinds
    .map(
      (k) =>
        `<span style="color:${k === "ppc" ? COLORS[0] : COLORS[2]}">━ ${k.toUpperCase()}</span>`,
    )
    .join("");
  $("badgeA").innerHTML =
    `${kinds[0].toUpperCase()} <span>${kinds[0] === "ppc" ? "预设性能控制" : "基准控制"}</span>`;
  second?.dispose();
  second = null;
  $("viewB").hidden = mode !== "both";
  if (mode === "both") {
    second = new OceanView($("viewB"), state, () => {});
    second.paths([], null);
  }
  view.clear(view.trailGroup);
  view.lastTrail = -1;
  requestAnimationFrame(() => {
    view.resize();
    view.home();
    second?.resize();
    second?.home();
  });
  view.paths([], null);
  $("dataSource").innerHTML = kinds
    .map(
      (k, i) => `<option value="${i}">${k.toUpperCase()} · 定位观测</option>`,
    )
    .join("");
  updateTelemetry();
}
$("enter").onclick = $("stage2").onclick = () => setStage(2);
$("back").onclick = $("stage1").onclick = () => setStage(1);
$("mode").onchange = resetRuns;
$("restart").onclick = resetRuns;
$("speed").onchange = (e) => (speed = +e.target.value);
$("run").onclick = () => {
  if (runs.every((r) => r.done)) {
    resetRuns();
  }
  running = !running;
  $("run").textContent = running ? "Ⅱ 暂停仿真" : "▶ 继续仿真";
  $("missionState").textContent = running ? "航行中" : "已暂停";
};
$("top").onclick = () => {
  view.home(true);
  second?.home(true);
};
$("home").onclick = () => {
  view.home();
  second?.home();
};
$("locate").onclick = () => view.focusObject(selected);
$("immersive").onclick = () => {
  const active = document.body.classList.toggle("immersive");
  $("immersive").textContent = active ? "⛶ 返回工作台" : "⛶ 纯海域";
  $("immersive").setAttribute("aria-pressed", String(active));
  requestAnimationFrame(() => {
    view.resize();
    second?.resize();
  });
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("immersive"))
    $("immersive").click();
});
$("selectedBoat").onchange = $("dataSource").onchange = updateTelemetry;
function fmt(n, d = 2) {
  return n === null || n === undefined ? "—" : n.toFixed(d);
}
function updateTelemetry() {
  if (stage !== 2) return;
  const r = runs[+$("dataSource").value || 0];
  if (!r) return;
  $("clock").textContent = `T + ${r.time.toFixed(1).padStart(5, "0")} s`;
  $("single").textContent = fmt(r.single);
  $("fused").textContent = fmt(r.fused);
  $("improvement").textContent =
    r.single > 0 ? `${((1 - r.fused / r.single) * 100).toFixed(1)}%` : "—";
  $("uuvList").innerHTML = Array.from({ length: 4 }, (_, i) => {
    const u = r.targets[i],
      p = u?.estimate;
    return `<div class="uuv-row"><div><b>◇ UUV-0${i + 1}</b><span>${u?.n || 0} 艇观测</span></div><small>${p ? `${fmt(p.x, 1)}, ${fmt(p.y, 1)}, ${fmt(p.z, 1)}` : "等待探测"}</small><p>协同误差 <b>${fmt(u?.error)} m</b>${p && !u.n ? " · 历史估计" : ""}</p></div>`;
  }).join("");
  const id = +$("selectedBoat").value,
    b = r.boats[id];
  $("boatDetail").textContent =
    `位置 (${fmt(b.x, 1)}, ${fmt(b.y, 1)}, 0) m · 跟踪误差 ${fmt(b.error)} m`;
  $("observations").innerHTML =
    r.observations
      .filter((o) => o.boat === id)
      .map(
        (o) =>
          `<div class="observation">UUV-0${o.target + 1}<b>误差 ${fmt(o.error)} m</b><small>(${fmt(o.x, 1)}, ${fmt(o.y, 1)}, ${fmt(o.z, 1)})</small></div>`,
      )
      .join("") || '<p class="hint">探测范围内暂无潜航器</p>';
  $("obsCount").textContent = `${r.observationHistory.length} 条记录`;
  if ($("observationDetails").open) {
    const filter = $("obsBoat").value,
      rows = r.observationHistory.filter(
        (o) => filter === "all" || o.boat === +filter,
      ),
      visible = rows.slice(-120).reverse();
    $("observationRows").innerHTML =
      visible
        .map(
          (o) =>
            `<tr><td><b>USV-${String(o.boat + 1).padStart(2, "0")}</b><small>UUV-0${o.target + 1} · ${fmt(o.time, 1)} s</small></td><td>${fmt(o.x, 1)}<br>${fmt(o.y, 1)}<br>${fmt(o.z, 1)}</td><td>${fmt(o.error)}</td></tr>`,
        )
        .join("") || '<tr><td colspan="3">尚无探测记录</td></tr>';
    $("recordLimit").textContent =
      `显示最近 ${visible.length} / ${rows.length} 条。导出数据包含保留的全部记录（最多 2000 条）。`;
  }
  $("trackingStats").innerHTML = runs
    .map(
      (r) =>
        `<span><i style="background:${r.kind === "ppc" ? COLORS[0] : COLORS[2]}"></i>${r.kind.toUpperCase()} RMSE <b>${fmt(r.rms)} m</b><small>最近艇间距 ${Number.isFinite(r.minSeparation) ? fmt(r.minSeparation, 1) : "—"} m · 避碰已启用</small></span>`,
    )
    .join("");
  const maxT = Math.max(30, r.time),
    maxY =
      Math.max(3, ...runs.flatMap((r) => r.history.map((h) => h.rms))) * 1.2;
  let svg = "";
  for (let i = 0; i < 4; i++) {
    const y = 12 + i * 30;
    svg += `<line x1="30" y1="${y}" x2="295" y2="${y}" stroke="#244052" stroke-dasharray="3 5"/><text x="2" y="${y + 4}" fill="#7894a9" font-size="11">${(maxY * (1 - i / 3)).toFixed(1)}</text>`;
  }
  runs.forEach((r) => {
    svg += `<polyline fill="none" stroke="${r.kind === "ppc" ? COLORS[0] : COLORS[2]}" stroke-width="2" points="${r.history.map((h) => `${30 + (h.t / maxT) * 265},${102 - (h.rms / maxY) * 90}`).join(" ")}"/>`;
  });
  svg += `<text x="30" y="125" fill="#7894a9" font-size="11">0 s</text><text x="252" y="125" fill="#7894a9" font-size="11">${maxT.toFixed(0)} s</text>`;
  $("chart").setAttribute("viewBox", "0 0 300 130");
  $("chart").innerHTML = svg;
}
$("export").onclick = () => {
  const data = {
    version: 1,
    coordinateSystem: "East, North, Height (m)",
    assumptions:
      "二维全驱动质点；独立高斯观测；对角协方差随机游走卡尔曼滤波；艇间速度屏障避碰与连续步长安全检查",
    scene: state,
    plans,
    selected: chosen?.kind,
    stage,
    runs,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `usv-simulation-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("场景、规划和当前仿真数据已导出");
};
syncEditor();
renderTargets();
let last = performance.now();
function animate(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  elapsed += dt;
  if (stage === 2 && running) {
    accum += dt * speed;
    while (accum >= 0.05) {
      runs.forEach((r) => tick(r, state, 0.05));
      accum -= 0.05;
    }
    if (runs.every((r) => r.done)) {
      running = false;
      $("missionState").textContent = "任务完成";
      $("run").textContent = "↺ 重新演示";
      toast("所有无人艇已完成航路跟踪");
    }
  }
  view.render(
    elapsed,
    stage === 2 ? runs[0] : null,
    stage === 2 ? +$("selectedBoat").value : 0,
    stage === 2 ? $("sonar").checked : false,
  );
  second?.render(
    elapsed,
    runs[1],
    +$("selectedBoat").value,
    $("sonar").checked,
  );
  if (now - uiTime > 250) {
    updateTelemetry();
    uiTime = now;
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
