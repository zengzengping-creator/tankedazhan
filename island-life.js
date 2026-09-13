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
  s.islandBullets = s.islandBullets.filter((b)=>b.life>0 && b.x>-120&&b.x<2000&&b.y>-120&&b.y<950);

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
  } else if (b.id==="carousel") {
    if (hint) hint.textContent="🎠 坦克旋转乐园：彩色坦克座舱环绕中央炮塔旋转。";
  } else if (b.id==="slidepark") {
    if (hint) hint.textContent="🌈 彩虹滑行坡：大型彩色坡道景点，可作为竞速和跑酷路线的起点。";
  } else if (b.id==="photozone") {
    if (hint) hint.textContent="📸 巨炮打卡区：巨型坦克炮和灯牌组成的主岛拍照地标。";
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
      const nearGiantMaze=mover.x>=1240&&mover.x<=1920&&mover.y>=350&&mover.y<=840&&islandWorldState.mounted;
      mover.vz=nearGiantMaze?8.2:6.2;
    }
  }
},true);


// ------------------- 大型游乐园游乐区：8个坦克可玩项目 -------------------
const AMUSEMENT_ZONE = {
  center:{x:1060,y:590,r:245},
  rides:[
    {id:"slide",name:"大型滑梯",icon:"🛝",x:935,y:505,r:42},
    {id:"swing",name:"坦克秋千",icon:"🎪",x:1040,y:505,r:42},
    {id:"trampoline",name:"蹦床区",icon:"🟣",x:1150,y:510,r:48},
    {id:"spinner",name:"旋转娱乐盘",icon:"🎡",x:940,y:595,r:50},
    {id:"seesaw",name:"坦克跷跷板",icon:"⚖️",x:1045,y:592,r:48},
    {id:"rainbow",name:"彩虹跳台",icon:"🌈",x:1160,y:595,r:60},
    {id:"moving",name:"滚动平台区",icon:"↔️",x:965,y:688,r:55},
    {id:"maze",name:"小型迷宫",icon:"🧩",x:1125,y:690,r:82},
  ],
  mazeWalls:[
    {x:1052,y:632,w:152,h:12},{x:1052,y:742,w:152,h:12},
    {x:1052,y:632,w:12,h:122},{x:1192,y:632,w:12,h:122},
    {x:1080,y:654,w:12,h:66},{x:1080,y:654,w:72,h:12},
    {x:1128,y:676,w:12,h:66},{x:1152,y:702,w:40,h:12},
    {x:1102,y:724,w:38,h:12}
  ]
};

function ensureAmusementState(s){
  if(!s)return null;
  if(!s.amusement){
    s.amusement={visited:{},phase:0,cooldown:0,slide:0,swing:0,spinner:0,spinnerAngle:0,spinnerRadius:28};
  }
  return s.amusement;
}

function rideById(id){ return AMUSEMENT_ZONE.rides.find(r=>r.id===id); }
function amusementMover(s){ return s?.mounted ? s.player : s?.human; }
function rideDist(p,r){ return Math.hypot((p?.x||0)-r.x,(p?.y||0)-r.y); }

function markAmusementRide(s,id){
  const a=ensureAmusementState(s);
  const r=rideById(id);
  if(!a||!r||a.visited[id])return;
  a.visited[id]=true;
  const count=Object.keys(a.visited).length;
  const hint=document.getElementById("island-world-hint");
  if(hint)hint.textContent=`${r.icon} ${r.name} 已体验 · 游乐园进度 ${count}/8`;
  if(typeof metaToast==="function")metaToast(`${r.icon} ${r.name} · ${count}/8`);

  if(count>=8){
    let result={reward:300,firstClear:false};
    if(typeof awardTankTask==="function"){
      result=awardTankTask("island-amusement-tour","🎪 游乐园8项巡游");
    }else{
      addIslandCoins(300,"🎪 游乐园8项巡游");
    }
    const coin=document.getElementById("island-world-coins");
    if(coin)coin.textContent=islandData?.coins||0;
    if(hint)hint.textContent=result.firstClear
      ? "🏆 游乐园8项全部完成！首通获得500金币！"
      : `🏆 游乐园8项全部完成！获得${result.reward}金币！`;
    setTimeout(()=>{
      if(!islandWorldState)return;
      ensureAmusementState(islandWorldState).visited={};
    },3500);
  }
}

function amusementMazeHit(p){
  const rr=p.r||12;
  return AMUSEMENT_ZONE.mazeWalls.some(w=>
    p.x+rr>w.x && p.x-rr<w.x+w.w &&
    p.y+rr>w.y && p.y-rr<w.y+w.h
  );
}

