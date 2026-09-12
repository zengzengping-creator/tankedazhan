// 坦克岛娱乐中心：使用已拥有的坦克参加休闲项目
// 当前项目：坦克足球 / 靶场挑战 / 竞速挑战

let islandGameActive = false;
let islandGameMode = null;
let islandGameTankType = "normal";
let islandGameAnimation = 0;
let islandGameKeys = {};
let islandGameState = null;

function getOwnedIslandTankTypes() {
  const all = ["normal", "fast", "armor", "elite", "base", "weaken", "flight", "evolution", "omni"];
  return all.filter((type) => typeof isTankUnlocked === "function" && isTankUnlocked(type));
}

function getIslandTankSpeed(type) {
  const cfg = PLAYER_TANK_CLASSES[type] || PLAYER_TANK_CLASSES.normal;
  return Math.max(1.8, Math.min(4.2, cfg.speed || 2.2));
}

function ensureIslandGameModal() {
  let modal = document.getElementById("island-game-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "island-game-modal";
  modal.className = "island-game-modal hidden";
  modal.innerHTML = `
    <div class="island-game-card">
      <div class="island-game-topbar">
        <b id="island-game-title">🏝️ 坦克岛娱乐中心</b>
        <button type="button" id="island-game-close">返回岛屿</button>
      </div>
      <div class="island-game-toolbar">
        <label>出战坦克：
          <select id="island-game-tank"></select>
        </label>
        <span id="island-game-info">方向键移动</span>
      </div>
      <canvas id="island-game-canvas" width="480" height="330"></canvas>
      <div id="island-game-message" class="island-game-message"></div>
    </div>`;

  document.querySelector("#canvas-wrap")?.appendChild(modal);

  modal.querySelector("#island-game-close")?.addEventListener("click", closeIslandGame);
  modal.querySelector("#island-game-tank")?.addEventListener("change", (e) => {
    islandGameTankType = e.target.value;
    if (islandGameMode) startIslandMiniGame(islandGameMode, true);
  });

  return modal;
}

function populateIslandTankPicker() {
  const select = document.getElementById("island-game-tank");
  if (!select) return;

  const owned = getOwnedIslandTankTypes();
  if (!owned.includes(islandGameTankType)) islandGameTankType = owned[0] || "normal";

  select.innerHTML = owned.map((type) => {
    const cfg = PLAYER_TANK_CLASSES[type] || PLAYER_TANK_CLASSES.normal;
    return `<option value="${type}" ${type === islandGameTankType ? "selected" : ""}>${cfg.name}</option>`;
  }).join("");
}

function openIslandGame(mode) {
  const modal = ensureIslandGameModal();
  populateIslandTankPicker();
  modal.classList.remove("hidden");
  islandGameActive = true;
  startIslandMiniGame(mode);
}

function closeIslandGame() {
  islandGameActive = false;
  islandGameMode = null;
  islandGameState = null;
  islandGameKeys = {};
  if (islandGameAnimation) cancelAnimationFrame(islandGameAnimation);
  islandGameAnimation = 0;
  document.getElementById("island-game-modal")?.classList.add("hidden");
}

function addIslandCoins(amount, reason) {
  if (typeof islandData === "undefined") return;
  islandData.coins = Math.max(0, (islandData.coins || 0) + amount);
  if (typeof saveIslandData === "function") saveIslandData();
  if (typeof renderTankIsland === "function") renderTankIsland();
  if (typeof setIslandNotice === "function") setIslandNotice(`🪙 ${reason} +${amount}金币`);
}

function startIslandMiniGame(mode, keepMessage = false) {
  islandGameMode = mode;
  const canvas = document.getElementById("island-game-canvas");
  if (!canvas) return;

  const title = document.getElementById("island-game-title");
  const info = document.getElementById("island-game-info");
  const message = document.getElementById("island-game-message");
  if (!keepMessage && message) message.textContent = "";

  if (mode === "soccer") {
    if (title) title.textContent = "⚽ 坦克足球";
    if (info) info.textContent = "方向键推球，把球推进右侧球门";
    islandGameState = {
      player: { x: 55, y: 145, r: 16 },
      ball: { x: 230, y: 165, r: 11, vx: 0, vy: 0 },
      goals: 0,
      target: 3,
      finished: false,
    };
  } else if (mode === "range") {
    if (title) title.textContent = "🎯 坦克靶场";
    if (info) info.textContent = "方向键移动，空格射击，击中10个靶子";
    islandGameState = {
      player: { x: 60, y: 165, r: 16, dirX: 1, dirY: 0 },
      bullets: [],
      targets: Array.from({length: 10}, (_, i) => ({
        x: 300 + (i % 2) * 90,
        y: 35 + Math.floor(i / 2) * 58,
        r: 13,
        alive: true,
      })),
      hits: 0,
      finished: false,
      shotCooldown: 0,
    };
  } else {
    if (title) title.textContent = "🏁 坦克竞速";
    if (info) info.textContent = "方向键移动，依次通过5个检查点";
    islandGameState = {
      player: { x: 45, y: 285, r: 16 },
      checkpoints: [
        {x: 100, y: 255, r: 20},
        {x: 185, y: 205, r: 20},
        {x: 270, y: 145, r: 20},
        {x: 360, y: 85, r: 20},
        {x: 435, y: 45, r: 20},
      ],
      next: 0,
      startTime: performance.now(),
      finished: false,
    };
  }

  if (islandGameAnimation) cancelAnimationFrame(islandGameAnimation);
  islandGameAnimation = requestAnimationFrame(islandGameLoop);
}

function islandMovePlayer(p) {
  const speed = getIslandTankSpeed(islandGameTankType) * 1.35;
  let dx = 0, dy = 0;
  if (islandGameKeys.ArrowLeft) dx -= speed;
  if (islandGameKeys.ArrowRight) dx += speed;
  if (islandGameKeys.ArrowUp) dy -= speed;
  if (islandGameKeys.ArrowDown) dy += speed;
  if (dx || dy) {
    p.x = Math.max(20, Math.min(460, p.x + dx));
    p.y = Math.max(20, Math.min(310, p.y + dy));
    if ("dirX" in p) {
      const len = Math.hypot(dx, dy) || 1;
      p.dirX = dx / len;
      p.dirY = dy / len;
    }
  }
}

function circleHit(a, b, extra = 0) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= a.r + b.r + extra;
}

