// 坦克大厦：真正的 WebGL 3D 室内实景。
// 大厦内可自由走动，包含补给商店、仓库和独立训练场。
let tankTowerActive = false;
let tankTowerKeys = {};
let tankTowerState = null;

async function ensureTankTower3D() {
  if (window.__tankTower3D) return window.__tankTower3D;

  const THREE = await import("https://esm.sh/three@0.180.0");
  const { OrbitControls } = await import("https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js");

  const modal = document.createElement("div");
  modal.id = "tank-tower-world";
  modal.className = "tank-tower-world hidden";
  modal.innerHTML = `
    <div class="tank-tower-topbar">
      <b>🏢 坦克大厦 · 3D内部</b>
      <span>🪙 <b id="tank-tower-coins">0</b></span>
      <button type="button" id="tank-tower-exit">离开大厦</button>
    </div>
    <div id="tank-tower-3d-host"></div>
    <div id="tank-tower-hint">方向键移动 · E互动 · 鼠标左键旋转相机 · 滚轮缩放 · C重置相机</div>
    <div id="tank-tower-panel" class="tank-tower-panel hidden"></div>`;
  document.querySelector("#canvas-wrap")?.appendChild(modal);

  const host = modal.querySelector("#tank-tower-3d-host");
  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x12171d);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12171d);

  scene.add(new THREE.HemisphereLight(0xcde7ff,0x252b2f,1.55));
  const light = new THREE.DirectionalLight(0xffffff,1.8);
  light.position.set(5,10,4);
  light.castShadow = true;
  scene.add(light);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18,14),
    new THREE.MeshStandardMaterial({color:0x3c454b,roughness:.92})
  );
  floor.rotation.x = -Math.PI/2;
  floor.receiveShadow = true;
  scene.add(floor);

  // 墙体
  const wallMat = new THREE.MeshStandardMaterial({color:0x6a747d,roughness:.85});
  function wall(x,y,z,w,h,d){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wallMat);
    m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;
  }
  wall(0,2.2,-7,18,4.4,.28);
  wall(-9,2.2,0,.28,4.4,14);
  wall(9,2.2,0,.28,4.4,14);

  // 商店柜台
  const counterMat=new THREE.MeshStandardMaterial({color:0x366072,roughness:.65});
  const counter=new THREE.Mesh(new THREE.BoxGeometry(4.8,1.1,.8),counterMat);
  counter.position.set(-5.2,.55,-4.4);counter.castShadow=true;scene.add(counter);
  const shopSign=new THREE.Mesh(new THREE.BoxGeometry(3.7,.65,.18),new THREE.MeshStandardMaterial({color:0x53c9b2,emissive:0x143b35,emissiveIntensity:.6}));
  shopSign.position.set(-5.2,2.25,-5.8);scene.add(shopSign);

  // 仓库货架
  const shelfMat=new THREE.MeshStandardMaterial({color:0x72533d,roughness:.9});
  for(let row=0;row<3;row++){
    const shelf=new THREE.Mesh(new THREE.BoxGeometry(4.3,.14,.7),shelfMat);
    shelf.position.set(5.1,.55+row*.72,-4.8);shelf.castShadow=true;scene.add(shelf);
  }
  for(const x of [3.1,7.1]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.15,2.3,.75),shelfMat);
    post.position.set(x,1.15,-4.8);scene.add(post);
  }

  // 训练区：与射击靶场不同，做路线/绕桩/检查点
  const trainFloor=new THREE.Mesh(new THREE.BoxGeometry(13.8,.06,4.2),new THREE.MeshStandardMaterial({color:0x273b31,roughness:1}));
  trainFloor.position.set(0,.03,3.8);scene.add(trainFloor);

  const checkpoints=[];
  const cps=[[-5,2.6],[-3.2,4.8],[-.8,2.8],[1.7,5],[4.1,2.9],[6.1,4.6]];
  cps.forEach((p,i)=>{
    const cone=new THREE.Mesh(new THREE.ConeGeometry(.22,.65,12),new THREE.MeshStandardMaterial({color:i===0?0xffd24d:0xff7d3c}));
    cone.position.set(p[0],.33,p[1]);cone.castShadow=true;scene.add(cone);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.52,.06,8,24),new THREE.MeshStandardMaterial({color:0xffd24d,emissive:0x4a3500,emissiveIntensity:.5}));
    ring.rotation.x=Math.PI/2;ring.position.set(p[0],.12,p[1]);scene.add(ring);
    checkpoints.push({x:p[0],z:p[1],ring});
  });

  // 人物模型
  const body=new THREE.Mesh(new THREE.BoxGeometry(.42,.72,.3),new THREE.MeshStandardMaterial({color:0x56c271}));
  body.position.y=.72;
  const head=new THREE.Mesh(new THREE.SphereGeometry(.23,18,12),new THREE.MeshStandardMaterial({color:0xe2aa82}));
  head.position.y=1.28;
  const human=new THREE.Group();human.add(body,head);scene.add(human);

  // 空间标签用简单发光柱标识
  function beacon(x,z,color){
    const g=new THREE.Group();
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.08,20),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.25}));
    base.position.y=.04;g.add(base);g.position.set(x,0,z);scene.add(g);return g;
  }
  beacon(-5.2,-3.2,0x53c9b2);
  beacon(5.2,-3.2,0xd49b53);
  beacon(0,2.1,0x6acb63);

  const camera=new THREE.PerspectiveCamera(55,1,.05,80);
  camera.position.set(9,8,10);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.target.set(0,.8,0);
  controls.enableDamping=true;
  controls.minDistance=4;
  controls.maxDistance=22;
  controls.maxPolarAngle=Math.PI*.49;

  function resize(){
    const r=host.getBoundingClientRect();
    const w=Math.max(1,Math.floor(r.width)),h=Math.max(1,Math.floor(r.height));
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);

  function resetCamera(){camera.position.set(9,8,10);controls.target.set(0,.8,0);controls.update();}

  const api={THREE,modal,renderer,scene,camera,controls,human,checkpoints,resetCamera};
  window.__tankTower3D=api;
  return api;
}