const startIslandWorldBeforeAmusement=startIslandWorld;
startIslandWorld=function(){
  startIslandWorldBeforeAmusement();
  if(islandWorldState)ensureAmusementState(islandWorldState);
};

const updateIslandWorldBeforeAmusement=updateIslandWorld;
updateIslandWorld=function(){
  const s=islandWorldState;
  if(!s)return;
  const p0=amusementMover(s);
  const prevX=p0?.x||0, prevY=p0?.y||0;

  updateIslandWorldBeforeAmusement();

  const p=amusementMover(s);
  const a=ensureAmusementState(s);
  if(!p||!a)return;
  a.phase+=0.035;
  if(a.cooldown>0)a.cooldown--;

  if(amusementMazeHit(p)){ p.x=prevX; p.y=prevY; }

  const slide=rideById("slide");
  if(rideDist(p,slide)<slide.r && a.slide<=0 && a.cooldown<=0){
    a.slide=56;a.cooldown=80;markAmusementRide(s,"slide");
  }
  if(a.slide>0){
    p.x+=3.7;p.y+=2.0;
    p.z=Math.max(p.z||0,Math.sin((56-a.slide)/56*Math.PI)*18);
    a.slide--;
  }

  const swing=rideById("swing");
  if(s.mounted&&rideDist(p,swing)<swing.r&&a.swing<=0&&a.cooldown<=0){
    a.swing=180;a.cooldown=190;markAmusementRide(s,"swing");
  }
  if(a.swing>0&&s.mounted){
    const t=(180-a.swing)*0.095;
    p.x=swing.x+Math.sin(t)*22;
    p.y=swing.y;
    p.z=6+Math.abs(Math.sin(t))*18;
    a.swing--;
  }

  const tramp=rideById("trampoline");
  if(rideDist(p,tramp)<tramp.r && (p.z||0)<=0.5 && a.cooldown<=0){
    p.vz=9.4;a.cooldown=45;markAmusementRide(s,"trampoline");
  }

  const spinner=rideById("spinner");
  if(s.mounted&&rideDist(p,spinner)<spinner.r&&a.spinner<=0&&a.cooldown<=0){
    a.spinner=170;a.cooldown=185;
    a.spinnerAngle=Math.atan2(p.y-spinner.y,p.x-spinner.x);
    a.spinnerRadius=Math.max(20,Math.min(40,rideDist(p,spinner)));
    markAmusementRide(s,"spinner");
  }
  if(a.spinner>0&&s.mounted){
    a.spinnerAngle+=0.055;
    p.x=spinner.x+Math.cos(a.spinnerAngle)*a.spinnerRadius;
    p.y=spinner.y+Math.sin(a.spinnerAngle)*a.spinnerRadius;
    a.spinner--;
  }

  const seesaw=rideById("seesaw");
  if(s.mounted&&rideDist(p,seesaw)<seesaw.r){
    p.z=Math.max(p.z||0,4+Math.abs((p.x-seesaw.x)/seesaw.r)*13);
    markAmusementRide(s,"seesaw");
  }

  const rainbowPads=[[1118,620],[1135,603],[1153,588],[1172,575],[1190,562],[1208,548]];
  rainbowPads.forEach((q,i)=>{
    if(Math.hypot(p.x-q[0],p.y-q[1])<18){
      p.vz=Math.max(p.vz||0,7.0);
      if(i>=2)markAmusementRide(s,"rainbow");
    }
  });

  const moving=rideById("moving");
  const px=moving.x+Math.sin(a.phase*1.5)*42;
  if(Math.hypot(p.x-px,p.y-moving.y)<30&&(p.z||0)<8){
    const nextX=moving.x+Math.sin((a.phase+.035)*1.5)*42;
    p.x+=nextX-px;
    p.z=Math.max(p.z||0,3);
    markAmusementRide(s,"moving");
  }

  if(Math.hypot(p.x-1168,p.y-728)<22)markAmusementRide(s,"maze");

  const inZone=Math.hypot(p.x-AMUSEMENT_ZONE.center.x,p.y-AMUSEMENT_ZONE.center.y)<AMUSEMENT_ZONE.center.r+20;
  if(inZone && !s.nearBuilding){
    const count=Object.keys(a.visited).length;
    const hint=document.getElementById("island-world-hint");
    if(hint&&count<8)hint.textContent=`🎪 游乐园游乐区 · 已体验 ${count}/8 · 坦克可直接游玩设施`;
  }
};

