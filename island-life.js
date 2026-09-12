// 坦克岛 V2：3D岛屿生活、上下坦克、训练场、皮肤盲盒、衣服商城、坦克补给
// B：下坦克；步行靠近坦克后空格：上坦克；乘车时空格：开炮。

const ISLAND_SKIN_BOX_COST = 120;
const ISLAND_SKINS = [
  { id: "desert", name: "沙漠迷彩", color: "#c49a62", accent: "#6f5535", rarity: "普通" },
  { id: "forest", name: "森林迷彩", color: "#527a4b", accent: "#263f27", rarity: "普通" },
  { id: "ocean", name: "深海蓝", color: "#2576a8", accent: "#163d66", rarity: "稀有" },
  { id: "sakura", name: "樱花粉", color: "#e779a5", accent: "#8d4161", rarity: "稀有" },
  { id: "gold", name: "黄金装甲", color: "#e6b932", accent: "#8a6816", rarity: "史诗" },
  { id: "neon", name: "霓虹紫", color: "#a94fe3", accent: "#4c1e75", rarity: "史诗" },
  { id: "ice", name: "极地冰晶", color: "#9de7f5", accent: "#367f9d", rarity: "传说" },
  { id: "lava", name: "熔岩核心", color: "#e6542f", accent: "#6b1f16", rarity: "史诗" },
  { id: "military", name: "军绿重装", color: "#68744d", accent: "#303821", rarity: "普通" },
  { id: "carbon", name: "碳纤黑甲", color: "#2e3136", accent: "#0d0f11", rarity: "稀有" },
  { id: "royal", name: "皇家蓝金", color: "#3159b7", accent: "#d8b94e", rarity: "史诗" },
  { id: "galaxy", name: "银河星云", color: "#4f3c91", accent: "#d768f2", rarity: "传说" },
  { id: "toxic", name: "毒液绿", color: "#67cf36", accent: "#274e1a", rarity: "稀有" },
  { id: "tiger", name: "猛虎橙纹", color: "#e98326", accent: "#252525", rarity: "史诗" },
  { id: "chrome", name: "铬银镜面", color: "#b8c2cb", accent: "#4f5961", rarity: "传说" },
  { id: "candy", name: "糖果幻彩", color: "#ef76c8", accent: "#70d7e6", rarity: "传说" },
];

const ISLAND_CLOTHES = [
  { id: "green", name: "岛屿休闲装", price: 100, color: "#56c271" },
  { id: "blue", name: "机师蓝夹克", price: 180, color: "#4a8fd8" },
  { id: "red", name: "冠军红外套", price: 260, color: "#d95050" },
  { id: "black", name: "夜行战术服", price: 360, color: "#343943" },
];

const ISLAND_TANK_FOOD = [
  { id: "fuel", name: "高级燃油", price: 40, icon: "⛽", desc: "局内使用：10秒移动加速" },
  { id: "oil", name: "装甲润滑液", price: 55, icon: "🛢️", desc: "局内使用：6秒护盾" },
  { id: "battery", name: "能量电池", price: 80, icon: "🔋", desc: "局内使用：技能冷却减少10秒" },
  { id: "repair", name: "战地修复包", price: 95, icon: "🧰", desc: "局内使用：恢复2滴血" },
  { id: "ammo", name: "强化弹药箱", price: 120, icon: "📦", desc: "局内使用：12秒火力强化" },
];

function ensureIslandLifeData() {
  if (!islandData.skins || typeof islandData.skins !== "object") islandData.skins = {};
  if (!islandData.clothes || typeof islandData.clothes !== "object") islandData.clothes = {};
  if (!islandData.supplies || typeof islandData.supplies !== "object") islandData.supplies = {};
  if (!islandData.equippedSkin) islandData.equippedSkin = "";
  if (!islandData.equippedClothes) islandData.equippedClothes = "green";
  islandData.clothes.green = true;
  saveIslandData();
}

ensureIslandLifeData();

// 训练场移动到坦克大楼内部。
function activeIslandSkin() {
  return ISLAND_SKINS.find((s) => s.id === islandData.equippedSkin) || null;
}

function activeIslandClothes() {
  return ISLAND_CLOTHES.find((c) => c.id === islandData.equippedClothes) || ISLAND_CLOTHES[0];
}