function finishIslandGame(reward, text) {
  if (!islandGameState || islandGameState.finished) return;
  islandGameState.finished = true;
  document.getElementById("island-game-message").textContent = `${text} 获得 ${reward} 金币！`;
  addIslandCoins(reward, text);
}

function updateIslandSoccer() {
  const s = islandGameState;
  if (!s || s.finished) return;
  islandMovePlayer(s.player);

  const dx = s.ball.x - s.player.x;
  const dy = s.ball.y - s.player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < s.ball.r + s.player.r + 3 && dist > 0) {
    s.ball.vx += (dx / dist) * 2.5;
    s.ball.vy += (dy / dist) * 2.5;
  }

  s.ball.x += s.ball.vx;
  s.ball.y += s.ball.vy;
  s.ball.vx *= 0.97;
  s.ball.vy *= 0.97;

  if (s.ball.y < 15 || s.ball.y > 315) s.ball.vy *= -0.8;
  s.ball.y = Math.max(15, Math.min(315, s.ball.y));

  const inGoalY = s.ball.y > 110 && s.ball.y < 220;
  if (s.ball.x > 472 && inGoalY) {
    s.goals++;
    s.ball.x = 230;
    s.ball.y = 165;
    s.ball.vx = 0;
    s.ball.vy = 0;
    s.player.x = 55;
    s.player.y = 145;
    if (s.goals >= s.target) finishIslandGame(35, "⚽ 足球胜利");
  } else {
    if (s.ball.x < 12) s.ball.vx = Math.abs(s.ball.vx) * 0.8;
    if (s.ball.x > 468 && !inGoalY) s.ball.vx = -Math.abs(s.ball.vx) * 0.8;
    s.ball.x = Math.max(12, Math.min(485, s.ball.x));
  }
}

