import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { buildAdditionalVessels } from './vessels.js';
import { buildCollection } from './collection.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { ocean: true, paused: reducedMotion, labels: true, sunset: false, sea: 0.2, selected: -1 };
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, preserveDrawingBuffer: true });
} catch (error) {
  $('loading').innerHTML = '<p>无法启动三维场景，请启用浏览器硬件加速后刷新页面。</p>';
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 800);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 7;
controls.maxDistance = 32;
controls.maxPolarAngle = Math.PI * 0.485;
controls.autoRotateSpeed = 0.55;
let boat = new THREE.Group();
boat.name = 'ASTRA P0 · 双体测绘原型艇';
scene.add(boat);
const mat = {
  white: new THREE.MeshStandardMaterial({ color: '#f2f4ee', roughness: 0.32, metalness: 0.22 }),
  orange: new THREE.MeshStandardMaterial({ color: '#e87236', roughness: 0.33, metalness: 0.15 }),
  dark: new THREE.MeshStandardMaterial({ color: '#273940', roughness: 0.53, metalness: 0.35 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#1b262b', roughness: 0.86 }),
  metal: new THREE.MeshStandardMaterial({ color: '#a4b2b4', roughness: 0.27, metalness: 0.83 }),
  deck: new THREE.MeshStandardMaterial({ color: '#c9d5d5', roughness: 0.83, metalness: 0.16 }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#153d4c', metalness: 0.65, roughness: 0.12, clearcoat: 1 }),
  lens: new THREE.MeshPhysicalMaterial({ color: '#205674', metalness: 0.75, roughness: 0.08, clearcoat: 1 }),
  red: new THREE.MeshStandardMaterial({ color: '#b84435', emissive: '#f13923', emissiveIntensity: 1.2 }),
  green: new THREE.MeshStandardMaterial({ color: '#287c5d', emissive: '#26e19b', emissiveIntensity: 1.2 }),
};
const parts = {};
function group(name, parent = boat) { const g = new THREE.Group(); g.name = name; parent.add(g); return g; }
function mesh(geo, material, pos, parent = boat, name = '') {
  const m = new THREE.Mesh(geo, material); m.position.set(...pos); m.name = name;
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function box(size, pos, material = mat.white, parent = boat, radius = 0.035, name = '') {
  return mesh(new RoundedBoxGeometry(...size, 2, radius), material, pos, parent, name);
}
function cylinder(rt, rb, h, pos, material = mat.metal, parent = boat, n = 20) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, n), material, pos, parent);
}
function rod(a, b, r = 0.018, material = mat.metal, parent = boat) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.clone().sub(av);
  const m = cylinder(r, r, delta.length(), av.clone().add(bv).multiplyScalar(.5).toArray(), material, parent, 10);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return m;
}
function tube(points, radius, material, parent = boat) {
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), points.length * 8, radius, 8, false), material, [0, 0, 0], parent);
}
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
const solarTexture = canvasTexture(512, 1024, (c, w, h) => {
  c.fillStyle = '#1c303e'; c.fillRect(0, 0, w, h);
  for (let col = 0; col < 6; col++) for (let row = 0; row < 12; row++) {
    const x = 7 + col * 84, y = 7 + row * 84;
    c.fillStyle = (col + row) % 3 === 0 ? '#203f56' : '#19364c';
    c.beginPath(); c.roundRect(x, y, 78, 78, 6); c.fill();
    c.strokeStyle = '#527086'; c.lineWidth = .8;
    for (let k = 1; k < 8; k++) { c.beginPath(); c.moveTo(x, y + k * 10); c.lineTo(x + 78, y + k * 10); c.stroke(); }
    c.strokeStyle = '#9faea9'; c.lineWidth = 1.1;
    for (const dx of [24, 54]) { c.beginPath(); c.moveTo(x + dx, y); c.lineTo(x + dx, y + 78); c.stroke(); }
  }
});
const solarMat = new THREE.MeshPhysicalMaterial({ map: solarTexture, metalness: .05, roughness: .48, clearcoat: 0, envMapIntensity: .25 });
const deckTexture = canvasTexture(256, 256, c => {
  c.fillStyle = '#c4ceca'; c.fillRect(0, 0, 256, 256); c.strokeStyle = '#a8b5b2'; c.lineWidth = 1.5;
  for (let x = -256; x < 512; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 256, 256); c.stroke(); }
});
deckTexture.wrapS = deckTexture.wrapT = THREE.RepeatWrapping; deckTexture.repeat.set(3, 6);
const nonSlip = new THREE.MeshStandardMaterial({ map: deckTexture, roughness: .9, metalness: .13 });