function spendIslandCoins(amount) {
  if ((islandData.coins || 0) < amount) return false;
  islandData.coins -= amount;
  saveIslandData();
  const c1 = document.getElementById("island-world-coins");
  const c2 = document.getElementById("island-coins");
  if (c1) c1.textContent = islandData.coins;
  if (c2) c2.textContent = islandData.coins;
  return true;
}

function createIslandShopModal() {
  let modal = document.getElementById("island-shop-modal-v2");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "island-shop-modal-v2";
  modal.className = "island-shop-v2 hidden";
  modal.innerHTML = `
    <div class="island-shop-v2-card">
      <div class="island-shop-v2-head">
        <b id="island-shop-v2-title">商店</b>
        <span>🪙 <b id="island-shop-v2-coins">0</b></span>
        <button type="button" id="island-shop-v2-close">关闭</button>
      </div>
      <div id="island-shop-v2-body"></div>
      <div id="island-shop-v2-note"></div>
    </div>`;
  document.querySelector("#canvas-wrap")?.appendChild(modal);
  modal.querySelector("#island-shop-v2-close")?.addEventListener("click", () => modal.classList.add("hidden"));
  return modal;
}

function setIslandShopNote(text) {
  const el = document.getElementById("island-shop-v2-note");
  if (el) el.textContent = text || "";
}

function refreshIslandShopCoins() {
  const el = document.getElementById("island-shop-v2-coins");
  if (el) el.textContent = islandData.coins || 0;
}

function openIslandClothesShop() {
  const modal = createIslandShopModal();
  modal.classList.remove("hidden");
  document.getElementById("island-shop-v2-title").textContent = "🛍️ 商城 · 衣服直购";
  refreshIslandShopCoins();
  setIslandShopNote("衣服购买后永久拥有，步行时会显示当前穿着。");
  const body = document.getElementById("island-shop-v2-body");
  body.innerHTML = ISLAND_CLOTHES.map((item) => {
    const owned = !!islandData.clothes[item.id];
    const equipped = islandData.equippedClothes === item.id;
    return `<div class="island-shop-v2-row">
      <span><i style="background:${item.color}"></i><b>${item.name}</b><small>${owned ? (equipped ? "✅ 已穿着" : "✅ 已拥有") : item.price + "金币"}</small></span>
      <button data-clothes="${item.id}" ${equipped ? "disabled" : ""}>${owned ? "穿上" : "购买"}</button>
    </div>`;
  }).join("");

  body.onclick = (e) => {
    const btn = e.target.closest("[data-clothes]");
    if (!btn) return;
    const item = ISLAND_CLOTHES.find((x) => x.id === btn.dataset.clothes);
    if (!item) return;
    if (!islandData.clothes[item.id]) {
      if (!spendIslandCoins(item.price)) {
        setIslandShopNote("金币不足。");
        return;
      }
      islandData.clothes[item.id] = true;
    }
    islandData.equippedClothes = item.id;
    saveIslandData();
    openIslandClothesShop();
  };
}

function drawSkinBox() {
  if (!spendIslandCoins(ISLAND_SKIN_BOX_COST)) {
    setIslandShopNote("金币不足，抽一次需要120金币。");
    return;
  }
  const skin = ISLAND_SKINS[Math.floor(Math.random() * ISLAND_SKINS.length)];
  const duplicate = !!islandData.skins[skin.id];
  islandData.skins[skin.id] = true;
  islandData.equippedSkin = skin.id;
  if (duplicate) islandData.coins += 35;
  saveIslandData();
  refreshIslandShopCoins();
  setIslandShopNote(duplicate
    ? `🎁 又抽到【${skin.name}】，重复皮肤返还35金币，并已装备。`
    : `🎉 抽到【${skin.rarity} · ${skin.name}】，已自动装备！`);
  renderBlindBoxBody();
}

