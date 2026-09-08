import * as THREE from 'three';

// Independent, metre-scale concept models. Helpers are shared with the original vessel.
export function buildAdditionalVessels(api) {
  const { group, mesh, box, cylinder, rod, tube, label, mat, nonSlip } = api;
  const material = (color, metalness=.3, roughness=.46) => new THREE.MeshStandardMaterial({color,metalness,roughness,envMapIntensity:.7});
  const graphite=material('#25323a',.42,.43), charcoal=material('#111c24',.25,.65);
  const cyan=material('#25bdca',.3,.35), yellow=material('#e5ac25',.2,.42);
  const navy=material('#173e55',.38,.48), cream=material('#ebe9da',.15,.45);
  const safety=material('#b96f1c',.2,.6);

  function root(name) { const g=new THREE.Group();g.name=name;return g; }
  function loft(sections, ring, materials, parent, name, faceMaterial=()=>0) {
    const vertices=[],indices=[],geo=new THREE.BufferGeometry(),n=ring.length;
    sections.forEach(([z,w,rise=0])=>ring.forEach(([x,y])=>vertices.push(x*w,y+rise,z)));
    for(let s=0;s<sections.length-1;s++)for(let j=0;j<n;j++){
      const a=s*n+j,b=s*n+(j+1)%n,c=(s+1)*n+j,d=(s+1)*n+(j+1)%n,start=indices.length;
      indices.push(a,b,c,b,d,c);geo.addGroup(start,6,faceMaterial(j));
    }
    for(let j=1;j<n-1;j++){
      let start=indices.length;indices.push(0,j+1,j);geo.addGroup(start,3,0);
      const end=(sections.length-1)*n;start=indices.length;indices.push(end,end+j,end+j+1);geo.addGroup(start,3,0);
    }
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
    return mesh(geo,materials,[0,0,0],parent,name);
  }
  function plate(points,material,parent,name='折面板') {
    const positions=[];
    for(let i=1;i<points.length-1;i++)positions.push(...points[0],...points[i],...points[i+1]);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
    return mesh(geo,material,[0,0,0],parent,name);
  }
  function decal(text,width,height,pos,rotation,parent,color='#dce8e8'){
    const m=new THREE.MeshStandardMaterial({map:label(text,1024,192,color),transparent:true,roughness:.65,polygonOffset:true,polygonOffsetFactor:-2});
    const p=mesh(new THREE.PlaneGeometry(width,height),m,pos,parent,'艇身标识');p.rotation.set(...rotation);return p;
  }
  function bolt(pos,parent){cylinder(.022,.022,.012,pos,mat.metal,parent,6);}
  function hatch(pos,size,parent,base=graphite) {
    const [x,y,z]=pos,[w,l]=size;
    box([w,.04,l],pos,mat.rubber,parent,.018);
    box([w-.06,.025,l-.06],[x,y+.035,z],base,parent,.018);
    for(const dx of [-1,1])for(const dz of [-1,1])bolt([x+dx*(w/2-.065),y+.055,z+dz*(l/2-.065)],parent);
    rod([x-.1,y+.065,z],[x+.1,y+.065,z],.018,mat.metal,parent);
  }
  function cleat(x,y,z,parent){box([.30,.028,.14],[x,y,z],mat.metal,parent);for(const d of [-.085,.085])cylinder(.022,.025,.10,[x+d,y+.06,z],mat.metal,parent);rod([x-.20,y+.11,z],[x+.20,y+.11,z],.027,mat.metal,parent);}
  function optical(pos,parent,shell=mat.white) {
    const [x,y,z]=pos;
    cylinder(.12,.18,.10,[x,y,z],charcoal,parent);
    cylinder(.07,.10,.18,[x,y+.12,z],mat.metal,parent);
    mesh(new THREE.SphereGeometry(.21,28,18),shell,[x,y+.35,z],parent);
    for(const [dx,r] of [[-.073,.075],[.10,.045]]){
      const rim=cylinder(r*1.3,r*1.3,.05,[x+dx,y+.36,z+.181],charcoal,parent);rim.rotation.x=Math.PI/2;
      const lens=cylinder(r,r,.01,[x+dx,y+.36,z+.212],mat.lens,parent);lens.rotation.x=Math.PI/2;
    }
  }

  // VECTOR 06: deep-V monohull, low angular fairing, flush deck, twin waterjets.
  const vector=root('VECTOR 06 · 高速巡航无人艇');
  const vHull=group('深 V 折角船体',vector);
  const vSections=[[-3.12,.84],[-2.7,1.02],[-1.6,1.14],[-.3,1.16],[1.05,1.08],[2,.85,.06],[2.8,.48,.14],[3.45,.10,.20],[3.6,.006,.22]];
  loft(vSections,[[-.88,.54],[-1,.30],[-.86,-.09],[-.48,-.46],[0,-.69],[.48,-.46],[.86,-.09],[1,.30],[.88,.54]], [graphite,cyan,charcoal],vHull,'深 V 单体船壳',j=>j===0||j===7?1:j===8?2:0);
  for(const sign of [-1,1]){
    tube(vSections.slice(0,-1).map(([z,w,r=0])=>[sign*w*1.005,.28+r,z]),.025,mat.rubber,vHull);
    tube(vSections.slice(0,-2).map(([z,w,r=0])=>[sign*w*.862,-.083+r,z]),.018,cyan,vHull);
    for(const z of [-2.55,-1.9,-1.25,-.6,.05,.7])bolt([sign*.92,.57,z],vHull);
  }
  const fairing=group('低风阻棱面设备舱',vector);
  const shell=loft([[-1.80,.69],[-1.42,.81],[-.62,.81],[.7,.59],[1.40,.27],[1.77,.025]], [[-.98,.59],[-1,.82],[-.65,1.20],[.65,1.20],[1,.82],[.98,.59]], [graphite,charcoal],fairing,'多面整流罩',j=>j===2?1:0);
  // This ring runs clockwise, so flip the face winding for this upper shell.
  const si=shell.geometry.index.array;for(let i=0;i<si.length;i+=3)[si[i+1],si[i+2]]=[si[i+2],si[i+1]];shell.geometry.computeVertexNormals();
  for(const sign of [-1,1]){
    const windowMat=mat.glass.clone();windowMat.side=THREE.DoubleSide;windowMat.envMapIntensity=.4;
    plate([[sign*.813,.89,-1.23],[sign*.58,1.185,-1.12],[sign*.42,1.185,.46],[sign*.59,.89,.67]],windowMat,fairing,'侧向感知窗');
    rod([sign*.67,.65,-1.75],[sign*.35,.65,1.18],.018,cyan,fairing);
    for(let j=0;j<8;j++){
      const vent=box([.035,.055,.36],[sign*.87,.576,-2.55+j*.11],mat.metal,fairing,.007);vent.rotation.y=sign*.22;
    }
  }
  hatch([0,.61,2.15],[.57,.65],fairing,graphite);
  hatch([0,.60,-2.55],[1.02,.65],fairing,graphite);
  decal('VECTOR',.86,.17,[0,.568,2.87],[-Math.PI/2,0,Math.PI],vHull,'#82e2e5');
  for(const sign of [-1,1])decal('V E C T O R   0 6',1.75,.21,[sign*1.12,.15,-.65],[0,sign*Math.PI/2,0],vHull,'#acdbdd');
  for(const x of [-.72,.72])cleat(x,.57,-2.90,vHull);
  cleat(0,.78,3.16,vHull);
  const vSensors=group('共形感知塔',vector);
  const mast=box([.20,.70,.25],[0,1.56,-.63],graphite,vSensors,.045);mast.rotation.x=-.18;
  box([.77,.16,.31],[0,1.96,-.72],charcoal,vSensors,.055);
  cylinder(.16,.16,.16,[0,2.12,-.72],mat.glass,vSensors,32);
  cylinder(.19,.18,.055,[0,2.225,-.72],graphite,vSensors,32);
  for(const x of [-.30,.30]){
    cylinder(.07,.08,.04,[x,2.08,-.72],mat.white,vSensors);
    rod([x,2.04,-.83],[x,2.65,-.87],.009,mat.dark,vSensors);
  }
  const vRadar=group('紧凑扫描阵列',vSensors);vRadar.position.set(0,2.32,-.72);
  box([.64,.075,.13],[0,0,0],graphite,vRadar,.025);
  box([.43,.025,.015],[0,0,.07],cyan,vRadar,.004);
  const vOptical=group('前向光电感知',vector);optical([0,1.22,.50],vOptical,graphite);
  for(const x of [-.87,.87]){
    box([.12,.065,.20],[x,.62,.66],x<0?mat.red:mat.green,vector,.025);
    box([.18,.07,.18],[x,.61,-1.45],graphite,vector);
  }
  const jets=group('双喷水推进模块',vector),vRotors=[];
  for(const x of [-.49,.49]){
    const body=cylinder(.22,.25,.41,[x,-.02,-3.14],graphite,jets,28);body.rotation.x=Math.PI/2;
    const aperture=cylinder(.158,.158,.012,[x,-.02,-3.353],charcoal,jets,28);aperture.rotation.x=Math.PI/2;
    mesh(new THREE.TorusGeometry(.18,.027,10,32),mat.metal,[x,-.02,-3.36],jets);
    const rotor=group('喷水泵叶轮',jets);rotor.position.set(x,-.02,-3.37);
    const hub=cylinder(.045,.06,.045,[0,0,0],mat.metal,rotor);hub.rotation.x=Math.PI/2;
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5,b=box([.047,.13,.015],[Math.sin(a)*.083,Math.cos(a)*.083,0],mat.metal,rotor,.01);b.rotation.z=-a;}
    vRotors.push(rotor);
    for(const sign of [-1,1])rod([x+sign*.22,.15,-2.98],[x+sign*.22,-.05,-3.5],.035,mat.metal,jets);
    const bucket=box([.43,.13,.18],[x,-.21,-3.44],graphite,jets,.04);bucket.rotation.x=-.35;
    box([.33,.025,.64],[x,-.50,-2.58],charcoal,jets,.035);
    for(let i=-2;i<=2;i++)rod([x+i*.055,-.52,-2.87],[x+i*.055,-.52,-2.29],.009,mat.metal,jets);
  }
  const vDetails=[
    {name:'紧凑共形感知塔',position:[0,2.32,-.72],part:vSensors,description:'低矮一体式桅杆集成扫描阵列、激光感知与双天线，延续艇身紧凑的轮廓。',tag:'感知 / 紧凑布局'},
    {name:'棱面整流设备舱',position:[.61,1.15,-.50],part:fairing,description:'石墨色多面整流罩配侧向感知窗、后部散热格栅与齐平检修盖，突出高速巡航艇的低姿态。',tag:'结构 / 低矮整流罩'},
    {name:'前向双光感知',position:[0,1.68,.5],part:vOptical,description:'双镜头光电单元位于整流罩前部，承担水面目标观察；镜头保护环与转台独立建模。',tag:'视觉 / 水面巡查'},
    {name:'双喷水推进器',position:[.49,.13,-3.48],part:jets,description:'艇尾两组喷口包含叶轮、转向支架与倒车斗。切换结构展示可查看艇底进水格栅。',tag:'推进 / 喷水布局'},
    {name:'深 V 单体船壳',position:[1.03,.40,1.05],part:vHull,description:'尖艏、深 V 艇底与连续折角形成细长单体轮廓；青蓝色舷缘与石墨色船壳形成鲜明对比。',tag:'船型 / 深 V 单体'},
  ];

  // TERRA 09: broad workboat, forward equipment house, open aft sampling deck.
  const terra=root('TERRA 09 · 工业调查无人艇');
  const tHull=group('宽体工作船壳',terra);
  const tSections=[[-4.3,1.46],[-3.8,1.67],[-2.5,1.79],[-.8,1.8],[1,1.77],[2.2,1.57,.04],[3.1,1.12,.11],[3.8,.55,.17],[4.3,.06,.21],[4.4,.008,.22]];
  loft(tSections,[[-.95,.90],[-1,.62],[-.99,.15],[-.82,-.50],[-.43,-.73],[.43,-.73],[.82,-.50],[.99,.15],[1,.62],[.95,.90]], [navy,yellow],tHull,'宽体折角钢质概念船壳',j=>j===0||j===8||j===9?1:0);
  for(const sign of [-1,1]){
    tube(tSections.slice(0,-1).map(([z,w,r=0])=>[sign*w*1.008,.55+r,z]),.08,mat.rubber,tHull);
    tube(tSections.slice(0,-1).map(([z,w,r=0])=>[sign*w*.963,.92+r,z]),.038,yellow,tHull);
    for(const z of [-3.3,-2.0,-.7,.6,1.85]){
      const x=sign*(z>1?1.73:1.84);
      const tire=mesh(new THREE.TorusGeometry(.225,.08,12,28),mat.rubber,[x,.30,z],tHull,'轮胎护舷');tire.rotation.y=Math.PI/2;
      rod([x,.54,z],[sign*1.64,.96,z-.1],.015,mat.dark,tHull);
      for(const k of [-1,1])rod([x,.30+k*.18,z-.04],[x,.30+k*.18,z+.04],.009,mat.metal,tHull);
    }
    decal('T E R R A   0 9',2.15,.28,[sign*1.805,.24,-.3],[0,sign*Math.PI/2,0],tHull,'#f6d268');
  }
  const tDeck=group('开放作业甲板',terra);
  box([3.05,.06,4.15],[0,.94,-1.79],nonSlip,tDeck,.045);
  for(const x of [-1.44,1.44])box([.055,.025,4.10],[x,.984,-1.80],yellow,tDeck,.009);
  for(const x of [-1.59,1.59]){
    for(const z of [-3.92,-3,-2.0,-1,.02]){
      cylinder(.047,.058,.07,[x,.96,z],mat.metal,tDeck);
      rod([x,1,z],[x,1.48,z],.023,yellow,tDeck);
    }
    rod([x,1.48,-3.92],[x,1.48,.02],.028,yellow,tDeck);
    rod([x,1.23,-3.92],[x,1.23,.02],.014,mat.metal,tDeck);
  }
  for(const x of [-1.24,1.24])for(const z of [-3.8,2.35])cleat(x,1.00,z,tDeck);
  hatch([.87,1.00,-.42],[.77,.73],tDeck,navy);
  hatch([-.75,1.00,-1.52],[.96,.88],tDeck,navy);
  // Forward sealed control and communications house, without a crew cockpit.
  const house=group('前置仪器舱与通信塔',terra);
  box([2.20,1.02,1.79],[0,1.46,1.05],cream,house,.10);
  box([2.24,.14,1.89],[0,2.00,1.05],navy,house,.06);
  box([1.66,.27,.032],[0,1.69,1.96],mat.glass,house,.055);
  for(const x of [-1.11,1.11]){
    box([.03,.26,.90],[x,1.69,1.17],mat.glass,house,.04);
    for(let i=0;i<8;i++)box([.022,.17,.033],[x,1.30,.56+i*.10],navy,house,.005);
  }
  box([.68,.72,.05],[-.43,1.42,.13],navy,house,.025);
  rod([-.19,1.38,.095],[-.19,1.57,.095],.017,mat.metal,house);
  decal('AUTONOMOUS  /  SURVEY',1.33,.16,[0,1.34,1.954],[0,0,0],house,'#325769');
  cylinder(.13,.16,.91,[0,2.47,.71],yellow,house);
  box([1.20,.08,.22],[0,2.79,.71],navy,house);
  for(const x of [-.50,.50]){
    cylinder(.025,.035,.25,[x,2.95,.71],mat.metal,house);
    cylinder(.11,.09,.06,[x,3.10,.71],cream,house);
  }
  const tRadar=group('调查艇雷达',house);tRadar.position.set(0,3.05,.71);
  cylinder(.15,.18,.17,[0,0,0],cream,tRadar);
  box([1.03,.11,.20],[0,.13,0],cream,tRadar,.04);
  rod([.32,2.05,.36],[.32,3.54,.36],.013,navy,house);
  cylinder(.20,.24,.17,[-.56,2.15,1.31],cream,house);
  mesh(new THREE.SphereGeometry(.20,24,16,0,Math.PI*2,0,Math.PI/2),cream,[-.56,2.235,1.31],house);
  optical([0,1.07,2.72],house,cream);
  for(const x of [-1.14,1.14])box([.12,.09,.18],[x,1.98,1.66],x<0?mat.red:mat.green,house);
  // Tall stern A-frame, hydraulic rams, sheave and hanging sampler.
  const gantry=group('艉部 A 架与采样绞车',terra);
  for(const x of [-1.26,1.26]){
    box([.43,.13,.59],[x,1.03,-3.34],navy,gantry);
    rod([x,1.12,-3.15],[x,3.05,-3.61],.095,yellow,gantry);
    rod([x,1.12,-3.87],[x,2.79,-3.56],.075,yellow,gantry);
    rod([x,1.15,-2.81],[x,2.1,-3.35],.059,navy,gantry);
    rod([x,1.55,-3.04],[x,2.40,-3.51],.027,mat.metal,gantry);
    for(const z of [-3.49,-3.2])bolt([x,1.11,z],gantry);
  }
  rod([-1.35,3.05,-3.61],[1.35,3.05,-3.61],.10,yellow,gantry);
  box([2.61,.13,.15],[0,3.17,-3.61],yellow,gantry);
  for(let j=-5;j<=5;j++){
    const stripe=box([.12,.133,.155],[j*.22,3.17,-3.61],charcoal,gantry,.004);stripe.rotation.z=.18;
  }
  const sheave=mesh(new THREE.TorusGeometry(.17,.032,10,28),mat.metal,[0,2.94,-3.61],gantry);sheave.rotation.y=Math.PI/2;
  for(const x of [-.42,.42])box([.11,.49,.49],[x,1.26,-2.48],navy,gantry);
  const drum=cylinder(.26,.26,.76,[0,1.4,-2.48],charcoal,gantry,28);drum.rotation.z=Math.PI/2;
  for(let i=-7;i<=7;i++){
    const winding=mesh(new THREE.TorusGeometry(.261,.012,8,28),mat.metal,[i*.044,1.4,-2.48],gantry);winding.rotation.y=Math.PI/2;
  }
  cylinder(.22,.22,.21,[.61,1.34,-2.48],yellow,gantry).rotation.z=Math.PI/2;
  tube([[0,1.59,-2.48],[0,2.93,-3.49],[0,3.09,-3.62],[0,2.93,-3.78],[0,1.69,-3.78]],.012,mat.dark,gantry);
  const sampler=group('环形多瓶水样采集器',terra);
  cylinder(.31,.31,.035,[0,1.06,-3.77],mat.metal,sampler);
  cylinder(.31,.31,.035,[0,1.64,-3.77],mat.metal,sampler);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,x=Math.cos(a)*.23,z=-3.77+Math.sin(a)*.23;
    cylinder(.061,.061,.43,[x,1.36,z],cream,sampler,16);
    cylinder(.069,.069,.045,[x,1.595,z],navy,sampler,16);
    rod([x,1.04,z],[x,1.68,z],.01,mat.metal,sampler);
  }
  rod([0,1.62,-3.77],[0,1.72,-3.77],.04,mat.metal,sampler);
  // Compact articulated deck crane with distinct yellow booms and polished rams.
  const crane=group('折臂作业吊机',terra);
  cylinder(.28,.35,.16,[-.85,1.06,-.56],navy,crane,28);
  cylinder(.21,.25,.54,[-.85,1.40,-.56],yellow,crane,28);
  rod([-.85,1.62,-.56],[-.85,2.56,-1.15],.12,yellow,crane);
  rod([-.85,2.56,-1.15],[-.85,2.03,-2.29],.095,yellow,crane);
  rod([-.69,1.50,-.53],[-.69,2.15,-.90],.046,navy,crane);
  rod([-.69,1.80,-.69],[-.69,2.43,-1.07],.023,mat.metal,crane);
  tube([[-.99,1.15,-.5],[-.99,1.77,-.64],[-.99,2.53,-1.14],[-.99,2.03,-2.3]],.018,mat.rubber,crane);
  rod([-.85,2.00,-2.28],[-.85,1.61,-2.28],.009,mat.dark,crane);
  const hook=mesh(new THREE.TorusGeometry(.06,.015,10,20,Math.PI*1.5),mat.metal,[-.85,1.55,-2.28],crane);
  box([.44,.24,.42],[.9,1.13,-1.83],safety,tDeck,.04);
  for(let i=0;i<4;i++)box([.31,.022,.028],[.9,1.27,-1.97+i*.09],navy,tDeck);
  const thrusters=group('双轴导管推进',terra),tRotors=[];
  for(const x of [-.9,.9]){
    rod([x,-.30,-3.25],[x,-.43,-4.16],.055,mat.metal,thrusters);
    mesh(new THREE.TorusGeometry(.32,.07,12,36),navy,[x,-.44,-4.18],thrusters);
    const rotor=group('四叶工作螺旋桨',thrusters);rotor.position.set(x,-.44,-4.20);
    const hub=cylinder(.065,.085,.15,[0,0,0],mat.metal,rotor);hub.rotation.x=Math.PI/2;
    for(let j=0;j<4;j++){
      const a=j*Math.PI/2,b=box([.13,.24,.033],[Math.sin(a)*.16,Math.cos(a)*.16,0],safety,rotor,.05);b.rotation.z=-a;b.rotation.y=.30;
    }
    tRotors.push(rotor);
    box([.04,.45,.36],[x,-.43,-4.43],navy,thrusters);
  }
  const tDetails=[
    {name:'仪器舱与通信塔',position:[0,3.19,.71],part:house,description:'前置密封仪器舱承载通信、雷达、双 GNSS 与光电系统，将完整艉甲板留给调查设备。',tag:'布局 / 前舱后甲板'},
    {name:'液压 A 架与绞车',position:[.7,3.16,-3.61],part:gantry,description:'艉部 A 架配液压支撑、顶端滑轮和缆绳绞车，用于布放调查载荷。警示条纹、卷缆与连接件均独立建模。',tag:'作业 / 载荷布放'},
    {name:'多瓶水样采集器',position:[0,1.52,-3.77],part:sampler,description:'八只采样瓶布置在金属环架内，吊挂于艉部缆绳下方；瓶盖、框架和吊点可近距离查看。',tag:'调查 / 水样采集'},
    {name:'折臂作业吊机',position:[-.85,2.51,-1.15],part:crane,description:'侧置双节吊臂包含回转底座、液压缸、外露油管和吊钩，形成明确的工业作业艇特征。',tag:'机械 / 甲板吊装'},
    {name:'宽体船壳与双轴推进',position:[1.70,.55,-.5],part:tHull,description:'海军蓝宽体船壳配工程黄舷墙、连续橡胶防撞条和轮胎护舷，艇尾布置双轴导管螺旋桨。',tag:'船体 / 工业防护'},
  ];
  return [
    {id:'vector',root:vector,details:vDetails,rotors:vRotors,scanners:[vRadar],accent:'#299ba9',name:'VECTOR',number:'06',title:'逐浪而驰',subtitle:'高速巡航无人艇',copy:'锐利轮廓，紧凑而敏捷。',purpose:'巡航 / 水面巡查',length:'6.7',beam:'2.3',drive:'双喷水推进',file:'VECTOR-06',wakeScale:.44,scale:.96},
    {id:'terra',root:terra,details:tDetails,rotors:tRotors,scanners:[tRadar],accent:'#b88a27',name:'TERRA',number:'09',title:'深入每一片海',subtitle:'工业调查无人艇',copy:'开放甲板，为水上作业而生。',purpose:'采样 / 水域调查',length:'8.9',beam:'3.6',drive:'双轴电推进',file:'TERRA-09',wakeScale:.81,scale:1.08},
  ];
}
