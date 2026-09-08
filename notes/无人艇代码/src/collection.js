import * as THREE from 'three';

// Seven individually composed vessels; all measurements are conceptual metres.
export function buildCollection(api) {
  const {group,mesh,box,cylinder,rod,tube,label,mat,nonSlip,solarMat}=api;
  const paint=(color,metalness=.2,roughness=.47)=>new THREE.MeshStandardMaterial({color,metalness,roughness,envMapIntensity:.65});
  const white=paint('#e5ecea'),teal=paint('#178f97'),blue=paint('#256089'),navy=paint('#203c50');
  const orange=paint('#ee6330'),red=paint('#b83e3e'),yellow=paint('#e2ae36'),silver=paint('#aabfc6',.7,.31);
  const black=paint('#1b2b34',.3,.56),cream=paint('#e6ddc2'),purple=paint('#635579');
  const boats=[];
  function start(id,name,number,metadata){
    const root=new THREE.Group();root.name=`${name} ${number} · ${metadata.subtitle}`;
    const v={id,name,number,root,details:[],rotors:[],scanners:[],file:`${name}-${number}`,scale:1,wakeScale:.7,driveCount:'2',...metadata};boats.push(v);return v;
  }
  function part(v,name,position,description,tag){const p=group(name,v.root);v.details.push({name,position,description,tag,part:p});return p;}
  function ellipsoid(size,pos,material,parent){const m=mesh(new THREE.SphereGeometry(1,32,20),material,pos,parent);m.scale.set(...size);return m;}
  function loft(stations,profile,materials,parent,name='分段放样船壳',face=()=>0){
    const g=new THREE.BufferGeometry(),v=[],ind=[],n=profile.length;
    stations.forEach(([z,w,r=0])=>profile.forEach(([x,y])=>v.push(x*w,y+r,z)));
    for(let s=0;s<stations.length-1;s++)for(let j=0;j<n;j++){
      const a=s*n+j,b=s*n+(j+1)%n,c=(s+1)*n+j,d=(s+1)*n+(j+1)%n,k=ind.length;
      ind.push(a,b,c,b,d,c);g.addGroup(k,6,face(j));
    }
    for(let j=1;j<n-1;j++){
      let k=ind.length;ind.push(0,j+1,j);g.addGroup(k,3,0);
      const e=(stations.length-1)*n;k=ind.length;ind.push(e,e+j,e+j+1);g.addGroup(k,3,0);
    }
    g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ind);g.computeVertexNormals();
    return mesh(g,materials,[0,0,0],parent,name);
  }
  const profile=[[-.9,.65],[-1,.40],[-.85,-.12],[-.4,-.47],[.4,-.47],[.85,-.12],[1,.40],[.9,.65]];
  function hull(parent,length,width,material=white,trim=teal){
    const s=[[-.5*length,.77*width],[-.43*length,.94*width],[-.25*length,width],[.05*length,width],[.28*length,.86*width],[.42*length,.43*width],[.50*length,.006]];
    const body=loft(s,profile,[material,trim],parent,'折角浮体',j=>j===0||j===6?1:0);
    for(const sign of [-1,1])tube(s.slice(0,-1).map(([z,w])=>[sign*w, .38,z]),.034,mat.rubber,parent);
    return body;
  }
  function decal(text,w,h,pos,rotation,parent,color='#dce8e8'){
    const material=new THREE.MeshStandardMaterial({map:label(text,text.length<4?256:1024,text.length<4?256:192,color),transparent:true,roughness:.6,polygonOffset:true,polygonOffsetFactor:-2});
    const m=mesh(new THREE.PlaneGeometry(w,h),material,pos,parent,'艇身编号');m.rotation.set(...rotation);return m;
  }
  function topText(text,w,h,pos,parent,color){return decal(text,w,h,pos,[-Math.PI/2,0,Math.PI],parent,color);}
  function hatch(parent,x,y,z,w=.6,l=.7,material=white){
    box([w,.04,l],[x,y,z],mat.rubber,parent,.025);box([w-.055,.025,l-.055],[x,y+.035,z],material,parent,.02);
    for(const dx of [-1,1])for(const dz of [-1,1])cylinder(.019,.019,.011,[x+dx*(w/2-.06),y+.055,z+dz*(l/2-.06)],mat.metal,parent,6);
    rod([x-.10,y+.07,z],[x+.10,y+.07,z],.017,mat.metal,parent);
  }
  function solar(parent,x,y,z,w,l){
    box([w+.07,.05,l+.07],[x,y-.03,z],mat.metal,parent,.02);
    const panel=mesh(new THREE.PlaneGeometry(w,l),solarMat,[x,y,z],parent,'光伏电池板');panel.rotation.x=-Math.PI/2;
  }
  function cleat(parent,x,y,z){for(const d of [-.09,.09])cylinder(.024,.03,.09,[x+d,y+.03,z],mat.metal,parent);rod([x-.2,y+.09,z],[x+.2,y+.09,z],.025,mat.metal,parent);}
  function rail(parent,x,z1,z2,y,material=mat.metal){
    for(let z=z1;z<=z2+.02;z+=(z2-z1)/4){rod([x,y,z],[x,y+.42,z],.018,material,parent);cylinder(.037,.048,.035,[x,y,z],mat.metal,parent);}
    rod([x,y+.42,z1],[x,y+.42,z2],.022,material,parent);rod([x,y+.22,z1],[x,y+.22,z2],.012,material,parent);
  }
  function propeller(v,parent,x,y,z,size=.25){
    const support=box([.11,.44,.17],[x,y+.28,z+.19],mat.metal,parent);
    const motor=cylinder(size*.53,size*.62,.36,[x,y,z+.13],black,parent);motor.rotation.x=Math.PI/2;
    mesh(new THREE.TorusGeometry(size,.038,10,32),mat.metal,[x,y,z],parent);
    const rotor=group('螺旋桨叶轮',parent);rotor.position.set(x,y,z-.025);
    const hub=cylinder(.048,.064,.075,[0,0,0],mat.metal,rotor);hub.rotation.x=Math.PI/2;
    for(let i=0;i<3;i++){const a=i*Math.PI*2/3,m=box([size*.42,size*.81,.024],[Math.sin(a)*size*.55,Math.cos(a)*size*.55,0],orange,rotor,.025);m.rotation.z=-a;m.rotation.y=.25;}
    v.rotors.push(rotor);return support;
  }
  function optics(parent,x,y,z,material=white){
    cylinder(.13,.17,.10,[x,y,z],black,parent);cylinder(.055,.07,.17,[x,y+.1,z],mat.metal,parent);
    ellipsoid([.20,.19,.20],[x,y+.28,z],material,parent);
    for(const [d,r] of [[-.07,.067],[.09,.045]]){
      const ring=cylinder(r*1.3,r*1.3,.048,[x+d,y+.30,z+.17],black,parent);ring.rotation.x=Math.PI/2;
      const lens=cylinder(r,r,.012,[x+d,y+.30,z+.20],mat.lens,parent);lens.rotation.x=Math.PI/2;
    }
  }
  function mast(v,parent,x,y,z,h=1.4,material=white){
    cylinder(.065,.10,h,[x,y+h/2,z],material,parent);
    box([.98,.065,.17],[x,y+h-.22,z],black,parent);
    for(const dx of [-.41,.41]){cylinder(.022,.024,.17,[x+dx,y+h-.12,z],mat.metal,parent);cylinder(.10,.08,.045,[x+dx,y+h,z],white,parent);}
    cylinder(.13,.15,.10,[x,y+h+.06,z],black,parent);
    const r=group('旋转雷达',parent);r.position.set(x,y+h+.19,z);box([.84,.11,.17],[0,0,0],material,r,.035);v.scanners.push(r);
    rod([x+.26,y+h-.4,z-.07],[x+.26,y+h+.57,z-.07],.008,mat.dark,parent);
  }
  function lifering(parent,x,y,z,r=.23){const t=mesh(new THREE.TorusGeometry(r,.06,12,32),orange,[x,y,z],parent);t.rotation.x=Math.PI/2;for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const b=mesh(new THREE.TorusGeometry(r,.063,8,5,.27),white,[x,y+.002,z],parent);b.rotation.set(Math.PI/2,0,a);}}

  // 01 · A narrow central hull and two shortened outrigger hulls.
  const n=start('nereid','NEREID','01',{title:'循水而知',subtitle:'三体测绘无人艇',copy:'三体展翼，丈量水下地形。',purpose:'水深测绘 / 水质监测',length:'8.0',beam:'4.6',drive:'双侧电推进',accent:'#268e95',scale:1.05,wakeScale:1.55});
  const nh=part(n,'穿浪三体船壳',[2.0,.6,.3],'细长中央船体连接两侧短浮体，外伸桥架形成宽阔的三体布局。','船型 / 三体');
  hull(nh,8,.53,white,teal);
  for(const x of [-1.9,1.9]){const g=group('侧向稳定浮体',nh);g.position.set(x,-.03,-.3);hull(g,5.9,.39,white,teal);for(const z of [-1.8,1.3]){rod([x,.75,z],[0,.81,z],.075,mat.metal,nh);box([2.12,.12,.37],[x/2,.76,z],white,nh,.05);}cleat(nh,x,.69,1.4);}
  const ne=part(n,'跨体太阳能翼桥',[.92,.96,-.4],'两块光伏翼桥跨接主艇与侧浮体，中央留出仪器检修通道。','能源 / 光伏翼桥');
  for(const x of [-1.02,1.02])solar(ne,x,.94,-.32,1.22,2.3);
  box([.86,.36,2.0],[0,.86,-.40],white,ne,.09);hatch(ne,0,1.06,-.5,.68,1.16,teal);
  const ns=part(n,'双天线测绘桅杆',[0,2.9,-1.72],'高位双 GNSS 天线、旋转雷达与独立光电吊舱分层布置。','导航 / 高位基线');
  mast(n,ns,0,.90,-1.72,1.73,teal);optics(ns,0,.72,2.49);
  const nu=part(n,'可拆卸声呐探杆',[.53,-.38,1.40],'侧挂金属探杆将声呐单元送入水下；结构展示可查看横向换能器与防护支架。','测绘 / 水下换能器');
  rod([.34,.72,1.4],[.64,.72,1.4],.06,mat.metal,nu);rod([.64,.72,1.4],[.64,-.69,1.4],.04,mat.metal,nu);box([.54,.13,.24],[.64,-.72,1.4],black,nu,.03);
  const np=part(n,'侧浮体导管推进',[1.9,.05,-3.22],'两组推进器位于侧浮体艉端，中央艇尾保留拖曳和布放空间。','推进 / 分布式双推');
  for(const x of [-1.9,1.9])propeller(n,np,x,-.20,-3.23,.22);
  topText('NEREID 01',.57,.15,[0,.67,3.06],nh,'#176978');hatch(nh,0,.70,1.55,.61,.64);cleat(nh,0,.69,3.45);

  // 02 · Broad lenticular body and swept manta-like wing tips.
  const m=start('manta','MANTA','02',{title:'贴海轻行',subtitle:'仿生宽体无人艇',copy:'低伏海面，展开柔和的翼线。',purpose:'近岸观测 / 生态调查',length:'5.8',beam:'4.7',drive:'双舱矢量推进',accent:'#987399',scale:.90,wakeScale:1.35});
  const mh=part(m,'蝠鲼式宽翼船体',[1.63,.45,.3],'宽扁椭圆主体与后掠侧翼构成仿生轮廓，圆润边缘以紫灰色软质护边收口。','船型 / 仿生宽体');
  ellipsoid([1.54,.56,2.90],[0,.06,0],cream,mh);
  for(const sign of [-1,1]){
    const wing=loft([[-2.35,.05],[-1.9,.60],[-.5,.75],[1.4,.04]],[[-1,.21],[-1,.02],[0,-.10],[1,.02],[1,.21],[0,.42]],[cream,purple],mh,'后掠仿生侧翼',j=>j<4?1:0);wing.position.x=sign*1.61;
    tube([[sign*1.4,.22,1.15],[sign*2.17,.21,-.5],[sign*2.28,.15,-1.53],[sign*1.52,.16,-2.30]],.055,purple,mh);
  }
  const md=part(m,'全景感知穹顶',[0,1.10,.38],'中央低矮深色穹顶覆盖感知设备，环形基座上设置镜头与散热切槽。','感知 / 全景穹顶');
  cylinder(.61,.70,.12,[0,.63,.4],purple,md,48);ellipsoid([.58,.50,.77],[0,.70,.4],mat.glass,md);optics(md,0,.49,1.72,purple);
  for(let i=0;i<14;i++){const a=i*Math.PI*2/14;box([.035,.10,.07],[Math.sin(a)*.66,.66,.4+Math.cos(a)*.66],black,md,.007);}
  const me=part(m,'翼面分布式光伏',[1.23,.46,-.77],'四组窄光伏组件沿左右翼面铺设，避免遮挡中央穹顶视野。','能源 / 分布式光伏');
  for(const x of [-1.12,1.12])for(const z of [-1.12,-.10]){box([.39,.16,.76],[x,.51,z],cream,me,.025);solar(me,x,.60,z,.42,.83);}
  const mp=part(m,'双侧涵道推进',[1.45,-.05,-2.28],'侧翼下方安装两组独立导管推进模块，水下支架与三叶桨可在结构模式查看。','推进 / 翼下双推');
  for(const x of [-1.43,1.43])propeller(m,mp,x,-.24,-2.27,.28);
  const mt=part(m,'后缘通信与采水组件',[0,.94,-1.91],'低剖面通信天线与中央采水检修舱集成于后缘。','载荷 / 环境观测');
  hatch(mt,0,.53,-1.86,.65,.64,purple);rod([0,.57,-1.92],[0,1.25,-1.92],.026,purple,mt);ellipsoid([.11,.07,.11],[0,1.26,-1.92],white,mt);topText('MANTA 02',.83,.20,[0,.553,2.14],mh,'#695779');

  // 03 · Inflatable rescue RIB with an orange multi-chamber collar.
  const r=start('rescue','RESCUE','03',{title:'向援而行',subtitle:'充气救援无人艇',copy:'醒目橙色，靠近每一次呼救。',purpose:'水面救援 / 浮具投送',length:'6.4',beam:'2.9',drive:'双舷外电推进',accent:'#d46b39',scale:.95,wakeScale:.63});
  const rh=part(r,'闭合多气室充气护舷',[1.2,.75,.45],'橙色充气管沿艇艏、两舷和艇尾完整闭合；分舱接缝、充气阀与抓握绳均单独建模。','船型 / 闭合充气环');
  hull(rh,6.3,.97,navy,orange);
  const collarPoints=[[-1.06,.66,-2.80],[-1.13,.69,-1.2],[-1.1,.72,.8],[-.75,.75,2.24],[0,.77,2.77],[.75,.75,2.24],[1.1,.72,.8],[1.13,.69,-1.2],[1.06,.66,-2.80],[.78,.66,-2.99],[0,.66,-3.02],[-.78,.66,-2.99]];
  const collarPath=new THREE.CatmullRomCurve3(collarPoints.map(p=>new THREE.Vector3(...p)),true,'centripetal');
  mesh(new THREE.TubeGeometry(collarPath,224,.30,16,true),orange,[0,0,0],rh,'首尾连续闭合充气护舷');
  for(const x of [-.48,.48]){const seam=mesh(new THREE.TorusGeometry(.303,.020,8,28),black,[x,.66,-3.02],rh);seam.rotation.y=Math.PI/2;}
  rod([-.67,.91,-3.13],[.67,.91,-3.13],.018,mat.rubber,rh);
  for(const x of [-1.12,1.12])for(const z of [-2.2,-1,.2,1.25]){
    const band=mesh(new THREE.TorusGeometry(.303,.023,8,28),black,[x,.69,z],rh);band.rotation.x=0;
    cylinder(.044,.049,.025,[x,.99,z+.18],black,rh);
    rod([x*1.1,.87,z-.35],[x*1.1,.87,z+.32],.018,mat.rubber,rh);
  }
  const re=part(r,'救援浮具与软垫甲板',[.40,.93,-1.14],'开放后甲板配两组救生圈、抓握扶手和软垫，中央保持可接近的救援空间。','救援 / 浮具与扶手');
  box([1.48,.065,2.22],[0,.72,-1.37],nonSlip,re,.07);for(const x of [-.43,.43])lifering(re,x,.85,-1.35,.29);
  box([1.31,.10,.42],[0,.82,-2.55],black,re,.055);for(const x of [-.62,.62])rod([x,.78,-2.3],[x,1.08,-1.97],.028,mat.metal,re);
  const rs=part(r,'防护控制箱与搜寻塔',[0,2.48,.05],'紧凑防水控制箱上布置搜索感知塔，前向双光镜头和白色探照灯分开安装。','感知 / 搜救观察');
  box([.94,.65,1.02],[0,1.04,.30],white,rs,.11);box([.79,.10,.63],[0,1.41,.30],navy,rs,.06);mast(r,rs,0,1.43,.06,.89,orange);optics(rs,0,.80,1.58);
  for(const x of [-.35,.35]){const lamp=cylinder(.09,.10,.15,[x,1.47,.62],mat.white,rs);lamp.rotation.x=Math.PI/2;}
  const rw=part(r,'艏部拖带卷盘',[0,1.04,2.12],'艇艏绞盘带金属卷筒、卷缆和导缆器，供救援拖带概念展示。','作业 / 拖带卷盘');
  box([.50,.12,.43],[0,.88,2.06],navy,rw);const spool=cylinder(.15,.15,.35,[0,1.08,2.06],black,rw);spool.rotation.z=Math.PI/2;
  for(let i=-4;i<=4;i++){const ring=mesh(new THREE.TorusGeometry(.153,.012,8,24),mat.metal,[i*.036,1.08,2.06],rw);ring.rotation.y=Math.PI/2;}
  cleat(rw,0,.82,2.56);
  const rp=part(r,'独立支架双舷外电机',[.65,.70,-3.62],'双舷外机安装在闭合护舷外侧的独立后伸支架上；支架从艇尾下方伸出，避免电机罩穿过充气管。','推进 / 外置双电机');
  for(const x of [-.62,.62]){
    box([.31,.15,.43],[x,.19,-2.79],navy,rp,.025);
    for(const dx of [-.10,.10]){
      rod([x+dx,.24,-2.75],[x+dx,.24,-3.57],.037,mat.metal,rp);
      rod([x+dx,.24,-3.57],[x+dx,.53,-3.57],.037,mat.metal,rp);
    }
    box([.33,.10,.23],[x,.49,-3.57],black,rp,.025);
    box([.42,.55,.54],[x,.78,-3.62],navy,rp,.10);
    rod([x,.54,-3.66],[x,-.43,-3.71],.085,mat.metal,rp);
    propeller(r,rp,x,-.48,-3.80,.20);
  }
  topText('RESCUE 03',.63,.16,[0,1.474,.27],rs,'#e5ecea');

  // 04 · High-sided red polar survey boat with shelter and instrument buoys.
  const p=start('polar','POLAR','04',{title:'驶向高纬',subtitle:'极地调查无人艇',copy:'高艏红壳，迎向辽阔寒海。',purpose:'海气观测 / 高纬调查',length:'8.6',beam:'3.1',drive:'双轴电推进',accent:'#b95353',scale:1.08,wakeScale:.73});
  const ph=part(p,'高艏加强概念船壳',[1.38,.68,1.38],'上扬高艏与红色高舷墙形成极地调查风格；外观为概念设计，不代表已验证的破冰能力。','船型 / 高艏调查艇');
  loft([[-4.1,1.20],[-3.2,1.48],[-1,1.55],[1.5,1.47,.13],[2.8,1.08,.33],[3.8,.45,.45],[4.2,.006,.50]],[[-.93,1.0],[-1,.65],[-.88,-.18],[-.47,-.62],[.47,-.62],[.88,-.18],[1,.65],[.93,1]],[red,navy],ph,'高舷红色船壳',j=>j===7?1:0);
  for(const x of [-1.45,1.45]){rod([x,.57,-3.5],[x,.57,1.25],.068,black,ph);decal('POLAR 04',1.50,.26,[Math.sign(x)*1.557,.72,-.8],[0,Math.sign(x)*Math.PI/2,0],ph);}
  const pc=part(p,'保温仪器舱',[0,2.04,.52],'圆角白色设备舱配深色观测带、检修门和扶梯，体现高纬环境中的防护设计语言。','设备 / 保温舱');
  box([2.03,1.14,2.6],[0,1.58,.26],white,pc,.18);box([2.07,.12,2.64],[0,2.20,.26],navy,pc,.09);box([1.62,.30,.032],[0,1.87,1.577],mat.glass,pc,.08);
  for(const x of [-1.022,1.022])box([.022,.3,1.6],[x,1.86,.25],mat.glass,pc,.07);
  box([.62,.82,.034],[.38,1.51,-1.06],red,pc,.04);for(let i=0;i<4;i++)rod([-.77,1.05+i*.25,-1.11],[-.38,1.05+i*.25,-1.11],.021,mat.metal,pc);
  const ps=part(p,'气象塔与卫星天线',[0,3.59,-.25],'气象塔搭载雷达、GNSS 和风速杯，独立卫星天线罩置于仪器舱顶部。','观测 / 海气交互');
  mast(p,ps,0,2.27,-.22,1.15,red);ellipsoid([.35,.36,.35],[.54,2.54,.86],white,ps);cylinder(.27,.30,.08,[.54,2.25,.86],navy,ps);
  const cups=group('旋转风速杯',ps);cups.position.set(-.55,3.05,-.68);rod([-.55,2.25,-.68],[-.55,3.05,-.68],.017,mat.metal,ps);
  for(let i=0;i<3;i++){const a=i*2*Math.PI/3;rod([0,0,0],[Math.cos(a)*.22,0,Math.sin(a)*.22],.009,mat.metal,cups);ellipsoid([.055,.035,.055],[Math.cos(a)*.22,0,Math.sin(a)*.22],black,cups);}p.scanners.push(cups);
  const pb=part(p,'艉甲板观测浮标',[.72,1.70,-2.68],'两枚可布放浮标固定于后甲板支架，配黄色浮体、传感杆与小型太阳能板。','载荷 / 海洋浮标');
  box([2.5,.06,2.16],[0,1.05,-2.65],nonSlip,pb,.03);
  for(const x of [-.66,.66]){ellipsoid([.32,.27,.32],[x,1.36,-2.68],yellow,pb);cylinder(.028,.03,.96,[x,1.86,-2.68],mat.metal,pb);solar(pb,x,1.79,-2.68,.40,.36);cylinder(.075,.08,.05,[x,2.34,-2.68],white,pb);}
  rail(pb,-1.28,-3.67,-1.66,1.05,white);rail(pb,1.28,-3.67,-1.66,1.05,white);
  const pp=part(p,'艉部双轴与舵叶',[.79,-.10,-4.01],'两组受保护的螺旋桨和独立舵叶安装在艇艉，结构模式可观察水下布局。','推进 / 双轴双舵');
  for(const x of [-.79,.79]){propeller(p,pp,x,-.32,-4.0,.27);box([.035,.41,.30],[x,-.34,-4.30],navy,pp);}
  optics(pc,0,1.48,2.64);cleat(ph,0,1.49,3.55);

  // 05 · Two transverse hydrofoils and a raised slender silver body.
  const k=start('kestrel','KESTREL','05',{title:'掠水而飞',subtitle:'水翼试验无人艇',copy:'银色细艇，连接水面与翼面。',purpose:'水翼研究 / 快速观测',length:'7.4',beam:'3.2',drive:'翼下电推进',accent:'#427eae',scale:.98,wakeScale:.6,floorY:-1.65});
  const kh=part(k,'流线银色主船体',[.70,.55,1.0],'窄长船体以银色表面和蓝色脊线构成试验艇风格，后甲板配置齐平检修舱。','船型 / 细长试验艇');
  hull(kh,7.4,.74,silver,blue);ellipsoid([.49,.34,1.35],[0,.74,.3],black,kh);topText('KESTREL 05',.75,.18,[0,.673,2.68],kh,'#285d80');hatch(kh,0,.69,-2.34,.80,.64,blue);
  const kf=part(k,'前后 T 形水翼',[1.1,-1.05,1.20],'前后支柱连接横向水翼，翼端小翼与薄翼剖面单独建模。切换结构展示可查看完整翼面。','水翼 / 升力面');
  for(const [z,span] of [[1.2,1.58],[-2.15,1.2]]){
    const strut=box([.075,1.30,.36],[0,-.49,z],blue,kf,.025);strut.rotation.x=.13;
    const wing=ellipsoid([span,.062,.34],[0,-1.10,z],silver,kf);
    for(const x of [-span*.94,span*.94]){const tip=box([.035,.27,.26],[x,-.995,z],blue,kf,.025);tip.rotation.z=-Math.sign(x)*.22;}
    rod([-.05,-.85,z-.16],[.05,-.85,z+.16],.015,mat.metal,kf);
  }
  const ks=part(k,'后掠传感支架',[0,2.17,-.81],'后掠支架保持低迎风面积，顶端集成雷达，艏部设置独立光电传感器。','感知 / 后掠桅杆');
  rod([0,.96,-1.2],[0,2.12,-1.0],.048,silver,ks);mast(k,ks,0,1.9,-1.0,.22,blue);optics(ks,0,1.0,.6,blue);
  const ke=part(k,'翼根驱动与密封舱',[0,.85,-1.78],'后部设备舱通过翼柱连接水下推进模块，带外露检修紧固件和双侧散热开口。','设备 / 水翼驱动');
  box([.62,.26,.95],[0,.78,-1.59],blue,ke,.065);for(const x of [-.317,.317])for(let i=0;i<7;i++)box([.015,.12,.023],[x,.78,-1.88+i*.087],black,ke,.004);
  const kp=part(k,'翼下双电动推进',[.48,-1.05,-2.48],'两组小型电推进器位于后翼两侧，导管、支架和桨叶均可在结构模式查看。','推进 / 浸没式双推');
  for(const x of [-.48,.48])propeller(k,kp,x,-1.07,-2.49,.18);

  // 07 · Tall rigid wing sail with separate trailing flap and exposed rigging.
  const d=start('drift','DRIFT','07',{title:'借风远航',subtitle:'翼帆观测无人艇',copy:'一面翼帆，驶入漫长的观测。',purpose:'长航时观测 / 风帆研究',length:'7.6',beam:'2.1',drive:'辅助电推进',driveCount:'1',accent:'#aa8053',scale:1.16,wakeScale:.0,targetHeight:1.6,floorY:-1.9});
  const dh=part(d,'细长压载船体',[.87,.58,1.1],'奶油色窄体船壳搭配深蓝舷缘，下方设深鳍与压载体，形成翼帆无人艇轮廓。','船型 / 深鳍单体');
  hull(dh,7.6,1.04,cream,navy);box([.13,1.46,.60],[0,-.87,-.1],navy,dh,.05);ellipsoid([.16,.16,.72],[0,-1.60,-.1],silver,dh);
  const ds=part(d,'可转刚性翼帆',[0,4.40,.42],'硬质主翼、橙色翼尖与独立后缘襟翼构成帆面；这是几何展示，未进行气动求解。','风帆 / 主翼与襟翼');
  cylinder(.18,.23,.17,[0,.77,.2],navy,ds);rod([0,.83,.2],[0,5.5,.2],.049,mat.metal,ds);
  const sail=ellipsoid([.085,2.25,.81],[0,3.20,.22],cream,ds);
  const tip=ellipsoid([.089,.27,.42],[0,5.20,.22],orange,ds);
  const flap=ellipsoid([.059,2.00,.17],[.01,3.16,-.65],navy,ds);
  for(const y of [1.65,3.18,4.64])rod([0,y,-.42],[.01,y,-.65],.017,mat.metal,ds);
  for(const y of [1.35,2.15,3.05,3.95,4.75])rod([.085,y,-.41],[.085,y,.80],.008,silver,ds);
  decal('07',.59,.62,[.098,3.45,.28],[0,Math.PI/2,0],ds,'#28516a');
  decal('07',.59,.62,[-.098,3.45,.28],[0,-Math.PI/2,0],ds,'#28516a');
  const de=part(d,'甲板光伏与航电',[.52,.71,-1.82],'左右光伏电池带沿狭窄甲板铺设，尾端检修舱容纳辅助能源与航电设备。','能源 / 风光互补布局');
  for(const x of [-.55,.55])solar(de,x,.69,-1.21,.35,2.32);hatch(de,0,.69,-2.55,.70,.65,navy);topText('DRIFT 07',.69,.17,[0,.679,2.83],dh,'#506471');
  const dt=part(d,'艉部海气传感塔',[0,2.09,-2.55],'细长艉桅带通信天线与风向传感部件，远离主帆前缘以便查看。','观测 / 海气传感');
  rod([0,.71,-2.55],[0,2.10,-2.55],.023,mat.metal,dt);box([.62,.04,.09],[0,2.10,-2.55],navy,dt);cylinder(.07,.09,.06,[0,2.16,-2.55],white,dt);
  rod([-.83,.71,-.84],[0,4.7,.2],.008,mat.metal,ds);rod([.83,.71,-.84],[0,4.7,.2],.008,mat.metal,ds);optics(dt,0,.71,1.94,cream);
  const dp=part(d,'辅助推进与艉舵',[0,-.35,-3.73],'单组辅助电推进器配长舵叶用于低风条件的概念布局，深鳍及舵面可在结构模式查看。','推进 / 辅助电推');
  propeller(d,dp,0,-.45,-3.58,.21);box([.044,.93,.40],[0,-.47,-3.85],navy,dp,.035);

  // 08 · Wide modular pontoon platform, service container, large knuckle crane, ROV.
  const a=start('atlas','ATLAS','08',{title:'承载更多可能',subtitle:'模块化作业无人艇',copy:'宽阔平台，搭载水上工作站。',purpose:'设备运载 / 水下作业',length:'8.0',beam:'4.8',drive:'双浮体电推进',accent:'#c57637',scale:1.12,wakeScale:1.62});
  const ah=part(a,'双浮筒工作平台',[2.0,.65,1.0],'两条宽浮筒支撑整幅平甲板，连接桥、边缘防撞块和外露系泊柱突出模块化作业风格。','船型 / 双浮筒平台');
  for(const x of [-1.7,1.7]){const g=group('箱式工作浮筒',ah);g.position.x=x;hull(g,8,.70,blue,orange);for(const z of [-2.7,-1.0,.8,2.3])box([.15,.32,.46],[x+Math.sign(x)*.69,.31,z],black,ah,.07);}
  box([4.20,.22,6.44],[0,.76,-.30],silver,ah,.08);box([4.04,.045,6.28],[0,.90,-.3],nonSlip,ah,.04);
  for(const x of [-1.95,1.95])for(const z of [-3.15,2.55])cleat(ah,x,.94,z);
  for(const x of [-2.0,2.0])rail(ah,x,-3,2.5,.93,orange);
  const ac=part(a,'可换装设备集装舱',[-.64,1.94,.73],'偏置蓝色模块舱设置波纹侧板、双开检修门、锁杆与角件，后方留出设备吊运空间。','载荷 / 标准化舱段');
  box([1.75,1.3,2.67],[-.63,1.61,.53],blue,ac,.025);
  for(const x of [-1.52,.26])for(let i=0;i<18;i++)box([.026,1.12,.045],[x,1.61,-.69+i*.14],silver,ac,.006);
  for(const x of [-1.065,-.195]){box([.81,1.17,.035],[x,1.61,1.884],white,ac,.015);rod([x,1.08,1.919],[x,2.14,1.919],.017,mat.metal,ac);}
  for(const x of [-1.43,.17])for(const z of [-.73,1.80])box([.14,.14,.14],[x,2.28,z],orange,ac,.007);
  topText('ATLAS / 08',1.22,.30,[-.63,2.275,.59],ac,'#ddebf0');
  const ar=part(a,'重型折臂甲板吊机',[1.08,2.85,-1.39],'橙色双节吊臂配回转座、活塞杆、油管和吊钩，伸向后甲板的水下载荷。','机械 / 模块吊运');
  cylinder(.31,.39,.18,[1.0,1.04,-.79],navy,ar);cylinder(.22,.25,.67,[1,1.43,-.79],orange,ar);
  rod([1,1.73,-.79],[1,3.03,-1.35],.14,orange,ar);rod([1,3.03,-1.35],[1,2.31,-2.75],.115,orange,ar);
  rod([1.18,1.55,-.76],[1.18,2.45,-1.1],.052,navy,ar);rod([1.18,2.01,-.92],[1.18,2.88,-1.28],.028,mat.metal,ar);
  tube([[.82,1.15,-.74],[.82,2.0,-.90],[.82,3.06,-1.35],[.82,2.29,-2.77]],.022,black,ar);rod([1,2.27,-2.76],[1,1.69,-2.76],.012,black,ar);
  mesh(new THREE.TorusGeometry(.08,.018,10,20,Math.PI*1.6),mat.metal,[1,1.62,-2.76],ar);
  const av=part(a,'框架式水下载荷',[.77,1.30,-2.52],'小型 ROV 概念载荷采用金属框架、黄色浮力块、前向双镜头和侧向推进器。','载荷 / 水下机器人');
  for(const x of [.36,1.24])for(const z of [-3.0,-2.02])rod([x,1.02,z],[x,1.54,z],.025,mat.metal,av);
  for(const y of [1.02,1.54]){for(const x of [.36,1.24])rod([x,y,-3],[x,y,-2.02],.025,mat.metal,av);for(const z of [-3,-2.02])rod([.36,y,z],[1.24,y,z],.025,mat.metal,av);}
  box([.98,.19,.85],[.8,1.52,-2.5],yellow,av,.08);box([.53,.26,.61],[.8,1.24,-2.5],navy,av,.04);
  for(const x of [.61,.99]){const eye=cylinder(.063,.067,.11,[x,1.28,-1.966],mat.lens,av);eye.rotation.x=Math.PI/2;}
  const at=part(a,'通信桅杆与平台推进',[-.63,3.33,.34],'舱顶通信塔提供高位观察点，艉部两套导管推进器驱动整个作业平台。','系统 / 平台控制');
  mast(a,at,-.63,2.35,.3,.91,white);optics(at,-.63,2.34,1.18);for(const x of [-1.7,1.7])propeller(a,at,x,-.22,-4.0,.28);
  return boats;
}