function renderBlindBoxBody() {
  const body = document.getElementById("island-shop-v2-body");
  if (!body) return;
  body.innerHTML = `
    <div class="island-blindbox-main">
      <div class="island-box-art">🎁</div>
      <b>坦克皮肤盲盒</b>
      <small>每次120金币 · 可抽普通/稀有/史诗/传说皮肤</small>
      <button id="draw-island-skin">抽取皮肤</button>
    </div>
    <div class="island-skin-owned">
      ${ISLAND_SKINS.map((s) => {
        const owned = !!islandData.skins[s.id];
        const equipped = islandData.equippedSkin === s.id;
        return `<button class="island-skin-chip" data-equip-skin="${s.id}" ${owned ? "" : "disabled"}>
          <i style="background:${s.color}"></i>
          ${owned ? (equipped ? "★ " : "") + s.name : "？未获得"}
        </button>`;
      }).join("")}
    </div>`;
  body.querySelector("#draw-island-skin")?.addEventListener("click", drawSkinBox);
  body.querySelectorAll("[data-equip-skin]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!islandData.skins[btn.dataset.equipSkin]) return;
      islandData.equippedSkin = btn.dataset.equipSkin;
      saveIslandData();
      setIslandShopNote("✅ 坦克皮肤已装备。");
      renderBlindBoxBody();
    });
  });
}

function openIslandBlindBoxShop() {
  const modal = createIslandShopModal();
  modal.classList.remove("hidden");
  document.getElementById("island-shop-v2-title").textContent = "🎁 盲盒店 · 坦克皮肤";
  refreshIslandShopCoins();
  setIslandShopNote("抽到重复皮肤会返还35金币。");
  renderBlindBoxBody();
}

function openIslandTankFoodShop() {
  const modal = createIslandShopModal();
  modal.classList.remove("hidden");
  document.getElementById("island-shop-v2-title").textContent = "🏢 坦克大楼 · 补给与训练场";
  refreshIslandShopCoins();
  setIslandShopNote("坦克大楼内部包含补给商店、仓库和训练场。");
  const body = document.getElementById("island-shop-v2-body");
  body.innerHTML = `
    <div class="island-tower-training-card">
      <b>🏢 坦克大楼3D实景</b>
      <small>进入后可自由走动，里面有补给商店、仓库和独立训练场。</small>
      <button type="button" data-tower-enter="1">进入坦克大楼</button>
    </div>` + ISLAND_TANK_FOOD.map((item) => {
    const count = islandData.supplies[item.id] || 0;
    return `<div class="island-shop-v2-row">
      <span><strong>${item.icon}</strong><b>${item.name}</b><small>${item.price}金币 · 已有${count} · ${item.desc || ""}</small></span>
      <button data-supply="${item.id}">购买</button>
    </div>`;
  }).join("");
  body.onclick = (e) => {
    const enterBtn = e.target.closest("[data-tower-enter]");
    if (enterBtn) {
      document.getElementById("island-shop-modal-v2")?.classList.add("hidden");
      if (typeof openTankTowerWorld === "function") {
        closeIslandWorld();
        openTankTowerWorld();
      }
      return;
    }

    const btn = e.target.closest("[data-supply]");
    if (!btn) return;
    const item = ISLAND_TANK_FOOD.find((x) => x.id === btn.dataset.supply);
    if (!item) return;
    if (!spendIslandCoins(item.price)) {
      setIslandShopNote("金币不足。");
      return;
    }
    islandData.supplies[item.id] = (islandData.supplies[item.id] || 0) + 1;
    saveIslandData();
    openIslandTankFoodShop();
  };
}

// ------------------- 人 / 坦克双状态 -------------------
const startIslandWorldBeforeLife = startIslandWorld;
startIslandWorld = function () {
  startIslandWorldBeforeLife();
  if (!islandWorldState) return;
  const p = islandWorldState.player;
  islandWorldState.mounted = true;
  islandWorldState.human = { x: p.x + 24, y: p.y + 8, r: 10, z: 0, vz: 0, dirX: 0, dirY: -1 };
  islandWorldState.tankDirX = 0;
  islandWorldState.tankDirY = -1;
  islandWorldState.islandBullets = [];
  islandWorldState.shotCooldown = 0;
  islandWorldState.trainingActive = false;
  islandWorldState.trainingHits = 0;
  islandWorldState.trainingTargets = [
    {x:130,y:70,r:8,alive:true},{x:165,y:62,r:8,alive:true},
    {x:200,y:78,r:8,alive:true},{x:145,y:108,r:8,alive:true},
    {x:195,y:115,r:8,alive:true}
  ];
};