// The hull is lofted across twelve sections, with separate chine and gunwale faces.
const stations = [ [-3.8,.43],[-3.55,.53],[-2.6,.59],[-1.3,.62],[0,.62],[1.35,.60],[2.35,.52],[3.05,.36],[3.55,.18],[3.9,.055],[4,.012] ];
const ring = [[-.9,.68],[-1,.49],[-1,.23],[-.77,-.32],[-.3,-.57],[.3,-.57],[.77,-.32],[1,.23],[1,.49],[.9,.68]];
function hull(cx) {
  const g = group(cx < 0 ? '左舷浮体' : '右舷浮体');
  const vertices = [], indices = [], geo = new THREE.BufferGeometry();
  stations.forEach(([z, w]) => ring.forEach(([x, y]) => vertices.push(cx + x*w, y + Math.max(0,z-2.1)*.07, z)));
  for (let s=0;s<stations.length-1;s++) for (let j=0;j<ring.length;j++) {
    const a=s*10+j,b=s*10+(j+1)%10,c=(s+1)*10+j,d=(s+1)*10+(j+1)%10;
    const start=indices.length; indices.push(a,b,c,b,d,c); geo.addGroup(start,6,j===0||j===8 ? 1 : j===9 ? 2 : 0);
  }
  for (let j=1;j<9;j++) { const start=indices.length;indices.push(0,j+1,j); geo.addGroup(start,3,0); }
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
  mesh(geo,[mat.white,mat.orange,mat.deck],[0,0,0],g,'分段放样复合材料艇壳');
  for (const sign of [-1,1]) {
    const points=stations.slice(0,-1).map(([z,w])=>[cx+sign*w*1.015,.45+Math.max(0,z-2.1)*.07,z]);
    tube(points,.045,mat.rubber,g);
    const waterline=stations.slice(0,-2).map(([z,w])=>[cx+sign*w*.89,-.02+Math.max(0,z-2.1)*.07,z]);
    tube(waterline,.015,mat.dark,g);
  }
  for(const z of [-2.9,2.5]) {
    box([.47,.04,.55],[cx,.74,z],mat.dark,g,.03);
    box([.40,.025,.48],[cx,.766,z],nonSlip,g,.02);
    for(const dx of [-.16,.16])for(const dz of [-.19,.19])cylinder(.016,.016,.009,[cx+dx,.785,z+dz],mat.metal,g,8);
  }
  // Lifting eyes, mooring cleats, and gunwale fasteners.
  for(const z of [-3.35,2.95]) {
    for(const dx of [-.13,.13])cylinder(.027,.035,.10,[cx+dx,.82,z],mat.metal,g);
    rod([cx-.24,.87,z],[cx+.24,.87,z],.032,mat.metal,g);
  }
  for(const z of [-2.2,-.9,.4,1.7])for(const dx of [-.48,.48])cylinder(.018,.018,.008,[cx+dx,.705,z],mat.metal,g,8);
  return g;
}
parts.hulls = [hull(-1.12), hull(1.12)];
const deck = group('连接桥与防滑工作甲板');
box([2.7,.23,4.95],[0,.71,-.38],mat.white,deck,.12);
box([2.52,.05,4.73],[0,.854,-.38],nonSlip,deck,.075);
for(const x of [-1.28,1.28])box([.07,.065,4.7],[x,.88,-.38],mat.metal,deck,.012);
for(const z of [-2.4,1.2])box([2.95,.23,.22],[0,.44,z],mat.dark,deck);
// Foredeck instrument mount and towing point.
box([1.16,.11,1.2],[0,.78,2.62],mat.white,deck,.13);
box([.55,.07,.75],[0,.88,2.6],nonSlip,deck);
const eye=mesh(new THREE.TorusGeometry(.10,.026,10,24),mat.metal,[0,1.0,3.05],deck);eye.rotation.y=Math.PI/2;

parts.energy=group('太阳能阵列与电子设备舱');
box([1.86,.71,2.72],[0,1.18,-.36],mat.white,parts.energy,.17);
box([1.89,.09,2.76],[0,1.51,-.36],mat.dark,parts.energy,.06);
for (const x of [-.48,.48]) {
  box([.88,.065,2.58],[x,1.58,-.36],mat.metal,parts.energy,.025);
  const panel=mesh(new THREE.PlaneGeometry(.81,2.5),solarMat,[x,1.616,-.36],parts.energy,'单晶硅太阳能电池板');panel.rotation.x=-Math.PI/2;
}
for(const x of [-.943,.943]) {
  for(let i=0;i<12;i++)box([.019,.18,.037],[x,1.17,-1.32+i*.105],mat.dark,parts.energy,.004);
  for(const z of [-1.6,.78])box([.035,.21,.08],[x,1.23,z],mat.metal,parts.energy,.007);
}
box([1.19,.31,.045],[0,1.18,1.025],mat.glass,parts.energy,.05);
for (const x of [-.75,.75])cylinder(.035,.035,.02,[x,1.54,.87],mat.metal,parts.energy);

