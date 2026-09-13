// 社区模组地图 V2：内置社区地图 + 在线社区搜索 + 通用可玩地图引擎。
// 玩家创作地图发布到社区服务器后，其他玩家可按地图名字直接搜索并游玩。

const COMMUNITY_MOD_MAPS = [
  {
    id:"neon-maze", name:"霓虹迷城", author:"社区车长·N7", icon:"🌃",
    desc:"收集3个能量核心，穿过霓虹墙阵到达出口。", difficulty:"中等", theme:"neon",
    width:760,height:440,spawn:{x:48,y:385},goal:{x:704,y:48,r:25},
    walls:[
      {x:95,y:300,w:250,h:18},{x:95,y:170,w:18,h:148},
      {x:185,y:80,w:18,h:150},{x:185,y:80,w:240,h:18},
      {x:330,y:180,w:18,h:145},{x:330,y:307,w:260,h:18},
      {x:470,y:95,w:18,h:145},{x:470,y:95,w:190,h:18},
      {x:610,y:185,w:18,h:140}
    ],
    gaps:[{x:392,y:307,w:42,h:18}],
    pickups:[{x:150,y:350},{x:285,y:135},{x:555,y:150}]
  },
  {
    id:"sea-hop", name:"海上跳台", author:"社区车长·浪花", icon:"🌊",
    desc:"海面断层很多，按J跳过去并收集能量核心。", difficulty:"偏难", theme:"sea",
    width:760,height:440,spawn:{x:55,y:220},goal:{x:705,y:220,r:25},
    walls:[
      {x:160,y:75,w:18,h:115},{x:160,y:250,w:18,h:115},
      {x:315,y:0,w:18,h:135},{x:315,y:195,w:18,h:245},
      {x:475,y:80,w:18,h:125},{x:475,y:265,w:18,h:105},
      {x:625,y:0,w:18,h:150},{x:625,y:215,w:18,h:225}
    ],
    gaps:[
      {x:210,y:0,w:45,h:440},{x:365,y:0,w:45,h:440},{x:525,y:0,w:45,h:440}
    ],
    pickups:[{x:270,y:70},{x:430,y:365},{x:590,y:75}]
  },
  {
    id:"steel-lab", name:"钢铁实验场", author:"社区车长·工程师", icon:"🏭",
    desc:"宽通道重装地图，适合大坦克，路线有多处分岔。", difficulty:"中等", theme:"steel",
    width:760,height:440,spawn:{x:55,y:55},goal:{x:700,y:380,r:25},
    walls:[
      {x:120,y:0,w:18,h:285},{x:120,y:350,w:18,h:90},
      {x:245,y:155,w:18,h:285},{x:245,y:0,w:18,h:90},
      {x:375,y:0,w:18,h:285},{x:375,y:350,w:18,h:90},
      {x:505,y:155,w:18,h:285},{x:505,y:0,w:18,h:90},
      {x:635,y:0,w:18,h:285},{x:635,y:350,w:18,h:90}
    ],
    gaps:[],
    pickups:[{x:185,y:380},{x:440,y:55},{x:570,y:380}]
  }
];

let communityModActive=false;
let communityModMap=null;
let communityModState=null;
let communityModKeys={};
let communityModAnimation=0;

function communityMapTheme(theme){
  if(theme==="sea")return {bg:"#1d7595",ground:"#54a46d",wall:"#d6c071",accent:"#66e4ff"};
  if(theme==="steel")return {bg:"#1d2a33",ground:"#46535b",wall:"#9aa6ad",accent:"#ffd562"};
  if(theme==="neon")return {bg:"#171329",ground:"#28244b",wall:"#a45cff",accent:"#55e8ff"};
  return {bg:"#236e82",ground:"#4e9d59",wall:"#d2b878",accent:"#ffd65e"};
}