function islandCurrentMover(s) {
  return s.mounted ? s.player : s.human;
}

function fireIslandWorldTank(s) {
  if (!s.mounted || s.shotCooldown > 0) return;
  const p = s.player;
  const dx = s.tankDirX || 0;
  const dy = s.tankDirY || -1;
  s.islandBullets.push({ x:p.x + dx*18, y:p.y + dy*18, vx:dx*6.5, vy:dy*6.5, life:90 });
  s.shotCooldown = 15;
}

function dismountIslandTank() {
  const s = islandWorldState;
  if (!s || !s.mounted) return;
  s.mounted = false;
  s.human.x = s.player.x + 25;
  s.human.y = s.player.y + 8;
  s.human.z = 0;
  const hint = document.getElementById("island-world-hint");
  if (hint) hint.textContent = "🚶 已下坦克：方向键步行 · 靠近坦克按空格上车 · J跳跃";
}

function tryMountIslandTank() {
  const s = islandWorldState;
  if (!s || s.mounted) return false;
  const d = Math.hypot(s.human.x - s.player.x, s.human.y - s.player.y);
  if (d > 34) {
    const hint = document.getElementById("island-world-hint");
    if (hint) hint.textContent = "先走到自己的坦克旁边，再按空格上车。";
    return false;
  }
  s.mounted = true;
  const hint = document.getElementById("island-world-hint");
  if (hint) hint.textContent = "🪖 已上坦克：空格开炮 · B下坦克 · J跳跃";
  return true;
}

const updateIslandWorldBeforeLife = updateIslandWorld;
updateIslandWorld = function () {
  const s = islandWorldState;
  if (!s) return;

  const mover = islandCurrentMover(s);
  const speed = s.mounted ? islandWorldTankSpeed() : 2.05;
  let dx=0, dy=0;
  if (islandWorldKeys.ArrowLeft) dx -= speed;
  if (islandWorldKeys.ArrowRight) dx += speed;
  if (islandWorldKeys.ArrowUp) dy -= speed;
  if (islandWorldKeys.ArrowDown) dy += speed;

  mover.x += dx;
  mover.y += dy;
  clampPlayerToIsland(mover);

  if (dx || dy) {
    const len = Math.hypot(dx,dy) || 1;
    if (s.mounted) {
      s.tankDirX = dx/len; s.tankDirY = dy/len;
    } else {
      s.human.dirX = dx/len; s.human.dirY = dy/len;
    }
  }

  mover.z += mover.vz || 0;
  mover.vz = (mover.vz || 0) - 0.34;
  if (mover.z <= 0) { mover.z=0; mover.vz=0; }

  if (s.shotCooldown > 0) s.shotCooldown--;
  for (const b of s.islandBullets) {
    b.x += b.vx; b.y += b.vy; b.life--;
    if (s.trainingActive) {
      for (const t of s.trainingTargets) {
        if (!t.alive) continue;
        if (Math.hypot(b.x-t.x,b.y-t.y) <= t.r+4) {
          t.alive=false; b.life=0; s.trainingHits++;
          if (s.trainingHits >= s.trainingTargets.length) {
            const hint=document.getElementById("island-world-hint");
            if (hint) hint.textContent="🎯 训练完成！全部靶子命中。按E可重新开始训练。";
          }
        }
      }
    }
  }
  s.islandBullets = s.islandBullets.filter((b)=>b.life>0 && b.x>-120&&b.x<1160&&b.y>-120&&b.y<720);

  s.wheelAngle += .012;
  s.nearBuilding = getNearestIslandBuilding(mover);

  // 跑酷改为步行和坦克都能挑战，使用当前角色的位置与跳跃高度。
  const originalPlayer = s.player;
  s.player = mover;
  updateIslandWorldParkour(s);
  s.player = originalPlayer;

  const hint=document.getElementById("island-world-hint");
  if (hint && s.nearBuilding && !s.parkourRewardLock) {
    hint.textContent = `${s.mounted ? "🪖" : "🚶"} 靠近 ${s.nearBuilding.icon} ${s.nearBuilding.name} · E互动 · J跳跃 · ${s.mounted ? "B下车 / 空格开炮" : "靠近坦克空格上车"}`;
  } else if (hint && !s.nearBuilding && s.parkourStage===0 && !s.parkourRewardLock) {
    hint.textContent = s.mounted
      ? "方向键驾驶 · 空格开炮 · B下坦克 · J跳跃 · E互动"
      : "方向键步行 · 靠近坦克按空格上车 · J跳跃 · E互动";
  }
};