function label(text,w,h,fg='#263f49',bg=null) {
  return canvasTexture(w,h,(c)=>{ if(bg){c.fillStyle=bg;c.fillRect(0,0,w,h);}c.fillStyle=fg;c.font=`600 ${h*.53}px Bahnschrift, Arial`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h*.52); });
}
const brandMat=new THREE.MeshStandardMaterial({map:label('ASTRA  P0',1024,192),transparent:true,roughness:.5,polygonOffset:true,polygonOffsetFactor:-2});
for(const x of [-1,1]) {
  const l=mesh(new THREE.PlaneGeometry(2.05,.385),brandMat,[x*1.743,.25,-.48],boat,'船体编号');
  l.rotation.y=x*Math.PI/2;
}
const deckMark=mesh(new THREE.PlaneGeometry(.58,.16),new THREE.MeshStandardMaterial({map:label('ASTRA',512,128,'#e8edee'),transparent:true}),[0,1.192,1.053],parts.energy);

parts.sensors=group('传感桅杆与自主导航');
box([.66,.14,.67],[0,.98,-2.0],mat.dark,parts.sensors);
box([.35,.87,.36],[0,1.45,-2],mat.orange,parts.sensors,.08);
cylinder(.11,.14,1.25,[0,2.41,-2],mat.white,parts.sensors);
for(const x of [-.48,.48])rod([x,.93,-2.28],[0,2.13,-2],.035,mat.metal,parts.sensors);
tube([[.14,1.05,-1.85],[.18,1.65,-1.85],[.14,2.14,-1.89],[.13,2.75,-1.94]],.018,mat.rubber,parts.sensors);
box([1.74,.075,.16],[0,2.6,-2],mat.dark,parts.sensors);
for(const x of [-.78,.78]) {
  cylinder(.025,.035,.29,[x,2.76,-2],mat.metal,parts.sensors);
  cylinder(.14,.11,.07,[x,2.925,-2],mat.white,parts.sensors,28);
  mesh(new THREE.SphereGeometry(.12,24,12,0,Math.PI*2,0,Math.PI/2),mat.white,[x,2.956,-2],parts.sensors);
}
// Radar radome, rotating scanner, navigation lamps, and antennas.
cylinder(.26,.22,.09,[0,3.055,-2],mat.dark,parts.sensors,32);
cylinder(.27,.25,.22,[0,3.20,-2],mat.white,parts.sensors,32);
const radar=group('雷达扫描阵列',parts.sensors);radar.position.set(0,3.37,-2);
box([1.13,.14,.2],[0,0,0],mat.white,radar,.06);
box([.86,.062,.012],[0,0,.102],mat.dark,radar,.01);
for(const x of [-.38,.38]) {
  rod([x,2.65,-2.16],[x,3.43,-2.16],.012,mat.dark,parts.sensors);
  cylinder(.023,.023,.13,[x,2.73,-2.16],mat.rubber,parts.sensors);
}
rod([.38,3.43,-2.16],[.38,3.7,-2.16],.007,mat.metal,parts.sensors);
for(const x of [-1.35,1.35]) {
  box([.15,.12,.22],[x,.94,.6],mat.dark,boat);
  box([.14,.075,.14],[x,1.02,.6],x<0?mat.red:mat.green,boat);
}
// Forward optical/thermal stabilized gimbal.
parts.camera=group('光电感知吊舱');
cylinder(.15,.21,.13,[0,1.00,2.45],mat.dark,parts.camera);
cylinder(.075,.10,.23,[0,1.18,2.45],mat.metal,parts.camera);
box([.51,.12,.37],[0,1.3,2.45],mat.dark,parts.camera,.04);
for(const x of [-.21,.21])box([.07,.28,.27],[x,1.40,2.45],mat.white,parts.camera);
const gimbal=mesh(new THREE.SphereGeometry(.225,32,20),mat.white,[0,1.49,2.45],parts.camera);
for(const [x,r] of [[-.08,.09],[.105,.055]]) {
  const housing=cylinder(r*1.2,r*1.2,.065,[x,1.51,2.647],mat.dark,parts.camera,24);housing.rotation.x=Math.PI/2;
  const lens=cylinder(r,r,.008,[x,1.51,2.684],mat.lens,parts.camera,32);lens.rotation.x=Math.PI/2;
}
// Lidar beneath the front edge of the sensor platform.
cylinder(.17,.17,.18,[0,2.22,-1.78],mat.dark,parts.sensors,28);
cylinder(.176,.176,.05,[0,2.235,-1.78],mat.glass,parts.sensors,28);
box([.31,.055,.30],[0,2.345,-1.78],mat.white,parts.sensors);

