# 新手交接指南：无人艇集群仿真平台

更新日期：2026-10-14。本文对应仓库当前 JavaScript 原型；神经网络接入与 TypeScript 迁移均为后续方案，尚未实现。

> **接手者先看这里：先运行现有项目，再选择一个算法模块改造。主要开发语言为 JavaScript / TypeScript，交付软件不依赖 Python、训练服务或在线推理接口。**

## 目录

- [1. 项目现状与交接目标](#1-项目现状与交接目标)
- [2. 从零运行](#2-从零运行)
- [3. 代码地图与阅读顺序](#3-代码地图与阅读顺序)
- [4. 数据流、坐标与接口](#4-数据流坐标与接口)
- [5. 神经网络应该接在哪里](#5-神经网络应该接在哪里)
- [6. 轻量化模型与运行方案](#6-轻量化模型与运行方案)
- [7. 渐进迁移到 TypeScript](#7-渐进迁移到-typescript)
- [8. 实验数据与验证](#8-实验数据与验证)
- [9. 桌面版与常见问题](#9-桌面版与常见问题)
- [10. 接手后的实施清单](#10-接手后的实施清单)

## 1. 项目现状与交接目标

这是 Three.js + Vite 构建的交互式仿真原型，业务代码是原生 JavaScript ES Modules，不使用 React / Vue。Tauri 2 提供 Windows 桌面外壳，Rust 目前承担外壳启动而非神经网络计算。仓库已有桌面 EXE，但它是历史构建产物，修改源码后不会自动更新。

已有功能：30 艘无人艇、3 个任务编队/水面目标、4 座海岛、4 个模拟 UUV；编辑场景；短路径与覆盖导向两种规划；PPC / PD 控制及双屏比较；避障、艇间避碰与拥堵恢复；模拟观测、卡尔曼融合与 JSON 导出。

尚未实现：神经网络、模型训练/推理接口、TypeScript 类型检查、真实声呐及水动力、完整实验数据集记录器、场景 JSON 导入。不要把界面中的定位精度或控制曲线直接当作真实海试结论。模型、噪声和算法限制见 [README](README.md)。

交接方向：新增算法优先使用 TypeScript；保持浏览器及 Tauri 本地运行；不要求用户安装 Python、PyTorch、CUDA 或启动后端。训练也优先用 JS/TS 独立工具完成；如果已有其他语言训练的模型，可在研发阶段转换权重或导出模型，最终软件仍只运行 JS/TS 推理。改语言本身不会保证体积或速度改善，必须测量。

## 2. 从零运行

需要 Git、Node.js（含 npm）和支持 WebGL 的浏览器。本次交接检查环境是 Node.js 24.14.0、npm 11.14.1；其他版本未逐一验证。开发时可以使用 VS Code。仅运行网页版无需 Rust。

```powershell
git clone https://github.com/ZHT1235456/three-js-usv-swarm-simulation.git
cd three-js-usv-swarm-simulation
npm ci
npm run dev
```

打开终端显示的地址，默认是 `http://127.0.0.1:5173`。保持终端运行；按 Ctrl+C 停止。第一次安装依赖需要网络。不要直接双击 `index.html`，入口需要 Vite 处理 ES Modules、依赖和 Worker。

第一次操作：保持默认场景 → 运行双算法规划 → 选择方案 → 进入控制阶段 → 选择 PPC、PD 或双屏 → 开始仿真 → 查看单艇定位明细和曲线 → 导出数据。

```powershell
npm test
npm run build
```

`npm test` 使用 Node 内置测试器；`npm run build` 生成 `dist/`。预览构建可运行 `npx vite preview --host 127.0.0.1`，访问它显示的地址；这不是桌面打包。复现依赖优先用 `npm ci`，有意增加或更新依赖才用 `npm install` 并提交锁文件。

## 3. 代码地图与阅读顺序

| 文件/目录 | 职责 | 接手时关注点 |
| --- | --- | --- |
| `package.json` / `package-lock.json` | 命令、依赖及依赖锁定 | 当前没有 TS 或神经网络运行库 |
| `index.html` | 页面入口 | JS 入口引用 |
| `src/main.js` | 页面模板、按钮事件、阶段切换、状态、仿真循环、导出 | 算法选项与 UI 集成 |
| `src/simulation.js` | 默认场景、规划、参考轨迹、控制、观测和融合 | 算法改造的主要入口 |
| `src/planner.worker.js` | 在 Worker 中执行规划并返回结果/错误 | 规划不会在主线程直接计算 |
| `src/paths.js` | 距离、采样、贝塞尔平滑、航路间距代价 | 规划输出与安全检查 |
| `src/avoidance.js` | 艇间运动安全层、连续运动最小距离 | 新控制器仍需经过此层 |
| `src/scene.js` | `OceanView`、Three.js 场景、相机、拖动和渲染 | 不应承担训练或模型业务逻辑 |
| `src/models.js` / `src/models/` | 无人艇几何模型 | 外观修改 |
| `src/islands.js` / `src/uuv.js` | 海岛和 UUV 外观 | `uuv.js` 是建模，不是定位算法 |
| `src/style.css` / `src/workbench.css` | 页面样式 | UI 修改 |
| `public/textures/` | 本地海面法线贴图 | 离线资产 |
| `tests/simulation.test.js` | 规划、控制、安全和定位回归测试 | 修改算法后的验证基线 |
| `src-tauri/` | Tauri 配置、Rust 外壳、图标 | 桌面开发与打包 |
| `release/无人艇集群仿真平台.exe` | 已保存的桌面程序 | 历史产物，需重新构建才能反映改动 |
| `notes/` | 水面笔记及参考艇原始代码 | 参考资料，运行入口在 `src/` |
| `项目要求.txt` | 原始需求 | 与已实现行为共同阅读 |

建议阅读：README → 本文 → `defaults` → `plan` → `reference` → `makeRun` → `tick` → `avoidBoats` → `main.js` 的 `animate` 与导出事件 → 渲染代码。用编辑器搜索函数名比从头读整个文件更容易。

## 4. 数据流、坐标与接口

流程：`defaults()` 创建场景 → 编辑场景 → `main.js` 将快照发送给规划 Worker → `plan(scene, kind)` 返回两种方案 → 用户选择 → `makeRun(scene, plan, kind)` 创建独立运行状态 → `animate` 用固定步长调用 `tick` → `OceanView.render` 展示结果 → 导出当前状态。

| 数据 | 实际字段/约定 |
| --- | --- |
| 场景 | `radius` 是探测半径；`boats`、`targets`、`islands` 为数组 |
| 无人艇 | `id` 从 0 开始，`team` 为 0/1/2，`x/y` 为东/北坐标 |
| 海岛 | `x/y/r` 为保守圆形障碍；部分有外观 `aspect/angle` |
| 规划种类 | `short`、`coverage` |
| 规划结果 | `kind, paths, goals, length, area, ratio, time`；`paths[b.id]` 是该艇航点数组 |
| 控制种类 | `ppc`、`pd` |
| 参考状态 | `reference(path,t)` 返回 `x,y,vx,vy`，参考航速 6 m/s |
| 运行状态 | `time, boats, plan, filters, targets, observations, observationHistory, history` 等 |
| 单次观测 | `boat, target, x,y,z, error, variance`；历史记录增加 `time` |
| 融合状态 | 每个 UUV 一个 `{x,y,z,p}` 或 `null`，`p` 是标量方差 |

所有物理长度用米、时间用秒、速度用 m/s。仿真数据 `(x,y,z)` = `(东 E, 北 N, 高 H)`，水下 `z` 为负；Three.js 的显示坐标映射为 `(E,H,-N)`。训练和推理要使用物理坐标，不要直接把 Three.js 的 `position` 当输入。

`main.js` 固定积分步长为 0.05 s；1×/2×/4×改变推进速度，不改变积分步长。观测/融合每 0.5 s 更新，界面约每 250 ms 刷新，渲染由动画帧驱动。四个节奏不同，推理结果必须携带仿真时刻。

当前代码多处假定 30 艘艇、每队 10 艘、3 个编队及4个 UUV；`id` 还被用作数组索引。增减数量或调整 ID 时，要同时检查默认场景、规划分配、循环、RMSE 分母、UI、渲染及测试，不能只修改数组长度。

## 5. 神经网络应该接在哪里

先确定研究任务。下表是建议扩展点，当前没有这些模型接口。

| 任务 | 现有代码位置 | 建议输入/输出 | 必须保留的约束 |
| --- | --- | --- | --- |
| 路径规划 | `simulation.js` 的 `plan`、`planner.worker.js` | 场景/编队/障碍 → 每艇航点或代价 | 合法端点、完整线段安全、平滑、覆盖/航程评估 |
| 路径跟踪 | `tick` 内 PPC / PD 指令生成部分 | 艇状态、参考状态、误差、邻艇/障碍 → 指令速度或残差 | 限幅、岛屿检查、`avoidBoats`、恢复逻辑 |
| 协同定位 | `tick` 内观测后的滤波融合部分 | 当前及历史有效观测、时间、方差、艇位置 → UUV 坐标/不确定度 | 缺失观测处理、坐标约定、独立状态 |

建议第一次从定位模块或现有控制器的残差补偿开始，缩小改造范围；这是工程建议，不是已有功能。保留 PPC、PD、卡尔曼作为可切换基线。

**控制器接入特别注意：** 当前 `tick` 只有 `if (run.kind === "ppc") ... else ...`，其他名称都会进入 PD 分支。增加 `nn` 必须改成明确的分支，同时修改 UI、运行创建、双屏配色、导出和测试。不要把模型输出直接写成最终艇位置，应产生候选动作，再经过已有安全层。最终速度可能被避碰和恢复机制改变，评估时记录原指令与执行结果。

**定位接入特别注意：** 真值在 `truth(i,t)`；观测是带噪的模拟坐标，尚无原始声呐量测。`truth` 和 `error` 只能作为训练标签/评估数据，不能作为上线推理输入，否则发生数据泄漏。当前观测记录没有艇位置，若模型需要观测艇状态，必须在采样时另外记录，不能用导出时的最终艇位置代替历史位置。无观测时不得把历史估计伪装为当前新观测。

## 6. 轻量化模型与运行方案

目标是最终浏览器/Tauri 中本地推理，不捆绑训练环境。训练应在单独的 JS/TS 开发脚本或工具项目中进行，完成后只交付权重、预处理参数和模型说明。当前仓库没有训练工具，应在任务确定后再选择、实现和验证；无需为交接提前加入整套依赖。

可按模型复杂度选择：

1. **小型全连接网络优先评估纯 JS/TS 推理。** 将权重保存为 JSON 或二进制，使用数组/TypedArray 实现前向运算。这是工程方案建议；需要用固定输入对照训练端输出，验证矩阵排列、偏置、激活和数值误差。
2. **需要标准模型文件时评估 ONNX Runtime Web。** 它提供 JavaScript API、本地 WASM 推理及可选 GPU 后端。官方部署指南支持只导入 WASM 入口以减少 JS 包体；具体算子、WASM 文件和模型兼容性仍需对实际模型验证。见 [官方入门](https://onnxruntime.ai/docs/get-started/with-javascript/web.html) 与 [部署指南](https://onnxruntime.ai/docs/tutorials/web/deploy.html)。这不意味着需要 Python 运行环境，也不意味着现有 JS 训练工具一定能直接导出 ONNX。
3. **WebGPU 仅作为后续优化。** 先用 CPU/WASM 测出瓶颈，再检查目标浏览器和 WebView2 的设备支持，并保留回退。小模型也可能因 GPU 调度/数据传输而得不偿失；实际速度由测试决定。参见 [官方 WebGPU 指南](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)。

不要同时引入多个推理框架。资产应随软件本地提供，模型/WASM 加载路径分别在 Vite 开发、构建预览和 Tauri 成品中验证；避免运行时从 CDN 下载。模型加载一次、暖机一次，不要每帧初始化。按需启用神经网络功能，复用输入输出缓冲区，合理处理会话释放。

建议新增结构（尚不存在）：`src/algorithms/` 放纯算法与接口；`src/inference/` 放模型加载及前后处理；专用 Worker 承担异步推理；`public/models/` 保存部署模型；独立 `tools/` 保存训练/数据处理；记录模型版本、输入顺序、张量形状、单位、归一化均值/尺度、输出含义和适用场景。

接口设计示例（只展示数据契约，不是可直接启用的控制器）：

```ts
type ControllerInput = {
  boatId: number;
  simTime: number;
  positionEN: [number, number];
  velocityEN: [number, number];
  referenceEN: [number, number];
  referenceVelocityEN: [number, number];
};
type ControllerOutput = {
  boatId: number;
  simTime: number;
  commandVelocityEN: [number, number];
};
```

上述示例未包含邻艇、障碍或历史窗口，实际模型需要什么就扩展什么。记录固定输入顺序，检查有限数值和形状。每次场景编辑、重新规划或重置运行都要递增任务版本，丢弃旧 Worker 的迟到结果。

`tick` 目前同步执行，不能直接塞入 `await session.run()`。异步方案需在 Worker 中推理、按时间/艇 ID/运行 ID 匹配结果，并明确有效期及回退策略；超时、加载失败、NaN、过期结果都回退基线。不得令整个 20 Hz 仿真等待推理。双屏两次运行的缓存、历史和滤波状态必须独立。

轻量化验收记录至少包括：模型文件大小、`dist` 大小、EXE 大小、首次启动/模型加载时长、稳态内存、30艇批量推理耗时的中位数及 P95、帧率、单/双屏差别。固定步长 50 ms 不等于模型独占 50 ms；计算与渲染都需要预算。减少更新频率或量化权重前后，必须同时比较精度和安全指标。

## 7. 渐进迁移到 TypeScript

当前没有 `tsconfig.json`、TypeScript 依赖或 `typecheck` 命令。下面是后续步骤，不是本次交接已完成的迁移。

1. 新建算法接口及模型模块使用 `.ts`；为场景、规划、观测、运行状态定义类型；先不重写渲染及页面模板。
2. 添加 `typescript`、`@types/three` 开发依赖；采用 `allowJs: true`、`noEmit: true` 的渐进配置，让 JS 和 TS 共存，再逐步提高检查范围。
3. 增加 `typecheck` 脚本执行 `tsc --noEmit`。Vite 转译 TS 与类型检查是两件事，构建成功不能代替类型检查。
4. 分文件迁移纯算法；同步检查导入后缀、Worker 入口、浏览器构建和 Tauri 打包。
5. 当前 Node 测试直接导入 `.js`，迁移文件后需要选择明确的 TS 测试运行方式或先编译再测试，不能假设原测试命令自动兼容。

参考 [TypeScript 官方迁移指南](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html)。迁移不会自动减小部署体积，类型帮助约束接口；运行时真正部署的是转译后的 JS。

## 8. 实验数据与验证

导出在 `main.js` 的 `export` 按钮事件中：顶层包含 `version:1`、`coordinateSystem`、`assumptions`、`scene`、`plans`、`selected`、`stage` 和 `runs`。当前没有对应的导入功能。

每个运行保留最近 600 个统计样本及最近 2000 条单艇观测；尾迹只保留短窗口，因此导出不是完整训练集。训练数据应通过专门记录器持续保存，包含采样时的场景版本、艇位置、输入、标签、控制指令、实际执行动作和模型版本，避免增加无限内存数组。

不要把同一条轨迹相邻帧随机拆进训练集和测试集；按场景或完整运行划分数据，保留未训练的岛屿/起点组合。当前噪声由时间、艇 ID 和目标 ID 确定生成，重复默认运行不是新的独立随机实验；多种噪声实验需要显式种子方案。

指标解释：路径长度/覆盖是规划指标；`rms` 是所有艇对参考路径的瞬时 RMSE；`single` 是有效单艇观测三维误差平均；`fused` 是有观测 UUV 的融合三维误差平均。后两者权重不同，提升率可能为负。无观测为 `null`，JSON 中非有限数值也可能变成 `null`，处理导出数据时要区分语义。

现有测试覆盖规划、平滑后的障碍安全/编队间距、艇间连续安全、默认规划与控制组合完成，以及定位数据。修改后先运行 `npm test` 和 `npm run build`；再手动检查默认场景、编辑后重规划、双屏状态、单艇筛选和导出。

模型接入后新增有意义的检查：固定输入与训练端输出对照；输入错误/缺失观测；模型失败与超时回退；30艇批处理；场景重置后丢弃旧结果；安全层是否仍生效；独立双屏状态。默认场景通过不代表任意场景安全或无死锁。

## 9. 桌面版与常见问题

网页版开发通过后再打包桌面版。源码构建需要 Rust/Cargo、Windows C++ 构建工具及 WebView2 环境；`Cargo.toml` 声明最低 Rust 1.77，实际依赖是否可用以构建结果为准。

```powershell
npm run tauri -- dev
npm run desktop
```

`desktop` 实际是 `tauri build --no-bundle`：先构建前端，再生成桌面可执行文件，通常在 `src-tauri/target/release/`；查看命令输出确认文件名。它不自动覆盖仓库 `release/` 的 EXE。如需制作配置中的 NSIS 安装包，运行 `npm run tauri -- build` 并检查 bundle 输出。配置的 WebView 安装模式为 `skip`，安装包不会替目标机器安装 WebView2；测试接收者机器是否已具备运行环境。

| 现象 | 排查 |
| --- | --- |
| 5173 端口占用 | `vite.config.js` 为固定端口且 `strictPort:true`；停止旧进程，或同时调整 Vite 与 Tauri `devUrl` |
| 页面空白/无海面 | 检查终端、浏览器控制台、WebGL/显卡支持和资源请求；不要直接打开 HTML 文件 |
| 规划报起点/目标非法 | 调整对象，避开岛屿半径 + 16m 安全区与任务边界；重新规划 |
| 修改场景后无法继续原方案 | 修改使原规划失效，需要重算 |
| 控制未完成 | 检查场景拥堵、安全干预和终点条件；不要删掉安全层来掩盖问题 |
| 无定位观测 | 检查探测半径和艇-UUV 的三维距离；水下深度也计入距离 |
| 离线字体变化 | 字体联网失败会回退系统字体，不影响仿真算法 |
| 更新代码但 EXE 没变 | 必须重新运行桌面构建并显式更新发布产物 |

## 10. 接手后的实施清单

- 第一次：克隆、`npm ci`、运行默认流程、测试、构建、导出一份样例，记下环境版本与 Git 提交号。
- 第一阶段：读核心函数，确定神经网络要解决规划/控制/定位中的哪一个任务，以及输入、输出、基线与验收指标。
- 第二阶段：建立 JS/TS 类型及数据记录器，固定单位、归一化、数据划分和模型版本；训练工具独立于最终软件。
- 第三阶段：先以固定输入验证本地前向推理，再接 Worker 和回退机制；保持原算法可用。
- 第四阶段：比较精度、安全、任务完成、体积、启动与耗时，测试低配置机器、断网和双屏，最后重新打包。

日常提交示例（把分支名换成自己的任务）：

```powershell
git switch -c codex/nn-localization
# 编辑并验证后，只暂存本次任务相关文件
git add src/algorithms src/inference
# 上面路径仅为未来示例，需要先创建对应文件
git commit -m "feat: add local neural localization adapter"
git push -u origin codex/nn-localization
```

提交源码、锁文件、必要模型资产和说明；不提交 `node_modules`、`dist`、Rust `target`、临时训练输出或凭据。模型较大时单独规划 GitHub Release/LFS 交付方式。仓库公开并不自动授予参考代码、纹理或模型权重的再分发许可；正式对外发布前核实来源与许可，当前交接不擅自新增授权声明。

每次交付应包含：源代码提交号、启动步骤、模型及预处理版本、基线对比、测试结果、体积/性能记录和已知限制。让下一位开发者能复现，而不仅是看到演示。
