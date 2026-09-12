// 坦克派对特殊模式：寻宝争夺 / 据点抢占 / 技能大乱斗
let partySpecialActive = false;
let partySpecialMode = "";
let partySpecialState = null;
let partySpecialKeys = {};
let partySpecialRAF = 0;

function ensurePartySpecialModal() {
  let modal = document.getElementById("party-special-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "party-special-modal";
  modal.className = "party-special-modal hidden";
  modal.innerHTML = `
    <div class="party-special-card">
      <div class="party-special-head">
        <b id="party-special-title">坦克派对模式</b>
        <button id="party-special-close" type="button">返回坦克岛</button>
      </div>
      <div id="party-special-info" class="party-special-info"></div>
      <canvas id="party-special-canvas" width="720" height="430"></canvas>
      <div id="party-special-msg" class="party-special-msg"></div>
    </div>`;
  document.getElementById("canvas-wrap")?.appendChild(modal);
  modal.querySelector("#party-special-close")?.addEventListener("click", closePartySpecialMode);
  return modal;
}

function partySpecialTankSpeed() {
  const cfg = PLAYER_TANK_CLASSES?.[islandWorldTankType] || PLAYER_TANK_CLASSES.normal;
  return Math.max(2.3, Math.min(4.4, (cfg.speed || 2.2) * 1.25));
}

function makeSpecialPlayer() {
  return { x: 90, y: 215, r: 16, dirX: 1, dirY: 0, cooldown: 0, shield: 0, speedBoost: 0, rapid: 0, explosive: 0 };
}

function randomSpot(margin=45) {
  return {
    x: margin + Math.random() * (720 - margin * 2),
    y: margin + Math.random() * (430 - margin * 2)
  };
}

function openPartySpecialMode(mode) {
  ensurePartySpecialModal();
  if (typeof closeIslandWorld === "function") closeIslandWorld();
  document.getElementById("party-special-modal").classList.remove("hidden");
  partySpecialActive = true;
  partySpecialMode = mode;
  partySpecialKeys = {};

  const title = document.getElementById("party-special-title");
  const info = document.getElementById("party-special-info");
  const msg = document.getElementById("party-special-msg");
  if (msg) msg.textContent = "";

  if (mode === "treasure") {
    title.textContent = "🗺️ 寻宝争夺";
    info.textContent = "方向键移动 · 收集8个宝箱 · 金色宝箱价值2分";
    partySpecialState = {
      player: makeSpecialPlayer(),
      treasures: Array.from({length:10},(_,i)=>({...randomSpot(),r:13,gold:i<2,alive:true})),
      rivals: Array.from({length:3},()=>({...randomSpot(),r:15,vx:(Math.random()-.5)*2.4,vy:(Math.random()-.5)*2.4})),
      score: 0, target: 8, finished:false,
    };
  } else if (mode === "capture") {
    title.textContent = "🚩 据点抢占";
    info.textContent = "方向键移动 · 进入中央据点持续占领 · 敌人进入会拖慢进度";
    partySpecialState = {
      player: makeSpecialPlayer(),
      zone: {x:360,y:215,r:78},
      enemies: Array.from({length:4},()=>({...randomSpot(),r:15,vx:(Math.random()-.5)*1.8,vy:(Math.random()-.5)*1.8})),
      progress:0, target:100, finished:false,
    };
  } else {
    title.textContent = "⚡ 技能大乱斗";
    info.textContent = "方向键移动 · 空格开炮 · 每5秒随机获得技能 · 击破15个目标";
    partySpecialState = {
      player: makeSpecialPlayer(),
      bullets:[],
      targets:Array.from({length:15},()=>({...randomSpot(60),r:15,hp:1,alive:true})),
      hits:0,target:15,finished:false,
      nextSkill:performance.now()+5000,
      skillText:"准备抽取技能…",
    };
  }

  if (partySpecialRAF) cancelAnimationFrame(partySpecialRAF);
  partySpecialRAF = requestAnimationFrame(partySpecialLoop);
}

function closePartySpecialMode() {
  partySpecialActive = false;
  partySpecialMode = "";
  partySpecialState = null;
  partySpecialKeys = {};
  if (partySpecialRAF) cancelAnimationFrame(partySpecialRAF);
  partySpecialRAF = 0;
  document.getElementById("party-special-modal")?.classList.add("hidden");
  if (typeof openIslandWorld === "function") openIslandWorld();
}

function finishPartySpecial(text, coins=60) {
  if (!partySpecialState || partySpecialState.finished) return;
  partySpecialState.finished = true;
  document.getElementById("party-special-msg").textContent = `${text} · 获得${coins}金币`;
  if (typeof addIslandCoins === "function") addIslandCoins(coins, text);
}

function moveSpecialPlayer(p) {
  let speed = partySpecialTankSpeed();
  if (p.speedBoost > 0) { speed *= 1.55; p.speedBoost--; }
  if (p.shield > 0) p.shield--;
  if (p.rapid > 0) p.rapid--;
  if (p.explosive > 0) p.explosive--;
  if (p.cooldown > 0) p.cooldown--;

  let dx=0,dy=0;
  if (partySpecialKeys.ArrowLeft) dx-=speed;
  if (partySpecialKeys.ArrowRight) dx+=speed;
  if (partySpecialKeys.ArrowUp) dy-=speed;
  if (partySpecialKeys.ArrowDown) dy+=speed;
  if (dx||dy) {
    const len=Math.hypot(dx,dy)||1;
    p.dirX=dx/len;p.dirY=dy/len;
    p.x=Math.max(20,Math.min(700,p.x+dx));
    p.y=Math.max(20,Math.min(410,p.y+dy));
  }
}

function specialHit(a,b,extra=0){ return Math.hypot(a.x-b.x,a.y-b.y)<=a.r+b.r+extra; }

function updateTreasure() {
  const s=partySpecialState;if(!s||s.finished)return;
  moveSpecialPlayer(s.player);
  for(const t of s.treasures){
    if(t.alive&&specialHit(s.player,t,2)){
      t.alive=false;s.score+=t.gold?2:1;
      if(s.score>=s.target){finishPartySpecial("🗺️ 寻宝成功",70);return;}
    }
  }
  for(const r of s.rivals){
    r.x+=r.vx;r.y+=r.vy;
    if(r.x<20||r.x>700)r.vx*=-1;
    if(r.y<20||r.y>410)r.vy*=-1;
    for(const t of s.treasures){
      if(t.alive&&specialHit(r,t)){t.alive=false;}
    }
  }
}

function updateCapture() {
  const s=partySpecialState;if(!s||s.finished)return;
  moveSpecialPlayer(s.player);
  let contest=0;
  for(const e of s.enemies){
    const dx=s.zone.x-e.x,dy=s.zone.y-e.y,len=Math.hypot(dx,dy)||1;
    e.vx+=dx/len*.025;e.vy+=dy/len*.025;
    const sp=Math.hypot(e.vx,e.vy)||1;
    if(sp>1.8){e.vx=e.vx/sp*1.8;e.vy=e.vy/sp*1.8;}
    e.x+=e.vx;e.y+=e.vy;
    e.x=Math.max(18,Math.min(702,e.x));e.y=Math.max(18,Math.min(412,e.y));
    if(Math.hypot(e.x-s.zone.x,e.y-s.zone.y)<s.zone.r)contest++;
  }
  const inside=Math.hypot(s.player.x-s.zone.x,s.player.y-s.zone.y)<s.zone.r;
  if(inside) s.progress += contest===0 ? .22 : Math.max(.03,.16-contest*.03);
  else s.progress=Math.max(0,s.progress-.035);
  if(s.progress>=s.target)finishPartySpecial("🚩 据点占领完成",80);
}

function grantChaosSkill(s){
  const skills=["shield","speed","rapid","explosive"];
  const skill=skills[Math.floor(Math.random()*skills.length)];
  if(skill==="shield"){s.player.shield=5*60;s.skillText="🛡️ 无敌护盾 5秒";}
  if(skill==="speed"){s.player.speedBoost=5*60;s.skillText="⚡ 极速冲刺 5秒";}
  if(skill==="rapid"){s.player.rapid=5*60;s.skillText="🔥 连射强化 5秒";}
  if(skill==="explosive"){s.player.explosive=5*60;s.skillText="💥 爆炸炮弹 5秒";}
  s.nextSkill=performance.now()+5000;
}

function updateChaos() {
  const s=partySpecialState;if(!s||s.finished)return;
  moveSpecialPlayer(s.player);
  if(performance.now()>=s.nextSkill)grantChaosSkill(s);
  if(partySpecialKeys.Space&&s.player.cooldown<=0){
    const rapid=s.player.rapid>0;
    s.player.cooldown=rapid?5:13;
    s.bullets.push({
      x:s.player.x+s.player.dirX*18,y:s.player.y+s.player.dirY*18,
      vx:s.player.dirX*8,vy:s.player.dirY*8,r:s.player.explosive>0?7:4,
      explosive:s.player.explosive>0
    });
  }
  for(const b of s.bullets){
    b.x+=b.vx;b.y+=b.vy;
    for(const t of s.targets){
      if(!t.alive)continue;
      if(specialHit(b,t,b.explosive?13:0)){
        t.alive=false;b.dead=true;s.hits++;
        if(s.hits>=s.target){finishPartySpecial("⚡ 大乱斗通关",90);return;}
      }
    }
  }
  s.bullets=s.bullets.filter(b=>!b.dead&&b.x>0&&b.x<720&&b.y>0&&b.y<430);
}

function drawSpecialTank(ctx,p,color="#ffd23f"){
  ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle="rgba(0,0,0,.28)";ctx.beginPath();ctx.ellipse(5,9,18,8,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=color;ctx.fillRect(-15,-13,30,26);
  ctx.fillStyle="#222";ctx.fillRect(-19,-10,5,20);ctx.fillRect(14,-10,5,20);
  ctx.fillStyle="#55616a";ctx.beginPath();ctx.arc(0,-1,8,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#d8e1e7";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,-1);ctx.lineTo(p.dirX*20,p.dirY*20);ctx.stroke();
  if(p.shield>0){ctx.strokeStyle="#62dfff";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,24,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}

function drawPartySpecial() {
  const c=document.getElementById("party-special-canvas"),ctx=c?.getContext("2d"),s=partySpecialState;
  if(!ctx||!s)return;
  const g=ctx.createLinearGradient(0,0,0,430);g.addColorStop(0,"#2f6f89");g.addColorStop(1,"#174957");
  ctx.fillStyle=g;ctx.fillRect(0,0,720,430);
  ctx.fillStyle="#4c9b55";ctx.beginPath();ctx.roundRect(18,18,684,394,28);ctx.fill();

  if(partySpecialMode==="treasure"){
    for(const t of s.treasures){if(!t.alive)continue;ctx.font=t.gold?"26px serif":"22px serif";ctx.fillText(t.gold?"👑":"🎁",t.x-12,t.y+8);}
    for(const r of s.rivals)drawSpecialTank(ctx,r,"#e65b5b");
    drawSpecialTank(ctx,s.player);
    ctx.fillStyle="#fff";ctx.font="bold 16px sans-serif";ctx.fillText(`宝藏：${s.score}/${s.target}`,28,42);
  }else if(partySpecialMode==="capture"){
    ctx.fillStyle="rgba(255,215,70,.25)";ctx.strokeStyle="#ffd646";ctx.lineWidth=5;ctx.beginPath();ctx.arc(s.zone.x,s.zone.y,s.zone.r,0,Math.PI*2);ctx.fill();ctx.stroke();
    for(const e of s.enemies)drawSpecialTank(ctx,e,"#e75c5c");
    drawSpecialTank(ctx,s.player);
    ctx.fillStyle="#fff";ctx.font="bold 16px sans-serif";ctx.fillText(`占领：${Math.floor(s.progress)}%`,28,42);
  }else{
    for(const t of s.targets){if(!t.alive)continue;ctx.fillStyle="#e75c5c";ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(t.x,t.y,5,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle="#ffe365";for(const b of s.bullets){ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();}
    drawSpecialTank(ctx,s.player);
    ctx.fillStyle="#fff";ctx.font="bold 15px sans-serif";ctx.fillText(`击破：${s.hits}/${s.target}`,28,40);ctx.fillStyle="#fff0a8";ctx.fillText(s.skillText,28,64);
  }
}

function partySpecialLoop(){
  if(!partySpecialActive||!partySpecialState)return;
  if(partySpecialMode==="treasure")updateTreasure();
  else if(partySpecialMode==="capture")updateCapture();
  else updateChaos();
  drawPartySpecial();
  partySpecialRAF=requestAnimationFrame(partySpecialLoop);
}

window.addEventListener("keydown",(e)=>{
  if(!partySpecialActive)return;
  if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].includes(e.code)){
    e.preventDefault();e.stopImmediatePropagation();partySpecialKeys[e.code]=true;
  }
},true);
window.addEventListener("keyup",(e)=>{
  if(!partySpecialActive)return;
  if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].includes(e.code)){
    e.preventDefault();e.stopImmediatePropagation();partySpecialKeys[e.code]=false;
  }
},true);