function updateIslandRange() {
  const s = islandGameState;
  if (!s || s.finished) return;
  islandMovePlayer(s.player);
  if (s.shotCooldown > 0) s.shotCooldown--;

  if (islandGameKeys.Space && s.shotCooldown <= 0) {
    const len = Math.hypot(s.player.dirX, s.player.dirY) || 1;
    s.bullets.push({
      x: s.player.x + (s.player.dirX / len) * 18,
      y: s.player.y + (s.player.dirY / len) * 18,
      vx: (s.player.dirX / len) * 7,
      vy: (s.player.dirY / len) * 7,
      r: 4,
    });
    s.shotCooldown = 12;
  }

  for (const b of s.bullets) {
    b.x += b.vx; b.y += b.vy;
    for (const t of s.targets) {
      if (t.alive && circleHit(b, t)) {
        t.alive = false;
        b.dead = true;
        s.hits++;
      }
    }
  }
  s.bullets = s.bullets.filter((b) => !b.dead && b.x > 0 && b.x < 480 && b.y > 0 && b.y < 330);
  if (s.hits >= 10) finishIslandGame(30, "🎯 靶场完成");
}

function updateIslandRace() {
  const s = islandGameState;
  if (!s || s.finished) return;
  islandMovePlayer(s.player);
  const cp = s.checkpoints[s.next];
  if (cp && circleHit(s.player, cp, 2)) s.next++;
  if (s.next >= s.checkpoints.length) {
    const sec = ((performance.now() - s.startTime) / 1000).toFixed(1);
    finishIslandGame(30, `🏁 竞速完成 ${sec}秒`);
  }
}

function drawIslandTank(ctx, p) {
  const cfg = PLAYER_TANK_CLASSES[islandGameTankType] || PLAYER_TANK_CLASSES.normal;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = cfg.color || "#ffd23f";
  ctx.fillRect(-14, -14, 28, 28);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(cfg.mark || "坦", 0, 0);
  ctx.restore();
}

function drawIslandGame() {
  const canvas = document.getElementById("island-game-canvas");
  const ctx2 = canvas?.getContext("2d");
  const s = islandGameState;
  if (!ctx2 || !s) return;

  ctx2.clearRect(0, 0, 480, 330);
  ctx2.fillStyle = "#163b2b";
  ctx2.fillRect(0, 0, 480, 330);

  if (islandGameMode === "soccer") {
    ctx2.strokeStyle = "#dfffe9";
    ctx2.lineWidth = 2;
    ctx2.strokeRect(10, 10, 460, 310);
    ctx2.beginPath(); ctx2.moveTo(240,10); ctx2.lineTo(240,320); ctx2.stroke();
    ctx2.strokeRect(445, 110, 30, 110);
    ctx2.fillStyle = "#fff";
    ctx2.beginPath(); ctx2.arc(s.ball.x, s.ball.y, s.ball.r, 0, Math.PI*2); ctx2.fill();
    drawIslandTank(ctx2, s.player);
    ctx2.fillStyle = "#fff";
    ctx2.font = "bold 15px sans-serif";
    ctx2.fillText(`进球：${s.goals}/${s.target}`, 18, 30);
  } else if (islandGameMode === "range") {
    for (const t of s.targets) {
      if (!t.alive) continue;
      ctx2.fillStyle = "#ff5d5d";
      ctx2.beginPath(); ctx2.arc(t.x, t.y, t.r, 0, Math.PI*2); ctx2.fill();
      ctx2.fillStyle = "#fff";
      ctx2.beginPath(); ctx2.arc(t.x, t.y, 5, 0, Math.PI*2); ctx2.fill();
    }
    ctx2.fillStyle = "#ffd23f";
    for (const b of s.bullets) {
      ctx2.beginPath(); ctx2.arc(b.x,b.y,b.r,0,Math.PI*2); ctx2.fill();
    }
    drawIslandTank(ctx2, s.player);
    ctx2.fillStyle = "#fff"; ctx2.font = "bold 15px sans-serif";
    ctx2.fillText(`命中：${s.hits}/10`, 18, 30);
  } else {
    s.checkpoints.forEach((cp, i) => {
      ctx2.strokeStyle = i < s.next ? "#7cff94" : (i === s.next ? "#ffd23f" : "#888");
      ctx2.lineWidth = 4;
      ctx2.beginPath(); ctx2.arc(cp.x, cp.y, cp.r, 0, Math.PI*2); ctx2.stroke();
      ctx2.fillStyle = "#fff"; ctx2.font = "12px sans-serif"; ctx2.fillText(String(i+1), cp.x-3, cp.y+4);
    });
    drawIslandTank(ctx2, s.player);
    ctx2.fillStyle = "#fff"; ctx2.font = "bold 15px sans-serif";
    ctx2.fillText(`检查点：${s.next}/5`, 18, 30);
  }
}