function tankTowerSetHint(text){
  const el=document.getElementById("tank-tower-hint");if(el)el.textContent=text;
}

function tankTowerRefreshCoins(){
  const el=document.getElementById("tank-tower-coins");if(el)el.textContent=islandData?.coins||0;
}

function towerSupplyRows(){
  return ISLAND_TANK_FOOD.map(item=>{
    const count=islandData.supplies?.[item.id]||0;
    return `<div class="tank-tower-row"><span><b>${item.icon} ${item.name}</b><small>${item.desc||""} · 已有${count}</small></span><button data-tower-buy="${item.id}">${item.price}金币</button></div>`;
  }).join("");
}

function openTowerSupplyShop(){
  const panel=document.getElementById("tank-tower-panel");
  panel.classList.remove("hidden");
  panel.innerHTML=`<div class="tank-tower-panel-head"><b>🛒 坦克补给商店</b><button data-tower-close>关闭</button></div>${towerSupplyRows()}`;
  panel.onclick=(e)=>{
    if(e.target.closest("[data-tower-close]")){panel.classList.add("hidden");return;}
    const btn=e.target.closest("[data-tower-buy]");if(!btn)return;
    const item=ISLAND_TANK_FOOD.find(x=>x.id===btn.dataset.towerBuy);if(!item)return;
    if(!spendIslandCoins(item.price)){tankTowerSetHint("金币不足。");return;}
    islandData.supplies[item.id]=(islandData.supplies[item.id]||0)+1;saveIslandData();
    tankTowerRefreshCoins();openTowerSupplyShop();
  };
}

function openTowerWarehouse(){
  const panel=document.getElementById("tank-tower-panel");
  panel.classList.remove("hidden");
  panel.innerHTML=`<div class="tank-tower-panel-head"><b>📦 我的仓库</b><button data-tower-close>关闭</button></div>
  <div class="tank-tower-warehouse">${ISLAND_TANK_FOOD.map(item=>`<div><strong>${item.icon}</strong><b>${item.name}</b><small>数量：${islandData.supplies?.[item.id]||0}</small><small>${item.desc||""}</small></div>`).join("")}</div>`;
  panel.onclick=(e)=>{if(e.target.closest("[data-tower-close]"))panel.classList.add("hidden");};
}