// ------------------- 建筑交互 -------------------
handleIslandWorldInteraction = function () {
  const s=islandWorldState;
  if (!islandWorldActive || !s || !s.nearBuilding) return;
  const b=s.nearBuilding;
  const hint=document.getElementById("island-world-hint");

  if (b.id==="mall") {
    openIslandClothesShop();
  } else if (b.id==="blindbox") {
    openIslandBlindBoxShop();
  } else if (b.id==="tower") {
    if (typeof openTankTowerWorld === "function") {
      closeIslandWorld();
      openTankTowerWorld();
    } else {
      openIslandTankFoodShop();
    }
  } else if (b.id==="soccer") {
    closeIslandWorld(); openIslandGame("soccer");
  } else if (b.id==="range") {
    closeIslandWorld(); openIslandGame("range");
  } else if (b.id==="wheel") {
    if (hint) hint.textContent="🎡 摩天轮缓慢旋转中，这里可以俯瞰整个3D坦克岛。";
  } else if (b.id==="parkour") {
    if (hint) hint.textContent="🗼 跑酷塔：按J跳跃，依次踩亮1-6号平台，到顶获得80金币。";
  } else if (b.id==="cafe") {
    if (hint) hint.textContent="☕ 海景咖啡馆：休闲区域，后续可加入饮品和社交互动。";
  } else if (b.id==="garage") {
    if (hint) hint.textContent="🔧 改装车库：后续可用于坦克外观与配件改装。";
  } else if (b.id==="museum") {
    if (hint) hint.textContent="🏛️ 坦克博物馆：展示已收集坦克和稀有皮肤。";
  } else if (b.id==="park") {
    if (hint) hint.textContent="🌳 中央草坪：可以下坦克散步和使用人物动作。";
  } else if (b.id==="warehouse") {
    if (typeof openMetaPanel === "function") openMetaPanel("warehouse");
  } else if (b.id==="seasonhall") {
    if (typeof openMetaPanel === "function") openMetaPanel("season");
  } else if (b.id==="eventhall") {
    if (typeof openMetaPanel === "function") openMetaPanel("tasks");
  } else if (b.id==="socialpark") {
    if (typeof openMetaPanel === "function") openMetaPanel("social");
  } else if (b.id==="rechargehall") {
    if (typeof openMetaPanel === "function") openMetaPanel("recharge");
  } else if (b.id==="grandplaza") {
    if (hint) hint.textContent="⛲ 主岛广场：这里是大型坦克岛的新中心区域。";
  } else if (b.id==="modehall") {
    if (typeof openMetaPanel === "function") openMetaPanel("modes");
  } else if (b.id==="rankhall") {
    if (typeof openMetaPanel === "function") openMetaPanel("rank");
  } else if (b.id==="onlinehub") {
    if (typeof openMetaPanel === "function") openMetaPanel("online");
  } else if (b.id==="backpackhub") {
    if (typeof openMetaPanel === "function") openMetaPanel("backpack");
  } else if (b.id==="scenic") {
    if (typeof openMetaPanel === "function") openMetaPanel("scenic");
  }
};

// ------------------- 3D岛屿人物/炮弹/训练场绘制 -------------------
function drawIslandHuman3D(ctx2,h) {
  const clothes=activeIslandClothes();
  const y=h.y-h.z;
  ctx2.save();
  ctx2.fillStyle="rgba(0,0,0,.28)";
  ctx2.beginPath(); ctx2.ellipse(h.x,h.y+8,9,4,0,0,Math.PI*2); ctx2.fill();
  ctx2.fillStyle=clothes.color;
  ctx2.fillRect(h.x-6,y-8,12,17);
  ctx2.fillStyle="#f2c59e";
  ctx2.beginPath(); ctx2.arc(h.x,y-13,5,0,Math.PI*2);ctx2.fill();
  ctx2.fillStyle="#222";
  ctx2.fillRect(h.x-6,y+8,4,8);ctx2.fillRect(h.x+2,y+8,4,8);
  ctx2.restore();
}