function islandGameLoop() {
  if (!islandGameActive || !islandGameState) return;
  if (islandGameMode === "soccer") updateIslandSoccer();
  else if (islandGameMode === "range") updateIslandRange();
  else updateIslandRace();

  drawIslandGame();
  islandGameAnimation = requestAnimationFrame(islandGameLoop);
}

window.addEventListener("keydown", (e) => {
  if (!islandGameActive) return;
  if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].includes(e.code)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    islandGameKeys[e.code] = true;
  }
}, true);

window.addEventListener("keyup", (e) => {
  if (!islandGameActive) return;
  if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].includes(e.code)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    islandGameKeys[e.code] = false;
  }
}, true);

// ------------------- V1：可自由移动的坦克岛世界 -------------------
let islandWorldActive = false;
let islandWorldAnimation = 0;
let islandWorldKeys = {};
let islandWorldState = null;
let islandWorldTankType = "normal";
let islandLoadingTimer = 0;

const ISLAND_WORLD_BUILDINGS = [
  { id: "mall", name: "商场", icon: "🛍️", x: 105, y: 165, w: 82, h: 58, color: "#8b5fbf" },
  { id: "blindbox", name: "盲盒店", icon: "🎁", x: 92, y: 320, w: 88, h: 58, color: "#d35b77" },
  { id: "tower", name: "坦克大楼", icon: "🏢", x: 250, y: 135, w: 94, h: 72, color: "#5b657f" },
  { id: "soccer", name: "足球场", icon: "⚽", x: 368, y: 150, w: 100, h: 66, color: "#2c8f4d" },
  { id: "wheel", name: "摩天轮", icon: "🎡", x: 250, y: 375, w: 78, h: 78, color: "#d9a72e" },
  { id: "range", name: "射击靶场", icon: "🎯", x: 370, y: 355, w: 92, h: 62, color: "#885d3c" },
  { id: "parkour", name: "跑酷塔", icon: "🗼", x: 440, y: 265, w: 58, h: 112, color: "#73737f" },
  { id: "cafe", name: "海景咖啡馆", icon: "☕", x: 160, y: 90, w: 78, h: 50, color: "#8a6546" },
  { id: "garage", name: "改装车库", icon: "🔧", x: 335, y: 82, w: 82, h: 52, color: "#52606b" },
  { id: "museum", name: "坦克博物馆", icon: "🏛️", x: 80, y: 250, w: 88, h: 64, color: "#8a7b63" },
  { id: "park", name: "中央草坪", icon: "🌳", x: 250, y: 255, w: 90, h: 72, color: "#4b9d52" },
];

const ISLAND_PARKOUR_PADS = [
  { x: 388, y: 365 },
  { x: 408, y: 340 },
  { x: 430, y: 315 },
  { x: 407, y: 288 },
  { x: 430, y: 260 },
  { x: 410, y: 232 },
];