function normalizeCommunityMap(raw){
  if(!raw||typeof raw!=="object")throw new Error("地图数据无效");
  const map={
    id:String(raw.id||"imported-"+Date.now()),
    name:String(raw.name||"未命名模组").slice(0,30),
    author:String(raw.author||"匿名作者").slice(0,24),
    icon:String(raw.icon||"🧩").slice(0,4),
    desc:String(raw.desc||"玩家创作地图").slice(0,100),
    difficulty:String(raw.difficulty||"自定义").slice(0,12),
    theme:["sea","steel","neon","party"].includes(raw.theme)?raw.theme:"party",
    width:Math.max(520,Math.min(900,Number(raw.width)||760)),
    height:Math.max(320,Math.min(560,Number(raw.height)||440)),
    spawn:{x:Number(raw.spawn?.x)||50,y:Number(raw.spawn?.y)||50},
    goal:{x:Number(raw.goal?.x)||700,y:Number(raw.goal?.y)||380,r:Math.max(18,Math.min(40,Number(raw.goal?.r)||25))},
    walls:Array.isArray(raw.walls)?raw.walls.slice(0,60).map(w=>({
      x:Number(w.x)||0,y:Number(w.y)||0,w:Math.max(8,Math.min(500,Number(w.w)||20)),h:Math.max(8,Math.min(500,Number(w.h)||20))
    })):[],
    gaps:Array.isArray(raw.gaps)?raw.gaps.slice(0,24).map(w=>({
      x:Number(w.x)||0,y:Number(w.y)||0,w:Math.max(12,Math.min(220,Number(w.w)||30)),h:Math.max(12,Math.min(560,Number(w.h)||30))
    })):[],
    pickups:Array.isArray(raw.pickups)?raw.pickups.slice(0,12).map(p=>({x:Number(p.x)||100,y:Number(p.y)||100})):[]
  };
  map.spawn.x=Math.max(20,Math.min(map.width-20,map.spawn.x));
  map.spawn.y=Math.max(20,Math.min(map.height-20,map.spawn.y));
  map.goal.x=Math.max(20,Math.min(map.width-20,map.goal.x));
  map.goal.y=Math.max(20,Math.min(map.height-20,map.goal.y));
  return map;
}

function getCommunityModMaps(){
  return [...COMMUNITY_MOD_MAPS];
}
globalThis.getCommunityModMaps=getCommunityModMaps;

function createMapFromDraft(draft={}){
  const size=draft.size||"中型";
  const dims=size==="小型"?[620,360]:size==="大型"?[820,500]:size==="超大型"?[900,540]:[760,440];
  const theme=draft.theme==="海上迷宫"?"sea":draft.theme==="钢铁基地"?"steel":draft.theme==="霓虹城市"?"neon":"party";
  const [width,height]=dims;
  const walls=[];
  const gapY=Math.round(height*.24);
  const gapH=Math.round(height*.18);
  for(let i=1;i<=4;i++){
    const x=Math.round(width*i/5);
    if(i%2){
      walls.push({x,y:0,w:18,h:height-gapY-gapH});
    }else{
      walls.push({x,y:gapY+gapH,w:18,h:height-(gapY+gapH)});
    }
  }
  return normalizeCommunityMap({
    id:"creator-"+Date.now(),
    name:draft.name||"我的坦克地图",
    author:"玩家创作",
    icon:"🛠️",
    desc:"由创作面板生成并可发布到社区的地图。",
    difficulty:"自定义",
    theme,width,height,
    spawn:{x:45,y:height-45},goal:{x:width-45,y:45,r:25},
    walls,gaps:[],
    pickups:[
      {x:Math.round(width*.25),y:Math.round(height*.75)},
      {x:Math.round(width*.50),y:Math.round(height*.25)},
      {x:Math.round(width*.75),y:Math.round(height*.70)}
    ]
  });
}
globalThis.createMapFromDraft=createMapFromDraft;

