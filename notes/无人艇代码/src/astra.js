import * as THREE from 'three';

// ASTRA P0 catamaran prototype, extracted from the original vessel showcase.
export function buildAstra(api) {
  const {group,mesh,box,cylinder,rod,tube,label,mat,nonSlip,solarMat}=api;
  const root=new THREE.Group();root.name='ASTRA P0 · 双体测绘原型艇';
  const stations=[[-3.8,.43],[-3.55,.53],[-2.6,.59],[-1.3,.62],[0,.62],[1.35,.60],[2.35,.52],[3.05,.36],[3.55,.18],[3.9,.055],[4,.012]];
  const ring=[[-.9,.68],[-1,.49],[-1,.23],[-.77,-.32],[-.3,-.57],[.3,-.57],[.77,-.32],[1,.23],[1,.49],[.9,.68]];
  function hull(cx){
    const g=group(cx<0?'左舷浮体':'右舷浮体',root);
    const vertices=[],indices=[],geo=new THREE.BufferGeometry();
    stations.forEach(([z,w])=>ring.forEach(([x,y])=>vertices.push(cx+x*w,y+Math.max(0,z-2.1)*.07,z)));
    for(let s=0;s<stations.length-1;s++)for(let j=0;j<ring.length;j++){
      const a=s*10+j,b=s*10+(j+1)%10,c=(s+1)*10+j,d=(s+1)*10+(j+1)%10,start=indices.length;
      indices.push(a,b,c,b,d,c);geo.addGroup(start,6,j===0||j===8?1:j===9?2:0);
    }
    for(let j=1;j<9;j++){const start=indices.length;indices.push(0,j+1,j);geo.addGroup(start,3,0);}
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
    mesh(geo,[mat.white,mat.orange,mat.deck],[0,0,0],g,'分段放样复合材料艇壳');
    for(const sign of [-1,1]){
      tube(stations.slice(0,-1).map(([z,w])=>[cx+sign*w*1.015,.45+Math.max(0,z-2.1)*.07,z]),.045,mat.rubber,g);
      tube(stations.slice(0,-2).map(([z,w])=>[cx+sign*w*.89,-.02+Math.max(0,z-2.1)*.07,z]),.015,mat.dark,g);
    }
    for(const z of [-2.9,2.5]){
      box([.47,.04,.55],[cx,.74,z],mat.dark,g,.03);
      box([.40,.025,.48],[cx,.766,z],nonSlip,g,.02);
      for(const dx of [-.16,.16])for(const dz of [-.19,.19])cylinder(.016,.016,.009,[cx+dx,.785,z+dz],mat.metal,g,8);
    }
    for(const z of [-3.35,2.95]){
      for(const dx of [-.13,.13])cylinder(.027,.035,.10,[cx+dx,.82,z],mat.metal,g);
      rod([cx-.24,.87,z],[cx+.24,.87,z],.032,mat.metal,g);
    }
    for(const z of [-2.2,-.9,.4,1.7])for(const dx of [-.48,.48])cylinder(.018,.018,.008,[cx+dx,.705,z],mat.metal,g,8);
    return g;
  }
  hull(-1.12);hull(1.12);
  const deck=group('连接桥与防滑工作甲板',root);
  box([2.7,.23,4.95],[0,.71,-.38],mat.white,deck,.12);
  box([2.52,.05,4.73],[0,.854,-.38],nonSlip,deck,.075);
  for(const x of [-1.28,1.28])box([.07,.065,4.7],[x,.88,-.38],mat.metal,deck,.012);
  for(const z of [-2.4,1.2])box([2.95,.23,.22],[0,.44,z],mat.dark,deck);
  box([1.16,.11,1.2],[0,.78,2.62],mat.white,deck,.13);
  box([.55,.07,.75],[0,.88,2.6],nonSlip,deck);
  const eye=mesh(new THREE.TorusGeometry(.10,.026,10,24),mat.metal,[0,1.0,3.05],deck);eye.rotation.y=Math.PI/2;
  const energy=group('太阳能阵列与电子设备舱',root);
  box([1.86,.71,2.72],[0,1.18,-.36],mat.white,energy,.17);
  box([1.89,.09,2.76],[0,1.51,-.36],mat.dark,energy,.06);
  for(const x of [-.48,.48]){
    box([.88,.065,2.58],[x,1.58,-.36],mat.metal,energy,.025);
    const panel=mesh(new THREE.PlaneGeometry(.81,2.5),solarMat,[x,1.616,-.36],energy,'单晶硅太阳能电池板');panel.rotation.x=-Math.PI/2;
  }
  for(const x of [-.943,.943]){
    for(let i=0;i<12;i++)box([.019,.18,.037],[x,1.17,-1.32+i*.105],mat.dark,energy,.004);
    for(const z of [-1.6,.78])box([.035,.21,.08],[x,1.23,z],mat.metal,energy,.007);
  }
  box([1.19,.31,.045],[0,1.18,1.025],mat.glass,energy,.05);
  for(const x of [-.75,.75])cylinder(.035,.035,.02,[x,1.54,.87],mat.metal,energy);
  const brand=new THREE.MeshStandardMaterial({map:label('ASTRA  P0',1024,192,'#263f49'),transparent:true,roughness:.5,polygonOffset:true,polygonOffsetFactor:-2});
  for(const x of [-1,1]){const l=mesh(new THREE.PlaneGeometry(2.05,.385),brand,[x*1.743,.25,-.48],root,'船体编号');l.rotation.y=x*Math.PI/2;}
  mesh(new THREE.PlaneGeometry(.58,.16),new THREE.MeshStandardMaterial({map:label('ASTRA',512,128,'#e8edee'),transparent:true}),[0,1.192,1.053],energy);
  const sensors=group('传感桅杆与自主导航',root);
  box([.66,.14,.67],[0,.98,-2.0],mat.dark,sensors);
  box([.35,.87,.36],[0,1.45,-2],mat.orange,sensors,.08);
  cylinder(.11,.14,1.25,[0,2.41,-2],mat.white,sensors);
  for(const x of [-.48,.48])rod([x,.93,-2.28],[0,2.13,-2],.035,mat.metal,sensors);
  tube([[.14,1.05,-1.85],[.18,1.65,-1.85],[.14,2.14,-1.89],[.13,2.75,-1.94]],.018,mat.rubber,sensors);
  box([1.74,.075,.16],[0,2.6,-2],mat.dark,sensors);
  for(const x of [-.78,.78]){
    cylinder(.025,.035,.29,[x,2.76,-2],mat.metal,sensors);
    cylinder(.14,.11,.07,[x,2.925,-2],mat.white,sensors,28);
    mesh(new THREE.SphereGeometry(.12,24,12,0,Math.PI*2,0,Math.PI/2),mat.white,[x,2.956,-2],sensors);
  }
  cylinder(.26,.22,.09,[0,3.055,-2],mat.dark,sensors,32);
  cylinder(.27,.25,.22,[0,3.20,-2],mat.white,sensors,32);
  const radar=group('雷达扫描阵列',sensors);radar.position.set(0,3.37,-2);
  box([1.13,.14,.2],[0,0,0],mat.white,radar,.06);
  box([.86,.062,.012],[0,0,.102],mat.dark,radar,.01);
  for(const x of [-.38,.38]){
    rod([x,2.65,-2.16],[x,3.43,-2.16],.012,mat.dark,sensors);
    cylinder(.023,.023,.13,[x,2.73,-2.16],mat.rubber,sensors);
  }
  rod([.38,3.43,-2.16],[.38,3.7,-2.16],.007,mat.metal,sensors);
  for(const x of [-1.35,1.35]){
    box([.15,.12,.22],[x,.94,.6],mat.dark,root);
    box([.14,.075,.14],[x,1.02,.6],x<0?mat.red:mat.green,root);
  }
  const camera=group('光电感知吊舱',root);
  cylinder(.15,.21,.13,[0,1.00,2.45],mat.dark,camera);
  cylinder(.075,.10,.23,[0,1.18,2.45],mat.metal,camera);
  box([.51,.12,.37],[0,1.3,2.45],mat.dark,camera,.04);
  for(const x of [-.21,.21])box([.07,.28,.27],[x,1.40,2.45],mat.white,camera);
  mesh(new THREE.SphereGeometry(.225,32,20),mat.white,[0,1.49,2.45],camera);
  for(const [x,r] of [[-.08,.09],[.105,.055]]){
    const housing=cylinder(r*1.2,r*1.2,.065,[x,1.51,2.647],mat.dark,camera,24);housing.rotation.x=Math.PI/2;
    const lens=cylinder(r,r,.008,[x,1.51,2.684],mat.lens,camera,32);lens.rotation.x=Math.PI/2;
  }
  cylinder(.17,.17,.18,[0,2.22,-1.78],mat.dark,sensors,28);
  cylinder(.176,.176,.05,[0,2.235,-1.78],mat.glass,sensors,28);
  box([.31,.055,.30],[0,2.345,-1.78],mat.white,sensors);
  const propulsion=group('双电机与导管推进器',root);
  for(const x of [-1.12,1.12]){
    box([.34,.13,.40],[x,.72,-3.40],mat.dark,propulsion);
    box([.12,.65,.18],[x,.29,-3.72],mat.metal,propulsion);
    const motor=cylinder(.16,.19,.52,[x,-.19,-3.63],mat.dark,propulsion,24);motor.rotation.x=Math.PI/2;
    mesh(new THREE.TorusGeometry(.275,.049,12,36),mat.metal,[x,-.19,-3.94],propulsion,'推进器保护导管');
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])rod([x,-.19,-3.94],[x+Math.cos(a)*.27,-.19+Math.sin(a)*.27,-3.94],.016,mat.metal,propulsion);
    const rotor=group('三叶螺旋桨',propulsion);rotor.position.set(x,-.19,-3.96);
    const hub=cylinder(.065,.08,.11,[0,0,0],mat.orange,rotor);hub.rotation.x=Math.PI/2;
    for(let j=0;j<3;j++){
      const blade=box([.115,.22,.032],[Math.sin(j*2.094)*.135,Math.cos(j*2.094)*.135,0],mat.orange,rotor,.04);
      blade.rotation.z=-j*2.094;blade.rotation.y=.3;
    }
    box([.036,.24,.28],[x,-.61,-3.65],mat.dark,propulsion);
  }
  for(const x of [-1.40,1.40]){
    for(const z of [-2.45,-1.2,.15,1.5]){
      cylinder(.043,.055,.045,[x,.75,z],mat.metal,root);
      rod([x,.76,z],[x,1.19,z],.017,mat.metal,root);
    }
    tube([[x,1.03,-2.70],[x,1.19,-2.45],[x,1.19,-1.2],[x,1.19,.15],[x,1.19,1.5],[x,1.03,1.74]],.02,mat.metal,root);
    rod([x,.95,-2.45],[x,.95,1.5],.009,mat.metal,root);
  }
  box([1.05,.065,.50],[0,.91,-2.70],mat.dark,root);
  box([.98,.032,.43],[0,.956,-2.70],mat.white,root);
  rod([-.15,.993,-2.7],[.15,.993,-2.7],.018,mat.metal,root);
  const buoy=mesh(new THREE.TorusGeometry(.245,.065,12,40),mat.orange,[.66,1.00,-2.60],root);buoy.rotation.x=Math.PI/2;
  for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
    const band=mesh(new THREE.TorusGeometry(.245,.067,10,5,.23),mat.white,[.66,1.002,-2.60],root);band.rotation.set(Math.PI/2,0,a);
  }
  for(const x of [-1.65,1.65])for(const z of [-1.8,.7]){
    cylinder(.085,.085,.32,[x,.36,z],mat.rubber,root,16);
    rod([x,.53,z],[x*.91,.82,z],.013,mat.rubber,root);
  }
  return {id:'astra',root,name:'ASTRA',number:'P0'};
}