parts.propulsion=group('双电机与导管推进器');
const propellers=[];
for(const x of [-1.12,1.12]) {
  box([.34,.13,.40],[x,.72,-3.40],mat.dark,parts.propulsion);
  box([.12,.65,.18],[x,.29,-3.72],mat.metal,parts.propulsion);
  const motor=cylinder(.16,.19,.52,[x,-.19,-3.63],mat.dark,parts.propulsion,24);motor.rotation.x=Math.PI/2;
  const duct=mesh(new THREE.TorusGeometry(.275,.049,12,36),mat.metal,[x,-.19,-3.94],parts.propulsion,'推进器保护导管');
  for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])rod([x,-.19,-3.94],[x+Math.cos(a)*.27,-.19+Math.sin(a)*.27,-3.94],.016,mat.metal,parts.propulsion);
  const rotor=group('三叶螺旋桨',parts.propulsion);rotor.position.set(x,-.19,-3.96);
  const hub=cylinder(.065,.08,.11,[0,0,0],mat.orange,rotor);hub.rotation.x=Math.PI/2;
  for(let j=0;j<3;j++) {
    const blade=box([.115,.22,.032],[Math.sin(j*2.094)*.135,Math.cos(j*2.094)*.135,0],mat.orange,rotor,.04);
    blade.rotation.z=-j*2.094;blade.rotation.y=.3;
  }
  propellers.push(rotor);
  box([.036,.24,.28],[x,-.61,-3.65],mat.dark,parts.propulsion);
}
// Stainless railings, deck fittings, service hatch, and ring buoy.
for(const x of [-1.40,1.40]) {
  for(const z of [-2.45,-1.2,.15,1.5]) {
    cylinder(.043,.055,.045,[x,.75,z],mat.metal);
    rod([x,.76,z],[x,1.19,z],.017);
  }
  tube([[x,1.03,-2.70],[x,1.19,-2.45],[x,1.19,-1.2],[x,1.19,.15],[x,1.19,1.5],[x,1.03,1.74]],.02,mat.metal);
  rod([x,.95,-2.45],[x,.95,1.5],.009);
}
box([1.05,.065,.50],[0,.91,-2.70],mat.dark);
box([.98,.032,.43],[0,.956,-2.70],mat.white);
rod([-.15,.993,-2.7],[.15,.993,-2.7],.018);
const buoy=mesh(new THREE.TorusGeometry(.245,.065,12,40),mat.orange,[.66,1.00,-2.60]);buoy.rotation.x=Math.PI/2;
for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
  const band=mesh(new THREE.TorusGeometry(.245,.067,10,5,.23),mat.white,[.66,1.002,-2.60]);band.rotation.set(Math.PI/2,0,a);
}
for (const x of [-1.65,1.65])for(const z of [-1.8,.7]) {
  cylinder(.085,.085,.32,[x,.36,z],mat.rubber,boat,16);
  rod([x,.53,z],[x*.91,.82,z],.013,mat.rubber);
}

// Procedural ocean normals keep the scene independent of remote texture assets.
const normalCanvas=document.createElement('canvas');normalCanvas.width=normalCanvas.height=256;
const normalContext=normalCanvas.getContext('2d');const normalImage=normalContext.createImageData(256,256);
for(let y=0;y<256;y++)for(let x=0;x<256;x++) {
  const u=x/256*Math.PI*2,v=y/256*Math.PI*2;
  let dx=0,dy=0;
  for(let k=1;k<=14;k++) {
    const a=Math.round(Math.sin(k*2.39)*k*2),b=Math.round(Math.cos(k*1.73)*k*2),phase=k*2.17;
    dx+=Math.cos(a*u+b*v+phase)*a/(k*k)*.17;
    dy+=Math.cos(a*u+b*v+phase)*b/(k*k)*.17;
  }
  const n=new THREE.Vector3(-dx,-dy,1).normalize(),i=(y*256+x)*4;
  normalImage.data[i]=(n.x*.5+.5)*255;normalImage.data[i+1]=(n.y*.5+.5)*255;normalImage.data[i+2]=(n.z*.5+.5)*255;normalImage.data[i+3]=255;
}
normalContext.putImageData(normalImage,0,0);
const normals=new THREE.CanvasTexture(normalCanvas);normals.wrapS=normals.wrapT=THREE.RepeatWrapping;
const water=new Water(new THREE.PlaneGeometry(1200,1200),{textureWidth:512,textureHeight:512,waterNormals:normals,sunDirection:new THREE.Vector3(),sunColor:0xffffff,waterColor:0x5c8e9c,distortionScale:1.4,fog:false});
water.rotation.x=-Math.PI/2;water.position.y=-.12;scene.add(water);
water.material.uniforms.size.value=3.2;
water.material.fragmentShader=water.material.fragmentShader
  .replace('float rf0 = 0.3;', 'reflectionSample = min(reflectionSample, vec3(1.2)); float rf0 = 0.09;')
  .replace('sunColor * diffuseLight * 0.3', 'sunColor * diffuseLight * 0.12');