const drawIslandWorldBeforeAmusement=drawIslandWorld;
drawIslandWorld=function(){
  drawIslandWorldBeforeAmusement();
  const canvas=document.getElementById("island-world-canvas");
  const ctx2=canvas?.getContext("2d");
  const s=islandWorldState;
  if(!ctx2||!s)return;
  const a=ensureAmusementState(s);

  ctx2.save();
  ctx2.fillStyle="#f6cf55";ctx2.fillRect(925,432,150,34);
  ctx2.fillStyle="#26323a";ctx2.fillRect(934,466,10,46);ctx2.fillRect(1056,466,10,46);
  ctx2.fillStyle="#162027";ctx2.font="bold 17px Microsoft YaHei,sans-serif";
  ctx2.textAlign="center";ctx2.fillText("游乐园游乐区",1000,454);

  const colors={slide:"#ff7996",swing:"#62d6ff",trampoline:"#9b79ff",spinner:"#ffd65e",
    seesaw:"#72df8b",rainbow:"#ff8bcf",moving:"#60d0da",maze:"#f0a35d"};
  AMUSEMENT_ZONE.rides.forEach(r=>{
    ctx2.fillStyle=colors[r.id];ctx2.beginPath();ctx2.arc(r.x,r.y,Math.min(r.r*.55,28),0,Math.PI*2);ctx2.fill();
    ctx2.fillStyle="#fff";ctx2.font="bold 11px sans-serif";
    ctx2.fillText(`${r.icon} ${r.name}`,r.x,r.y+r.r*.72);
  });

  const pads=[[1118,620],[1135,603],[1153,588],[1172,575],[1190,562],[1208,548]];
  ["#ff6f86","#ffa84d","#ffe05b","#6edb8a","#61cfff","#9a78ff"].forEach((cl,i)=>{
    ctx2.fillStyle=cl;ctx2.beginPath();ctx2.arc(pads[i][0],pads[i][1],10,0,Math.PI*2);ctx2.fill();
  });

  const px=965+Math.sin(a.phase*1.5)*42;
  ctx2.fillStyle="#62d2d9";ctx2.fillRect(px-24,678,48,20);

  ctx2.fillStyle="#765641";
  AMUSEMENT_ZONE.mazeWalls.forEach(w=>ctx2.fillRect(w.x,w.y,w.w,w.h));
  ctx2.font="22px sans-serif";ctx2.fillText("🎁",1168,730);

  ctx2.fillStyle="rgba(0,0,0,.62)";ctx2.fillRect(930,785,260,34);
  ctx2.fillStyle="#fff";ctx2.font="bold 14px sans-serif";
  ctx2.fillText(`🎪 游乐园巡游：${Object.keys(a.visited).length}/8`,1060,807);
  ctx2.restore();
};

globalThis.AMUSEMENT_ZONE=AMUSEMENT_ZONE;


// ------------------- 超巨型剧情迷宫区 -------------------
const GIANT_STORY_MAZE = {
  name:"巨型剧情迷宫区",
  bounds:{x1:1380,y1:390,x2:1900,y2:800},
  entrance:{x:1395,y:590},
  exit:{x:1880,y:430},
  jumpPads:[{x:1318,y:590,r:17},{x:1344,y:590,r:17},{x:1370,y:590,r:17}],
  storyNodes:[
    {id:1,x:1430,y:735,r:28,title:"前哨站",text:"📡 前哨站：入口第一段已经拓宽，沿宽通道向北寻找下一条路线。"},
    {id:2,x:1580,y:458,r:28,title:"中继区",text:"🔋 中继区：路线确认，继续深入并寻找下一个南侧通道。"},
    {id:3,x:1740,y:680,r:28,title:"核心门",text:"🔓 核心门：最终出口已解锁，向右上方寻找绿色出口门！"}
  ],
  pits:[
    {x:1480,y:722,w:30,h:24,label:"断层A"},
    {x:1564,y:404,w:30,h:24,label:"断层B"},
    {x:1724,y:722,w:30,h:24,label:"断层C"}
  ],
  walls:[
    {x:1380,y:390,w:520,h:14},{x:1380,y:786,w:520,h:14},
    {x:1380,y:390,w:14,h:185},{x:1380,y:615,w:14,h:185},
    {x:1886,y:390,w:14,h:22},{x:1886,y:448,w:14,h:352},
    {x:1540,y:486,w:14,h:314},
    {x:1620,y:390,w:14,h:310},
    {x:1700,y:486,w:14,h:314},
    {x:1780,y:390,w:14,h:310},
    {x:1860,y:486,w:14,h:260},
    {x:1502,y:602,w:38,h:12},
    {x:1554,y:548,w:32,h:12},
    {x:1662,y:632,w:38,h:12},
    {x:1700,y:548,w:34,h:12},
    {x:1818,y:610,w:42,h:12}
  ]
};