const drawIslandWorldBeforeLife=drawIslandWorld;
drawIslandWorld=function(){
  drawIslandWorldBeforeLife();
  const s=islandWorldState;
  const canvas=document.getElementById("island-world-canvas");
  const ctx2=canvas?.getContext("2d");
  if(!s||!ctx2)return;

  // 当前装备的坦克皮肤覆盖车体顶部，增强3D材质感。
  const skin=activeIslandSkin();
  if(skin){
    const p=s.player, y=p.y-p.z;
    ctx2.save();
    ctx2.fillStyle=skin.color;
    ctx2.fillRect(p.x-13,y-13,26,26);
    ctx2.fillStyle=skin.accent;
    ctx2.fillRect(p.x-16,y-10,4,20);ctx2.fillRect(p.x+12,y-10,4,20);
    ctx2.fillStyle="rgba(255,255,255,.25)";
    ctx2.beginPath();
    ctx2.moveTo(p.x-13,y-13);ctx2.lineTo(p.x-7,y-20);ctx2.lineTo(p.x+15,y-20);ctx2.lineTo(p.x+13,y-13);ctx2.closePath();ctx2.fill();
    ctx2.restore();
  }

  if(!s.mounted) drawIslandHuman3D(ctx2,s.human);

  for(const b of s.islandBullets){
    ctx2.fillStyle="#ffe36b";
    ctx2.beginPath();ctx2.arc(b.x,b.y-7,4,0,Math.PI*2);ctx2.fill();
    ctx2.strokeStyle="rgba(255,227,107,.45)";
    ctx2.beginPath();ctx2.moveTo(b.x-b.vx*2,b.y-b.vy*2-7);ctx2.lineTo(b.x,b.y-7);ctx2.stroke();
  }

  if(s.trainingActive){
    for(const t of s.trainingTargets){
      if(!t.alive)continue;
      ctx2.fillStyle="#eee";ctx2.beginPath();ctx2.arc(t.x,t.y,t.r+4,0,Math.PI*2);ctx2.fill();
      ctx2.fillStyle="#e74c3c";ctx2.beginPath();ctx2.arc(t.x,t.y,t.r,0,Math.PI*2);ctx2.fill();
      ctx2.fillStyle="#fff";ctx2.beginPath();ctx2.arc(t.x,t.y,3,0,Math.PI*2);ctx2.fill();
    }
    ctx2.fillStyle="rgba(0,0,0,.55)";ctx2.fillRect(8,42,145,25);
    ctx2.fillStyle="#fff";ctx2.font="bold 11px sans-serif";ctx2.textAlign="left";
    ctx2.fillText(`训练靶：${s.trainingHits}/${s.trainingTargets.length}`,16,58);
  }
};

// 岛上的坦克皮肤同步到主战斗玩家坦克。
const drawTankBeforeIslandSkin=drawTank;
drawTank=function(tank,color){
  const skin=(tank?.isPlayer && activeIslandSkin()) ? activeIslandSkin() : null;
  drawTankBeforeIslandSkin(tank,skin ? skin.color : color);
  if(!tank?.isPlayer||!skin)return;
  ctx.save();
  ctx.strokeStyle=skin.accent;ctx.lineWidth=3;
  ctx.strokeRect(tank.x+3,tank.y+3,tank.size-6,tank.size-6);
  ctx.restore();
};

// ------------------- V2输入：B下车 / 空格上车或开炮 -------------------
window.addEventListener("keydown",(e)=>{
  if(!islandWorldActive||!islandWorldState)return;

  if(e.code==="KeyB"&&!e.repeat){
    e.preventDefault();e.stopImmediatePropagation();
    dismountIslandTank();
    return;
  }

  if(e.code==="Space"){
    e.preventDefault();e.stopImmediatePropagation();
    if(e.repeat)return;
    if(islandWorldState.mounted) fireIslandWorldTank(islandWorldState);
    else tryMountIslandTank();
    return;
  }

  if(e.code==="KeyJ"&&!e.repeat){
    const mover=islandCurrentMover(islandWorldState);
    if(mover && mover.z<=0){
      e.preventDefault();e.stopImmediatePropagation();
      mover.vz=6.2;
    }
  }
},true);