function openTankTowerWorld(){
  ensureTankTower3D().then(api=>{
    tankTowerActive=true;
    tankTowerKeys={};
    tankTowerState={x:0,z:0,training:false,nextCheckpoint:0};
    api.human.position.set(0,0,0);
    api.modal.classList.remove("hidden");
    tankTowerRefreshCoins();
    tankTowerSetHint("方向键移动 · E互动 · 左侧补给商店 · 右侧仓库 · 前方独立训练场");
    requestAnimationFrame(tankTowerLoop);
  });
}

function closeTankTowerWorld(){
  tankTowerActive=false;
  document.getElementById("tank-tower-world")?.classList.add("hidden");
  if (typeof openIslandWorld === "function") openIslandWorld();
}

function towerNearZone(x,z){
  const d=(ax,az)=>Math.hypot(x-ax,z-az);
  if(d(-5.2,-3.2)<1.6)return"shop";
  if(d(5.2,-3.2)<1.6)return"warehouse";
  if(z>1.5)return"training";
  return null;
}

function tankTowerInteract(){
  if(!tankTowerState)return;
  const zone=towerNearZone(tankTowerState.x,tankTowerState.z);
  if(zone==="shop")openTowerSupplyShop();
  else if(zone==="warehouse")openTowerWarehouse();
  else if(zone==="training"){
    tankTowerState.training=true;tankTowerState.nextCheckpoint=0;
    tankTowerSetHint("🏁 训练开始：依次通过6个检查点。这里训练移动、绕桩和路线，不是射击靶场。");
  } else tankTowerSetHint("靠近补给商店、仓库或训练区域后按E互动。");
}

async function tankTowerLoop(){
  if(!tankTowerActive)return;
  const api=await ensureTankTower3D();
  const s=tankTowerState;
  const speed=.075;
  let dx=0,dz=0;
  if(tankTowerKeys.ArrowLeft)dx-=speed;
  if(tankTowerKeys.ArrowRight)dx+=speed;
  if(tankTowerKeys.ArrowUp)dz-=speed;
  if(tankTowerKeys.ArrowDown)dz+=speed;
  s.x=Math.max(-8.2,Math.min(8.2,s.x+dx));
  s.z=Math.max(-6.2,Math.min(6.2,s.z+dz));
  api.human.position.x=s.x;api.human.position.z=s.z;

  const clothes=typeof activeIslandClothes==="function"?activeIslandClothes():null;
  if(clothes&&api.human.children[0]?.material?.color)api.human.children[0].material.color.set(clothes.color);

  if(s.training){
    const cp=api.checkpoints[s.nextCheckpoint];
    if(cp&&Math.hypot(s.x-cp.x,s.z-cp.z)<.7){
      cp.ring.material.color.set(0x63e67a);
      s.nextCheckpoint++;
      if(s.nextCheckpoint>=api.checkpoints.length){
        s.training=false;
        tankTowerSetHint("✅ 训练完成：路线、绕桩和移动训练通过。");
        setTimeout(()=>api.checkpoints.forEach((p,i)=>p.ring.material.color.set(i===0?0xffd24d:0xffd24d)),900);
      }else{
        tankTowerSetHint(`🏁 训练进度：${s.nextCheckpoint}/${api.checkpoints.length}`);
      }
    }
  }else{
    const zone=towerNearZone(s.x,s.z);
    if(zone==="shop")tankTowerSetHint("🛒 补给商店 · 按E购买局内消耗品");
    else if(zone==="warehouse")tankTowerSetHint("📦 仓库 · 按E查看以前购买的道具");
    else if(zone==="training")tankTowerSetHint("🏁 独立训练场 · 按E开始移动/绕桩训练");
  }

  api.controls.update();
  api.renderer.render(api.scene,api.camera);
  requestAnimationFrame(tankTowerLoop);
}

window.addEventListener("keydown",(e)=>{
  if(!tankTowerActive)return;
  if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.code)){
    e.preventDefault();tankTowerKeys[e.code]=true;
  }else if(e.code==="KeyE"&&!e.repeat){e.preventDefault();tankTowerInteract();}
  else if(e.code==="KeyC"&&!e.repeat){window.__tankTower3D?.resetCamera();}
},true);
window.addEventListener("keyup",(e)=>{
  if(!tankTowerActive)return;
  if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.code)){e.preventDefault();tankTowerKeys[e.code]=false;}
},true);

document.addEventListener("click",(e)=>{
  if(e.target?.id==="tank-tower-exit")closeTankTowerWorld();
});