const sky=new Sky();sky.scale.setScalar(1500);scene.add(sky);
sky.material.uniforms.turbidity.value=6;
sky.material.uniforms.rayleigh.value=1.5;
sky.material.uniforms.mieCoefficient.value=.005;
sky.material.uniforms.mieDirectionalG.value=.8;
const sun=new THREE.Vector3();
const pmrem=new THREE.PMREMGenerator(renderer);
let environmentTarget;
const sunLight=new THREE.DirectionalLight('#fff4e8',3.5);sunLight.position.set(-5,12,8);sunLight.castShadow=true;
sunLight.shadow.mapSize.set(2048,2048);Object.assign(sunLight.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:40});sunLight.shadow.normalBias=.03;sunLight.shadow.bias=-.0002;scene.add(sunLight);
scene.add(new THREE.HemisphereLight('#e3f1ff','#5e7b85',2.1));
const fill=new THREE.DirectionalLight('#c7e6ff',1.3);fill.position.set(7,5,-8);scene.add(fill);
function setLighting() {
  sun.setFromSphericalCoords(1,THREE.MathUtils.degToRad(state.sunset?85:54),THREE.MathUtils.degToRad(state.sunset?235:205));
  sky.material.uniforms.sunPosition.value.copy(sun);water.material.uniforms.sunDirection.value.copy(sun).normalize();
  sky.material.uniforms.rayleigh.value=state.sunset?2.8:1.5;
  water.material.uniforms.waterColor.value.set(state.sunset?'#426874':'#347888');
  sunLight.color.set(state.sunset?'#ffbd83':'#fff4e8');sunLight.intensity=state.sunset?3.0:3.5;
  sunLight.position.set(state.sunset?-10:-5,state.sunset?5:12,8);
  const envScene=new THREE.Scene();envScene.add(sky.clone());
  environmentTarget?.dispose();environmentTarget=pmrem.fromScene(envScene);scene.environment=environmentTarget.texture;
  $('light-label').textContent=state.sunset?'落日光照':'日间光照';$('sun-icon').textContent=state.sunset?'◒':'☀';
  $('light').setAttribute('aria-label',state.sunset?'切换至日间光照':'切换至落日光照');
}
setLighting();
const studio=group('结构展示基座',scene);studio.visible=false;
const floor=mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#dae6e7',roughness:.96}),[0,-.9,0],studio);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
const grid=new THREE.GridHelper(60,60,'#b8cccf','#c8dadd');grid.position.y=-.895;grid.material.transparent=true;grid.material.opacity=.55;studio.add(grid);

// Translucent wake streaks follow the stern, animated in local scene coordinates.
const wake=group('航行尾流',scene);
const wakeTexture=canvasTexture(128,256,(c)=>{
  const grad=c.createLinearGradient(0,0,0,256);grad.addColorStop(0,'rgba(242,251,251,0)');grad.addColorStop(.5,'rgba(242,251,251,.20)');grad.addColorStop(1,'rgba(242,251,251,0)');c.fillStyle=grad;c.fillRect(0,0,128,256);
});
for(const x of [-1.12,1.12])for(let j=0;j<5;j++) {
  const wm=new THREE.MeshBasicMaterial({map:wakeTexture,transparent:true,opacity:.19,depthWrite:false});
  const w=mesh(new THREE.PlaneGeometry(.04+j*.025,5+j*.5),wm,[x+(j-2)*.10,-.105,-5.4-j*.22],wake);w.rotation.x=-Math.PI/2;w.rotation.z=(j-2)*.045;w.castShadow=false;w.receiveShadow=false;
}