function ensureIslandWorldModal() {
  let modal = document.getElementById("island-world-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "island-world-modal";
  modal.className = "island-world-modal hidden";
  modal.innerHTML = `
    <div id="island-loading-screen" class="island-loading-screen">
      <img src="island-loading.svg?v=20260912-3" alt="坦克岛地形加载图">
      <div class="island-loading-title">🏝️ 正在加载坦克岛地形...</div>
      <div class="island-loading-track"><div id="island-loading-bar" class="island-loading-bar"></div></div>
      <div id="island-loading-text" class="island-loading-text">0%</div>
    </div>
    <div id="island-world-screen" class="island-world-screen hidden">
      <div class="island-world-topbar">
        <b>🏝️ 坦克岛</b>
        <label>岛上坦克：<select id="island-world-tank"></select></label>
        <span>🪙 <b id="island-world-coins">0</b></span>
        <button type="button" id="island-world-exit">离开岛屿</button>
      </div>
      <canvas id="island-world-canvas" width="500" height="500"></canvas>
      <div id="island-world-hint" class="island-world-hint">方向键移动 · J跳跃 · 靠近建筑按E互动</div>
    </div>`;

  document.querySelector("#canvas-wrap")?.appendChild(modal);

  modal.querySelector("#island-world-exit")?.addEventListener("click", closeIslandWorld);
  modal.querySelector("#island-world-tank")?.addEventListener("change", (e) => {
    islandWorldTankType = e.target.value;
  });

  return modal;
}

function populateIslandWorldTankPicker() {
  const select = document.getElementById("island-world-tank");
  if (!select) return;

  const owned = getOwnedIslandTankTypes();
  if (!owned.includes(islandWorldTankType)) {
    islandWorldTankType = owned.includes(selectedPlayerTank) ? selectedPlayerTank : (owned[0] || "normal");
  }

  select.innerHTML = owned.map((type) => {
    const cfg = PLAYER_TANK_CLASSES[type] || PLAYER_TANK_CLASSES.normal;
    return `<option value="${type}" ${type === islandWorldTankType ? "selected" : ""}>${cfg.name}</option>`;
  }).join("");
}

function openIslandWorld() {
  const modal = ensureIslandWorldModal();
  const loading = document.getElementById("island-loading-screen");
  const world = document.getElementById("island-world-screen");
  const bar = document.getElementById("island-loading-bar");
  const textEl = document.getElementById("island-loading-text");

  if (islandOpen && typeof closeTankIsland === "function") closeTankIsland();

  modal.classList.remove("hidden");
  loading?.classList.remove("hidden");
  world?.classList.add("hidden");
  if (bar) bar.style.width = "0%";
  if (textEl) textEl.textContent = "0%";

  clearInterval(islandLoadingTimer);
  let progress = 0;
  islandLoadingTimer = setInterval(() => {
    progress += 4 + Math.floor(Math.random() * 8);
    if (progress >= 100) {
      progress = 100;
      clearInterval(islandLoadingTimer);
      islandLoadingTimer = 0;
      if (bar) bar.style.width = "100%";
      if (textEl) textEl.textContent = "100%";
      setTimeout(startIslandWorld, 260);
      return;
    }
    if (bar) bar.style.width = `${progress}%`;
    if (textEl) textEl.textContent = `${progress}%`;
  }, 95);
}

function startIslandWorld() {
  const loading = document.getElementById("island-loading-screen");
  const world = document.getElementById("island-world-screen");
  loading?.classList.add("hidden");
  world?.classList.remove("hidden");

  populateIslandWorldTankPicker();
  islandWorldActive = true;
  islandWorldKeys = {};
  islandWorldState = {
    player: { x: 250, y: 430, r: 15, z: 0, vz: 0 },
    nearBuilding: null,
    parkourStage: 0,
    parkourRewardLock: false,
    wheelAngle: 0,
  };

  const coinEl = document.getElementById("island-world-coins");
  if (coinEl) coinEl.textContent = islandData?.coins || 0;

  if (islandWorldAnimation) cancelAnimationFrame(islandWorldAnimation);
  islandWorldAnimation = requestAnimationFrame(islandWorldLoop);
}

function closeIslandWorld() {
  islandWorldActive = false;
  islandWorldKeys = {};
  clearInterval(islandLoadingTimer);
  islandLoadingTimer = 0;
  if (islandWorldAnimation) cancelAnimationFrame(islandWorldAnimation);
  islandWorldAnimation = 0;
  document.getElementById("island-world-modal")?.classList.add("hidden");
}

function islandWorldTankSpeed() {
  const cfg = PLAYER_TANK_CLASSES[islandWorldTankType] || PLAYER_TANK_CLASSES.normal;
  return Math.max(1.7, Math.min(3.6, cfg.speed || 2.2)) * 1.15;
}

function clampPlayerToIsland(p) {
  const cx = 250, cy = 250, maxR = 238;
  const dx = p.x - cx;
  const dy = p.y - cy;
  const d = Math.hypot(dx, dy);
  if (d > maxR) {
    p.x = cx + (dx / d) * maxR;
    p.y = cy + (dy / d) * maxR;
  }
}

function getNearestIslandBuilding(p) {
  let best = null;
  let bestDist = Infinity;
  for (const b of ISLAND_WORLD_BUILDINGS) {
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    if (d < 58 && d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best;
}

function handleIslandWorldInteraction() {
  if (!islandWorldActive || !islandWorldState) return;
  const b = islandWorldState.nearBuilding;
  if (!b) return;

  const hint = document.getElementById("island-world-hint");

  if (b.id === "mall") {
    closeIslandWorld();
    if (typeof openTankIsland === "function") openTankIsland("🛍️ 欢迎来到坦克岛商场，可购买和解锁坦克。");
  } else if (b.id === "blindbox") {
    if (hint) hint.textContent = "🎁 盲盒店正在装修，后续版本开放盲盒玩法。";
  } else if (b.id === "tower") {
    if (hint) hint.textContent = "🏢 坦克大楼：这里以后会成为坦克收藏、展示和换装中心。";
  } else if (b.id === "soccer") {
    closeIslandWorld();
    openIslandGame("soccer");
  } else if (b.id === "wheel") {
    if (hint) hint.textContent = "🎡 摩天轮正在运行。靠近这里可以欣赏坦克岛全景。";
  } else if (b.id === "range") {
    closeIslandWorld();
    openIslandGame("range");
  } else if (b.id === "parkour") {
    if (hint) hint.textContent = "🗼 跑酷塔：按J跳跃，依次踩亮1-6号平台，到塔顶获得80金币！";
  }
}

function updateIslandWorldParkour(s) {
  if (s.parkourRewardLock) return;
  const next = ISLAND_PARKOUR_PADS[s.parkourStage];
  if (!next) return;

  const p = s.player;
  const d = Math.hypot(p.x - next.x, p.y - next.y);
  if (p.z > 7 && d < 18) {
    s.parkourStage++;
    const hint = document.getElementById("island-world-hint");
    if (s.parkourStage >= ISLAND_PARKOUR_PADS.length) {
      s.parkourRewardLock = true;
      addIslandCoins(80, "🗼 登顶跑酷塔");
      const coinEl = document.getElementById("island-world-coins");
      if (coinEl) coinEl.textContent = islandData?.coins || 0;
      if (hint) hint.textContent = "🏆 成功登顶跑酷塔！获得80金币。";
      setTimeout(() => {
        if (!islandWorldState) return;
        islandWorldState.parkourStage = 0;
        islandWorldState.parkourRewardLock = false;
      }, 2500);
    } else if (hint) {
      hint.textContent = `🗼 跑酷进度：${s.parkourStage}/${ISLAND_PARKOUR_PADS.length}，继续按J跳到下一个平台！`;
    }
  }
}

function updateIslandWorld() {
  const s = islandWorldState;
  if (!s) return;
  const p = s.player;
  const speed = islandWorldTankSpeed();

  let dx = 0, dy = 0;
  if (islandWorldKeys.ArrowLeft) dx -= speed;
  if (islandWorldKeys.ArrowRight) dx += speed;
  if (islandWorldKeys.ArrowUp) dy -= speed;
  if (islandWorldKeys.ArrowDown) dy += speed;
  p.x += dx;
  p.y += dy;
  clampPlayerToIsland(p);

  p.z += p.vz;
  p.vz -= 0.34;
  if (p.z <= 0) {
    p.z = 0;
    p.vz = 0;
  }

  s.wheelAngle += 0.012;
  s.nearBuilding = getNearestIslandBuilding(p);
  updateIslandWorldParkour(s);

  const hint = document.getElementById("island-world-hint");
  if (hint && s.nearBuilding && !s.parkourRewardLock) {
    hint.textContent = `靠近 ${s.nearBuilding.icon} ${s.nearBuilding.name} · 按 E 互动 · J 跳跃`;
  } else if (hint && !s.nearBuilding && s.parkourStage === 0 && !s.parkourRewardLock) {
    hint.textContent = "方向键移动 · J跳跃 · 靠近建筑按E互动";
  }
}

function drawIslandWorldBuilding(ctx2, b) {
  if (b.id === "wheel") {
    ctx2.save();
    ctx2.translate(b.x, b.y);
    ctx2.strokeStyle = "#ffd75b";
    ctx2.lineWidth = 5;
    ctx2.beginPath();
    ctx2.arc(0, 0, 32, 0, Math.PI * 2);
    ctx2.stroke();
    for (let i = 0; i < 8; i++) {
      const a = islandWorldState.wheelAngle + i * Math.PI / 4;
      ctx2.beginPath();
      ctx2.moveTo(0, 0);
      ctx2.lineTo(Math.cos(a) * 32, Math.sin(a) * 32);
      ctx2.stroke();
    }
    ctx2.restore();
  } else if (b.id === "soccer") {
    ctx2.fillStyle = b.color;
    ctx2.fillRect(b.x - b.w/2, b.y - b.h/2, b.w, b.h);
    ctx2.strokeStyle = "#dfffe9";
    ctx2.strokeRect(b.x - b.w/2 + 5, b.y - b.h/2 + 5, b.w - 10, b.h - 10);
    ctx2.beginPath(); ctx2.moveTo(b.x, b.y - b.h/2 + 5); ctx2.lineTo(b.x, b.y + b.h/2 - 5); ctx2.stroke();
  } else if (b.id === "parkour") {
    ctx2.fillStyle = b.color;
    ctx2.fillRect(b.x - b.w/2, b.y - b.h/2, b.w, b.h);
    ctx2.fillStyle = "#a9b0ba";
    for (let i = 0; i < 5; i++) ctx2.fillRect(b.x - 18, b.y + 35 - i*20, 36, 6);
  } else {
    ctx2.fillStyle = b.color;
    ctx2.fillRect(b.x - b.w/2, b.y - b.h/2, b.w, b.h);
    ctx2.fillStyle = "rgba(255,255,255,.16)";
    ctx2.fillRect(b.x - b.w/2 + 7, b.y - b.h/2 + 7, b.w - 14, 12);
  }

  ctx2.fillStyle = "#fff";
  ctx2.font = "bold 11px sans-serif";
  ctx2.textAlign = "center";
  ctx2.textBaseline = "middle";
  ctx2.fillText(`${b.icon} ${b.name}`, b.x, b.y + b.h/2 + 12);
}

function drawIslandWorldTank(ctx2, p) {
  const cfg = PLAYER_TANK_CLASSES[islandWorldTankType] || PLAYER_TANK_CLASSES.normal;
  const y = p.y - p.z;
  if (p.z > 0) {
    ctx2.fillStyle = "rgba(0,0,0,.28)";
    ctx2.beginPath();
    ctx2.ellipse(p.x, p.y + 10, 16, 7, 0, 0, Math.PI*2);
    ctx2.fill();
  }

  ctx2.save();
  ctx2.translate(p.x, y);
  ctx2.fillStyle = cfg.color || "#ffd23f";
  ctx2.fillRect(-14, -14, 28, 28);
  ctx2.fillStyle = "#252525";
  ctx2.fillRect(-18, -12, 4, 24);
  ctx2.fillRect(14, -12, 4, 24);
  ctx2.fillStyle = "#fff";
  ctx2.font = "bold 11px sans-serif";
  ctx2.textAlign = "center";
  ctx2.textBaseline = "middle";
  ctx2.fillText(cfg.mark || "坦", 0, 0);
  ctx2.restore();
}

function drawIslandWorld() {
  const canvas = document.getElementById("island-world-canvas");
  const ctx2 = canvas?.getContext("2d");
  const s = islandWorldState;
  if (!ctx2 || !s) return;

  ctx2.clearRect(0, 0, 500, 500);

  // 海水
  const sea = ctx2.createLinearGradient(0, 0, 0, 500);
  sea.addColorStop(0, "#0f6682");
  sea.addColorStop(1, "#073d5b");
  ctx2.fillStyle = sea;
  ctx2.fillRect(0, 0, 500, 500);

  // 圆形大岛：沙滩边缘 + 草地
  ctx2.fillStyle = "#e3cf87";
  ctx2.beginPath();
  ctx2.arc(250, 250, 230, 0, Math.PI * 2);
  ctx2.fill();
  ctx2.fillStyle = "#4f9f52";
  ctx2.beginPath();
  ctx2.arc(250, 250, 215, 0, Math.PI * 2);
  ctx2.fill();

  // 岛上主路
  ctx2.strokeStyle = "#c7b580";
  ctx2.lineWidth = 18;
  ctx2.beginPath();
  ctx2.moveTo(85, 250); ctx2.lineTo(415, 250);
  ctx2.moveTo(250, 78); ctx2.lineTo(250, 425);
  ctx2.stroke();

  // 建筑
  for (const b of ISLAND_WORLD_BUILDINGS) drawIslandWorldBuilding(ctx2, b);

  // 跑酷平台
  ISLAND_PARKOUR_PADS.forEach((pad, i) => {
    const reached = i < s.parkourStage;
    const current = i === s.parkourStage;
    ctx2.fillStyle = reached ? "#65ef83" : (current ? "#ffd23f" : "#b9bdc7");
    ctx2.beginPath();
    ctx2.arc(pad.x, pad.y, 10, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.fillStyle = "#182118";
    ctx2.font = "bold 9px sans-serif";
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText(String(i + 1), pad.x, pad.y);
  });

  drawIslandWorldTank(ctx2, s.player);

  ctx2.fillStyle = "rgba(0,0,0,.42)";
  ctx2.fillRect(8, 8, 180, 28);
  ctx2.fillStyle = "#fff";
  ctx2.font = "bold 12px sans-serif";
  ctx2.textAlign = "left";
  ctx2.fillText(`跑酷：${s.parkourStage}/6   跳跃高度：${Math.round(s.player.z)}`, 16, 26);
}

function islandWorldLoop() {
  if (!islandWorldActive || !islandWorldState) return;
  updateIslandWorld();
  drawIslandWorld();
  islandWorldAnimation = requestAnimationFrame(islandWorldLoop);
}

window.addEventListener("keydown", (e) => {
  if (!islandWorldActive) return;

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    islandWorldKeys[e.code] = true;
    return;
  }

  if (e.code === "KeyJ" && !e.repeat) {
    e.preventDefault();
    e.stopImmediatePropagation();
    const jumper =
      typeof islandCurrentMover === "function"
        ? islandCurrentMover(islandWorldState)
        : islandWorldState?.player;
    if (jumper && jumper.z <= 0) {
      jumper.vz = 6.2;
    }
    return;
  }

  if (e.code === "KeyE" && !e.repeat) {
    e.preventDefault();
    e.stopImmediatePropagation();
    handleIslandWorldInteraction();
  }
}, true);

window.addEventListener("keyup", (e) => {
  if (!islandWorldActive) return;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    islandWorldKeys[e.code] = false;
  }
}, true);

// 坦克岛旧菜单里的“进入坦克岛世界”按钮也使用同一个V1入口。
islandPanel?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-enter-entertainment]");
  if (!btn) return;
  openIslandWorld();
});