function ensureGiantMazeState(s){
  if(!s)return null;
  if(!s.giantMaze){
    s.giantMaze={
      stage:0,
      completed:false,
      lastCheckpoint:{x:GIANT_STORY_MAZE.entrance.x+18,y:GIANT_STORY_MAZE.entrance.y},
      lastPitAt:0
    };
  }
  return s.giantMaze;
}

function pointInRectCircle(p,r,extra=0){
  const radius=(p.r||12)+extra;
  return p.x+radius>r.x && p.x-radius<r.x+r.w &&
         p.y+radius>r.y && p.y-radius<r.y+r.h;
}

function inGiantMazeBounds(p){
  const b=GIANT_STORY_MAZE.bounds;
  return p.x>=b.x1&&p.x<=b.x2&&p.y>=b.y1&&p.y<=b.y2;
}

function giantMazeHint(text){
  const el=document.getElementById("island-world-hint");
  if(el)el.textContent=text;
}

const startIslandWorldBeforeGiantMaze=startIslandWorld;
startIslandWorld=function(){
  startIslandWorldBeforeGiantMaze();
  if(islandWorldState)ensureGiantMazeState(islandWorldState);
};

const updateIslandWorldBeforeGiantMaze=updateIslandWorld;
updateIslandWorld=function(){
  const s=islandWorldState;
  if(!s)return;
  const before=amusementMover(s);
  const prevX=before?.x||0,prevY=before?.y||0,prevZ=before?.z||0;

  updateIslandWorldBeforeGiantMaze();

  const p=amusementMover(s);
  const m=ensureGiantMazeState(s);
  if(!p||!m)return;

  // 游乐园东侧断海入口：必须开坦克并按J跳过去。
  if(p.x>1250&&p.x<1390&&p.y>535&&p.y<645&&!inGiantMazeBounds(p)){
    if(!s.mounted){
      p.x=Math.min(p.x,1280);
      giantMazeHint("🚫 巨型剧情迷宫只能驾驶坦克跳跃进入。");
    }else if((p.z||0)<0.8&&p.x>1290){
      giantMazeHint("🛫 前方入口已降低难度：靠近彩色跳台按 J，即可轻松跳进巨型剧情迷宫！");
    }
  }

  if(inGiantMazeBounds(p)){
    // 高墙真实碰撞。
    if(GIANT_STORY_MAZE.walls.some(w=>pointInRectCircle(p,w))){
      p.x=prevX;p.y=prevY;
    }

    // 三处断层：高度不足会掉回最近剧情检查点，必须J跳过去。
    const pit=GIANT_STORY_MAZE.pits.find(q=>pointInRectCircle(p,q,-4));
    if(pit&&(p.z||0)<1.6){
      const now=performance.now();
      p.x=m.lastCheckpoint.x;p.y=m.lastCheckpoint.y;p.z=0;p.vz=0;
      if(now-m.lastPitAt>700){
        giantMazeHint(`🌊 掉进${pit.label}了！断层已经缩短，靠近边缘按 J 就能跳过去。`);
        m.lastPitAt=now;
      }
    }

    // 三个剧情节点按顺序推进。
    const nextNode=GIANT_STORY_MAZE.storyNodes[m.stage];
    if(nextNode&&Math.hypot(p.x-nextNode.x,p.y-nextNode.y)<=nextNode.r){
      m.stage++;
      m.lastCheckpoint={x:nextNode.x,y:nextNode.y};
      giantMazeHint(nextNode.text+` · 剧情进度 ${m.stage}/3`);
      if(typeof metaToast==="function")metaToast(`📖 ${nextNode.title} · ${m.stage}/3`);
    }

    // 到出口且三个节点全部完成才通关。
    const exit=GIANT_STORY_MAZE.exit;
    if(!m.completed&&Math.hypot(p.x-exit.x,p.y-exit.y)<30){
      if(m.stage<3){
        giantMazeHint(`🔒 出口尚未解锁：先完成3个剧情节点，当前 ${m.stage}/3。`);
      }else{
        m.completed=true;
        let result={reward:300,firstClear:false};
        if(typeof awardTankTask==="function"){
          result=awardTankTask("giant-story-maze","🧩 巨型剧情迷宫通关");
        }else{
          addIslandCoins(300,"🧩 巨型剧情迷宫通关");
        }
        const coin=document.getElementById("island-world-coins");
        if(coin)coin.textContent=islandData?.coins||0;
        giantMazeHint(result.firstClear
          ?"🏆 巨型剧情迷宫首通！获得500金币！"
          :`🏆 巨型剧情迷宫再次通关！获得${result.reward}金币！`);
        setTimeout(()=>{
          if(!islandWorldState)return;
          const state=ensureGiantMazeState(islandWorldState);
          const mover=amusementMover(islandWorldState);
          if(mover){
            mover.x=GIANT_STORY_MAZE.entrance.x+18;
            mover.y=GIANT_STORY_MAZE.entrance.y;
            mover.z=0;mover.vz=0;
          }
          state.stage=0;
          state.completed=false;
          state.lastCheckpoint={x:GIANT_STORY_MAZE.entrance.x+18,y:GIANT_STORY_MAZE.entrance.y};
          giantMazeHint("🧩 已回到迷宫入口，新一轮挑战可再次获得300金币。");
        },3200);
      }
    }else if(!m.completed&&m.stage<3&&!s.nearBuilding){
      giantMazeHint(`🧩 巨型剧情迷宫 · 剧情进度 ${m.stage}/3 · 遇到黑色断层按 J 跳过去`);
    }
  }
};