function ensureCommunityModModal(){
  let modal=document.getElementById("community-mod-modal");
  if(modal)return modal;
  modal=document.createElement("div");
  modal.id="community-mod-modal";
  modal.className="community-mod-modal hidden";
  modal.innerHTML=`
    <div class="community-mod-card">
      <div class="community-mod-head">
        <b id="community-mod-title">🧩 社区模组</b>
        <span id="community-mod-info">方向键移动 · J跳跃</span>
        <button id="community-mod-close">返回坦克岛</button>
      </div>
      <canvas id="community-mod-canvas" width="760" height="440"></canvas>
      <div id="community-mod-message" class="community-mod-message"></div>
    </div>`;
  document.getElementById("canvas-wrap")?.appendChild(modal);
  modal.querySelector("#community-mod-close")?.addEventListener("click",closeCommunityModMap);
  return modal;
}

function communityRectHit(p,w){
  const r=p.r||14;
  return p.x+r>w.x&&p.x-r<w.x+w.w&&p.y+r>w.y&&p.y-r<w.y+w.h;
}

function openCommunityModMap(input){
  let map=input;
  if(typeof input==="string")map=getCommunityModMaps().find(m=>m.id===input);
  if(!map)return;
  map=normalizeCommunityMap(map);
  const modal=ensureCommunityModModal();
  const canvas=modal.querySelector("#community-mod-canvas");
  canvas.width=map.width;canvas.height=map.height;
  modal.classList.remove("hidden");
  document.getElementById("meta-modal")?.classList.add("hidden");
  communityModActive=true;communityModMap=map;communityModKeys={};
  communityModState={
    player:{x:map.spawn.x,y:map.spawn.y,r:14,z:0,vz:0},
    pickups:map.pickups.map((p,i)=>({...p,id:i,taken:false})),
    start:performance.now(),finished:false,deaths:0
  };
  const title=document.getElementById("community-mod-title");
  if(title)title.textContent=`${map.icon} ${map.name} · ${map.author}`;
  const info=document.getElementById("community-mod-info");
  if(info)info.textContent=`方向键移动 · J跳跃 · 收集 ${map.pickups.length} 个核心后到出口`;
  if(communityModAnimation)cancelAnimationFrame(communityModAnimation);
  communityModAnimation=requestAnimationFrame(communityModLoop);
}
globalThis.openCommunityModMap=openCommunityModMap;

function closeCommunityModMap(){
  communityModActive=false;communityModKeys={};communityModMap=null;communityModState=null;
  if(communityModAnimation)cancelAnimationFrame(communityModAnimation);
  communityModAnimation=0;
  document.getElementById("community-mod-modal")?.classList.add("hidden");
}

function updateCommunityMod(){
  const m=communityModMap,s=communityModState;
  if(!m||!s||s.finished)return;
  const p=s.player;
  const ox=p.x,oy=p.y;
  const speed=3.2;
  let dx=0,dy=0;
  const joy=globalThis.mobileJoystickState;
  if(joy?.active&&joy.magnitude>0.02){
    dx=joy.x*speed;
    dy=joy.y*speed;
  }else{
    if(communityModKeys.ArrowLeft)dx-=speed;
    if(communityModKeys.ArrowRight)dx+=speed;
    if(communityModKeys.ArrowUp)dy-=speed;
    if(communityModKeys.ArrowDown)dy+=speed;
    if(dx&&dy){dx*=0.70710678;dy*=0.70710678;}
  }
  p.x=Math.max(p.r,Math.min(m.width-p.r,p.x+dx));
  p.y=Math.max(p.r,Math.min(m.height-p.r,p.y+dy));
  if(m.walls.some(w=>communityRectHit(p,w))){p.x=ox;p.y=oy;}

  p.z+=(p.vz||0);p.vz=(p.vz||0)-.38;
  if(p.z<=0){p.z=0;p.vz=0;}

  const gap=m.gaps.find(g=>communityRectHit(p,g));
  if(gap&&p.z<4){
    p.x=m.spawn.x;p.y=m.spawn.y;p.z=0;p.vz=0;s.deaths++;
    const msg=document.getElementById("community-mod-message");
    if(msg)msg.textContent="🌊 掉进断层了，按J跳过去！";
  }

  s.pickups.forEach(q=>{
    if(!q.taken&&Math.hypot(p.x-q.x,p.y-q.y)<24)q.taken=true;
  });
  const got=s.pickups.filter(q=>q.taken).length;
  const goal=Math.hypot(p.x-m.goal.x,p.y-m.goal.y)<m.goal.r+12;
  if(goal){
    if(got<s.pickups.length){
      const msg=document.getElementById("community-mod-message");
      if(msg)msg.textContent=`🔒 还差 ${s.pickups.length-got} 个能量核心`;
    }else{
      s.finished=true;
      const sec=((performance.now()-s.start)/1000).toFixed(1);
      const msg=document.getElementById("community-mod-message");
      if(msg)msg.textContent=`🏆 模组通关！用时 ${sec} 秒 · 掉落 ${s.deaths} 次`;
    }
  }
}