let details=[
  {name:'雷达与 GNSS 导航',position:[0,3.38,-2],description:'双 GNSS 天线、扫描雷达与激光雷达集中于桅杆，构成环境感知与定位系统。',tag:'感知 / 定位',part:parts.sensors},
  {name:'太阳能能源甲板',position:[.65,1.66,-.25],description:'双组太阳能板覆盖密封电子设备舱，配合艇内电池，为载荷与控制设备供电。',tag:'能源 / 电子设备',part:parts.energy},
  {name:'双光光电吊舱',position:[0,1.65,2.48],description:'艇艏布置可见光与热成像双镜头吊舱。独立支架为水面观察提供开阔视野。',tag:'视觉 / 水面观察',part:parts.camera},
  {name:'独立双推进系统',position:[1.12,.10,-3.90],description:'两组带保护导管的电动螺旋桨独立驱动，可通过左右推力差完成转向。结构模式可查看水下部分。',tag:'推进 / 差速转向',part:parts.propulsion},
  {name:'细长双体船型',position:[1.53,.57,1.9],description:'双浮体以连接桥组成宽甲板，艇艏渐缩，艇底设折角；外侧配置防撞护舷与系泊设施。',tag:'船体 / 复合材料',part:parts.hulls[1]},
];
const fleet=[
  {id:'astra',root:boat,details,rotors:propellers,scanners:[radar],accent:'#e67443',name:'ASTRA',number:'P0',title:'探索的起点',subtitle:'双体测绘原型艇',copy:'保留最初设计，作为系列原型。',purpose:'原型 / 环境监测',length:'8.0',beam:'3.5',drive:'独立电推进',file:'ASTRA-P0',wakeScale:1,scale:1},
  ...buildAdditionalVessels({group,mesh,box,cylinder,rod,tube,label,mat,nonSlip}),
  ...buildCollection({group,mesh,box,cylinder,rod,tube,label,mat,nonSlip,solarMat}),
];
fleet.slice(1).forEach(v=>{v.root.visible=false;scene.add(v.root);});
const numberedFleet=fleet.filter(v=>v.id!=='astra').sort((a,b)=>a.number.localeCompare(b.number));
const orderedFleet=[...numberedFleet,fleet[0]];
for(const v of orderedFleet){
  const b=document.createElement('button');b.className='vessel-card';b.dataset.vessel=v.id;b.setAttribute('aria-pressed','false');
  b.setAttribute('aria-label',`${v.name} ${v.number} ${v.subtitle}`);b.style.setProperty('--card-accent',v.accent);
  b.innerHTML=`<span class="card-number">${v.number}</span><span class="card-selected">当前展示</span><img alt="" width="300" height="170"><span class="card-caption"><strong>${v.name} <b>${v.number}</b></strong><span>${v.subtitle}</span></span><span class="card-purpose">${v.purpose}</span>`;
  (v.id==='astra'?$('prototype-card'):$('fleet-grid')).appendChild(b);
}
let activeVessel=fleet[0];
let anchorVectors=[];
let buttons=[];
function buildAnnotations(){
  $('annotations').replaceChildren();
  anchorVectors=details.map(d=>new THREE.Vector3(...d.position));
  buttons=details.map((d,i)=>{
  const b=document.createElement('button');b.className='hotspot';b.textContent=String(i+1).padStart(2,'0');b.dataset.label=d.name;b.setAttribute('aria-label',`查看${d.name}`);b.setAttribute('aria-pressed','false');b.onclick=()=>selectPart(i);$('annotations').appendChild(b);return b;
  });
}
buildAnnotations();
function switchVessel(id,initial=false){
  const next=fleet.find(v=>v.id===id);if(!next)return;
  boat.visible=false;activeVessel=next;boat=next.root;boat.visible=true;
  details=next.details;state.selected=-1;buildAnnotations();
  $('model-title').textContent=next.title;$('model-name').textContent=next.name;$('model-number').textContent=next.number;
  $('model-subtitle').textContent=next.subtitle;$('model-copy').textContent=next.copy;$('model-purpose').textContent=next.purpose;
  $('spec-length').textContent=next.length;$('spec-beam').textContent=next.beam;$('spec-drive').textContent=next.drive;
  $('spec-count').textContent=next.driveCount||'2';
  $('fleet-current').textContent=`${next.name} ${next.number}`;$('fleet-position').textContent=next.id==='astra'?'原型档案':`${next.number} / 09`;
  $('part-index').textContent='01 / 05';$('part-title').textContent=`${next.name} ${next.number} · ${next.subtitle}`;
  $('part-description').textContent='点击艇上的标记，探索这艘无人艇的结构与设备。';$('part-tag').textContent='五组部件 · 可交互查看';
  $('scene').setAttribute('aria-label',`可旋转和缩放的 ${next.name} ${next.number} ${next.subtitle}三维模型`);
  document.documentElement.style.setProperty('--orange',next.accent);
  document.querySelectorAll('[data-vessel]').forEach(b=>{b.classList.toggle('selected',b.dataset.vessel===id);b.setAttribute('aria-pressed',String(b.dataset.vessel===id));});
  document.title=`${next.name} ${next.number} · 水面无人艇展厅`;
  const url=new URL(location.href);url.searchParams.set('vessel',id);history.replaceState(null,'',url);
  wake.scale.x=next.wakeScale;wake.position.z=next.id==='terra'?-.35:next.id==='vector'?.5:0;
  floor.position.y=next.floorY||-.9;grid.position.y=floor.position.y+.005;
  mode(state.ocean);view('perspective',initial);
}
document.querySelectorAll('[data-vessel]').forEach(b=>b.onclick=()=>{switchVessel(b.dataset.vessel);$('fleet-dialog').close();});
$('fleet-prev').onclick=()=>{const index=orderedFleet.indexOf(activeVessel);switchVessel(orderedFleet[(index+orderedFleet.length-1)%orderedFleet.length].id);};
$('fleet-next').onclick=()=>{const index=orderedFleet.indexOf(activeVessel);switchVessel(orderedFleet[(index+1)%orderedFleet.length].id);};
$('fleet-close').onclick=()=>$('fleet-dialog').close();
$('fleet-dialog').addEventListener('click',e=>{if(e.target===$('fleet-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
let thumbnailsReady=false;
function makeThumbnails(){
  if(thumbnailsReady)return;
  const size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio();
  const previewScene=new THREE.Scene();previewScene.background=new THREE.Color('#e5eef0');previewScene.environment=scene.environment;
  previewScene.add(new THREE.HemisphereLight('#e9f3ff','#627a80',2));
  const light=new THREE.DirectionalLight('#fff7e9',3.2);light.position.set(-3,8,5);previewScene.add(light);
  const previewCamera=new THREE.PerspectiveCamera(34,300/130,.1,80);
  try{
    renderer.setPixelRatio(1);renderer.setSize(300,130,false);
    for(const v of orderedFleet){
      const model=v.root.clone(true);model.position.set(0,0,0);model.rotation.set(0,0,0);model.visible=true;previewScene.add(model);
      const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3());
      const direction=new THREE.Vector3(10,7,12).normalize();
      previewCamera.position.copy(center).add(direction);previewCamera.lookAt(center);previewCamera.updateMatrixWorld();
      const right=new THREE.Vector3().setFromMatrixColumn(previewCamera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(previewCamera.matrixWorld,1);
      let extentX=0,extentY=0,depth=0;
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
        const corner=new THREE.Vector3(x,y,z).sub(center);extentX=Math.max(extentX,Math.abs(corner.dot(right)));extentY=Math.max(extentY,Math.abs(corner.dot(up)));depth=Math.max(depth,corner.dot(direction));
      }
      const tangent=Math.tan(THREE.MathUtils.degToRad(previewCamera.fov/2));
      const distance=Math.max(extentY/tangent/.85,extentX/tangent/previewCamera.aspect/.85)+depth*.6;
      previewCamera.position.copy(center).addScaledVector(direction,distance);previewCamera.lookAt(center);
      renderer.render(previewScene,previewCamera);
      document.querySelector(`[data-vessel="${v.id}"] img`).src=renderer.domElement.toDataURL('image/png');
      previewScene.remove(model);
    }
    thumbnailsReady=true;
  }catch(error){console.error('艇型缩略图生成失败',error);}
  finally{renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);renderer.render(scene,camera);}
}
$('fleet-open').onclick=()=>{$('fleet-dialog').showModal();setTimeout(makeThumbnails,0);};
function selectPart(i) {
  state.selected=i;const d=details[i];
  $('part-index').textContent=`${String(i+1).padStart(2,'0')} / 05`;$('part-title').textContent=d.name;$('part-description').textContent=d.description;$('part-tag').textContent=d.tag;
  buttons.forEach((b,j)=>{b.classList.toggle('selected',j===i);b.setAttribute('aria-pressed',String(j===i));});
}
const raycaster=new THREE.Raycaster();let pointerStart;
renderer.domElement.addEventListener('pointerdown',e=>{pointerStart=[e.clientX,e.clientY];});
renderer.domElement.addEventListener('pointerup',e=>{
  if(!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>5)return;
  raycaster.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),camera);
  const hit=raycaster.intersectObject(boat,true)[0];if(!hit)return;
  for(let obj=hit.object;obj&&obj!==boat;obj=obj.parent){const index=details.findIndex(d=>d.part===obj);if(index!==-1){selectPart(index);break;}}
});
const presetPositions={perspective:[9.6,7.4,11.2],top:[.01,19,.01],side:[18,4,.2],rear:[9.2,7.4,-11.2]};
let cameraTween=null;
function view(name,immediate=false) {
  const mobile=innerWidth<=760;
  controls.maxDistance=mobile?55:32;
  const position=new THREE.Vector3(...presetPositions[name]).multiplyScalar((mobile?2.1:1)*activeVessel.scale);
  const target=new THREE.Vector3(mobile?0:-.8,(mobile?-.3:.8)+(activeVessel.targetHeight||.8)-.8,0);
  if(immediate||reducedMotion){camera.position.copy(position);controls.target.copy(target);controls.update();}
  else cameraTween={from:camera.position.clone(),to:position,targetFrom:controls.target.clone(),targetTo:target,t:0};
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===name);b.setAttribute('aria-pressed',String(b.dataset.view===name));});
}
view('perspective',true);
controls.addEventListener('start',()=>{cameraTween=null;});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
$('rotate').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('rotate').classList.toggle('active',controls.autoRotate);$('rotate').setAttribute('aria-pressed',String(controls.autoRotate));};
$('labels').onclick=()=>{state.labels=!state.labels;$('labels').classList.toggle('active',state.labels);$('labels').setAttribute('aria-pressed',String(state.labels));};
function mode(ocean) {
  state.ocean=ocean;water.visible=ocean;sky.visible=ocean;wake.visible=ocean;studio.visible=!ocean;
  scene.background=ocean?null:new THREE.Color('#dce8e9');
  controls.maxPolarAngle=ocean?Math.PI*.485:Math.PI*.58;
  if(ocean) { const offset=camera.position.clone().sub(controls.target);if(offset.y<.8){camera.position.y=controls.target.y+.8;} }
  $('ocean-mode').classList.toggle('selected',ocean);$('studio-mode').classList.toggle('selected',!ocean);
  $('ocean-mode').setAttribute('aria-pressed',String(ocean));$('studio-mode').setAttribute('aria-pressed',String(!ocean));$('sea').disabled=!ocean;
  if(!ocean){boat.position.y=.22;boat.rotation.set(0,0,0);}
}
$('ocean-mode').onclick=()=>mode(true);$('studio-mode').onclick=()=>mode(false);
$('sea').oninput=e=>{state.sea=Number(e.target.value)/100;$('sea-value').textContent=`${state.sea<.35?'平静':state.sea<.7?'微浪':'起伏'} · ${e.target.value}%`;e.target.style.background=`linear-gradient(90deg,#dc885e ${e.target.value}%,#d6e3e7 ${e.target.value}%)`;water.material.uniforms.distortionScale.value=.5+state.sea*5;};
$('light').onclick=()=>{state.sunset=!state.sunset;setLighting();};
function updatePause(){$('pause').setAttribute('aria-pressed',String(state.paused));$('pause').setAttribute('aria-label',state.paused?'播放动态':'暂停动态');$('pause-icon').textContent=state.paused?'▷':'Ⅱ';$('pause-label').textContent=state.paused?'播放动态':'暂停动态';}
$('pause').onclick=()=>{state.paused=!state.paused;updatePause();};updatePause();
let toastTimeout;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('show'),3200);}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('capture').onclick=()=>{const filename=activeVessel.file;renderer.render(scene,camera);renderer.domElement.toBlob(blob=>{if(blob){download(blob,`${filename}-view.png`);toast('当前三维视图已保存');}else toast('视图保存失败，请重试');},'image/png');};
$('export').onclick=async()=>{
  $('export').disabled=true;toast('正在准备 GLB 三维模型…');
  const vesselToExport=activeVessel;
  try {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const model=vesselToExport.root.clone(true);model.visible=true;model.position.set(0,0,0);model.rotation.set(0,0,0);
    const buffer=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true});
    download(new Blob([buffer],{type:'model/gltf-binary'}),`${vesselToExport.file}.glb`);toast(`${vesselToExport.name} ${vesselToExport.number} 模型已下载`);
  }catch(error){console.error(error);toast('模型导出失败，请重试');}finally{$('export').disabled=false;}
};
let mobileLayout=innerWidth<=760;
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));if(mobileLayout!==(innerWidth<=760)){mobileLayout=innerWidth<=760;view(document.querySelector('[data-view].active')?.dataset.view||'perspective',true);}});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('图形上下文已中断，请刷新页面恢复');});
const requestedVessel=new URL(location.href).searchParams.get('vessel');
switchVessel(fleet.some(v=>v.id===requestedVessel)?requestedVessel:'nereid',true);
let elapsed=0,last=performance.now();const projected=new THREE.Vector3();
function animate(now) {
  requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;
  if(!state.paused){elapsed+=dt;water.material.uniforms.time.value+=dt*.48;activeVessel.scanners.forEach(r=>r.rotation.y+=dt*.7);activeVessel.rotors.forEach(p=>p.rotation.z-=dt*5);}
  if(state.ocean){const amp=.018+state.sea*.09;boat.position.y=.02+Math.sin(elapsed*1.1)*amp;boat.rotation.z=Math.sin(elapsed*.8)*amp*.22;boat.rotation.x=Math.sin(elapsed*.95)*amp*.17;}
  if(cameraTween){cameraTween.t=Math.min(1,cameraTween.t+dt*1.5);const f=cameraTween.t*cameraTween.t*(3-2*cameraTween.t);camera.position.lerpVectors(cameraTween.from,cameraTween.to,f);controls.target.lerpVectors(cameraTween.targetFrom,cameraTween.targetTo,f);if(cameraTween.t===1)cameraTween=null;}
  controls.update(dt);boat.updateMatrixWorld();
  for(let i=0;i<buttons.length;i++) {
    projected.copy(anchorVectors[i]);boat.localToWorld(projected);projected.project(camera);
    const x=(projected.x*.5+.5)*innerWidth,y=(-projected.y*.5+.5)*innerHeight;
    const visible=state.labels&&projected.z<1&&projected.z>-1&&x>0&&x<innerWidth&&y>74&&y<innerHeight-60;
    buttons[i].classList.toggle('hidden',!visible);buttons[i].tabIndex=visible?0:-1;
    buttons[i].style.left=`${x}px`;buttons[i].style.top=`${y}px`;
  }
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);
renderer.render(scene,camera);$('loading').classList.add('done');
setTimeout(()=>$('loading').remove(),800);