const drawIslandWorldBeforeGiantMaze=drawIslandWorld;
drawIslandWorld=function(){
  drawIslandWorldBeforeGiantMaze();
  const canvas=document.getElementById("island-world-canvas");
  const ctx2=canvas?.getContext("2d");
  const s=islandWorldState;
  if(!ctx2||!s)return;
  const m=ensureGiantMazeState(s);

  ctx2.save();

  // 入口跳台与招牌。
  GIANT_STORY_MAZE.jumpPads.forEach((q,i)=>{
    ctx2.fillStyle=i===0?"#ffd65e":"#61cfff";
    ctx2.beginPath();ctx2.arc(q.x,q.y,q.r,0,Math.PI*2);ctx2.fill();
  });
  ctx2.fillStyle="#26323a";ctx2.fillRect(1385,540,10,58);ctx2.fillRect(1455,540,10,58);
  ctx2.fillStyle="#f6c84f";ctx2.fillRect(1372,510,106,34);
  ctx2.fillStyle="#1e2930";ctx2.font="bold 15px Microsoft YaHei,sans-serif";
  ctx2.textAlign="center";ctx2.fillText("巨型剧情迷宫",1425,532);

  // 迷宫高墙。
  ctx2.fillStyle="#3f4c52";
  GIANT_STORY_MAZE.walls.forEach(w=>ctx2.fillRect(w.x,w.y,w.w,w.h));

  // 断层。
  ctx2.fillStyle="#101820";
  GIANT_STORY_MAZE.pits.forEach(q=>{
    ctx2.fillRect(q.x,q.y,q.w,q.h);
    ctx2.strokeStyle="#65d9ff";ctx2.lineWidth=2;ctx2.strokeRect(q.x,q.y,q.w,q.h);
  });

  // 剧情节点。
  GIANT_STORY_MAZE.storyNodes.forEach((n,i)=>{
    ctx2.fillStyle=i<m.stage?"#68e58a":(i===m.stage?"#ffd65e":"#78838b");
    ctx2.beginPath();ctx2.arc(n.x,n.y,16,0,Math.PI*2);ctx2.fill();
    ctx2.fillStyle="#fff";ctx2.font="bold 11px sans-serif";
    ctx2.fillText(`${i+1} ${n.title}`,n.x,n.y+30);
  });

  // 出口门。
  const ex=GIANT_STORY_MAZE.exit;
  ctx2.fillStyle=m.stage>=3?"#66e28a":"#6b747a";
  ctx2.fillRect(ex.x-28,ex.y-28,56,56);
  ctx2.fillStyle="#fff";ctx2.font="bold 12px sans-serif";ctx2.fillText("出口",ex.x,ex.y+4);

  ctx2.fillStyle="rgba(0,0,0,.68)";ctx2.fillRect(1410,815,410,38);
  ctx2.fillStyle="#fff";ctx2.font="bold 14px sans-serif";
  ctx2.fillText(`🧩 巨型剧情迷宫 · 剧情 ${m.stage}/3 · 出口(1880,420)`,1615,840);
  ctx2.restore();
};

globalThis.GIANT_STORY_MAZE=GIANT_STORY_MAZE;