function drawCommunityMod(){
  const canvas=document.getElementById("community-mod-canvas");
  const ctx=canvas?.getContext("2d");
  const m=communityModMap,s=communityModState;
  if(!ctx||!m||!s)return;
  const t=communityMapTheme(m.theme);
  ctx.fillStyle=t.bg;ctx.fillRect(0,0,m.width,m.height);
  ctx.fillStyle=t.ground;ctx.fillRect(10,10,m.width-20,m.height-20);

  ctx.fillStyle=t.wall;
  m.walls.forEach(w=>ctx.fillRect(w.x,w.y,w.w,w.h));
  ctx.fillStyle="#101820";
  m.gaps.forEach(g=>ctx.fillRect(g.x,g.y,g.w,g.h));

  s.pickups.forEach(q=>{
    if(q.taken)return;
    ctx.fillStyle=t.accent;ctx.beginPath();ctx.arc(q.x,q.y,9,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fff";ctx.font="12px sans-serif";ctx.textAlign="center";ctx.fillText("⚡",q.x,q.y+4);
  });

  ctx.fillStyle=s.pickups.every(q=>q.taken)?"#62e58b":"#6e777c";
  ctx.beginPath();ctx.arc(m.goal.x,m.goal.y,m.goal.r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#fff";ctx.font="bold 12px sans-serif";ctx.fillText("出口",m.goal.x,m.goal.y+4);

  const p=s.player;
  const py=p.y-p.z;
  if(p.z>0){ctx.fillStyle="rgba(0,0,0,.28)";ctx.beginPath();ctx.ellipse(p.x,p.y+8,16,6,0,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle="#ffd23f";ctx.fillRect(p.x-13,py-13,26,26);
  ctx.fillStyle="#222";ctx.fillRect(p.x-17,py-11,4,22);ctx.fillRect(p.x+13,py-11,4,22);
  ctx.fillStyle="#fff";ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.fillText("坦",p.x,py+4);

  ctx.fillStyle="rgba(0,0,0,.62)";ctx.fillRect(10,10,220,30);
  ctx.fillStyle="#fff";ctx.font="bold 12px sans-serif";ctx.textAlign="left";
  ctx.fillText(`⚡ ${s.pickups.filter(q=>q.taken).length}/${s.pickups.length}  ·  J跳跃  ·  ${m.difficulty}`,20,30);
}

function communityModLoop(){
  if(!communityModActive)return;
  updateCommunityMod();drawCommunityMod();
  communityModAnimation=requestAnimationFrame(communityModLoop);
}

window.addEventListener("keydown",e=>{
  if(!communityModActive)return;
  if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.code)){
    e.preventDefault();e.stopImmediatePropagation();communityModKeys[e.code]=true;return;
  }
  if(e.code==="KeyJ"&&!e.repeat){
    e.preventDefault();e.stopImmediatePropagation();
    const p=communityModState?.player;
    if(p&&p.z<=0)p.vz=7.2;
  }
},true);

window.addEventListener("keyup",e=>{
  if(!communityModActive)return;
  if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.code)){
    e.preventDefault();e.stopImmediatePropagation();communityModKeys[e.code]=false;
  }
},true);
