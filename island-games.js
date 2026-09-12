// 坦克岛娱乐中心：使用已拥有的坦克参加休闲项目
// 当前项目：坦克足球 / 靶场挑战 / 竞速挑战

let islandGameActive = false;
let islandGameMode = null;
let islandGameTankType = "normal";
let islandGameAnimation = 0;
let islandGameKeys = {};
let islandGameState = null;

function getOwnedIslandTankTypes() {
  const all = ["normal", "fast", "armor", "elite", "base", "weaken", "omni"];
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

// 把娱乐区插入现有坦克岛页面。
const renderTankIslandBeforeGames = renderTankIsland;
renderTankIsland = function () {
  renderTankIslandBeforeGames();
  if (!islandPanel) return;

  const existing = islandPanel.querySelector(".island-entertainment");
  if (existing) return;

  const section = document.createElement("div");
  section.className = "island-section island-entertainment";
  section.innerHTML = `
    <h3>🎡 岛屿娱乐</h3>
    <div class="island-owned-note">选择已拥有的坦克参加小游戏，可获得少量金币。</div>
    <div class="island-game-grid">
      <button class="island-game-entry" data-island-game="soccer">⚽<b>坦克足球</b><small>进3球 · 奖励35金币</small></button>
      <button class="island-game-entry" data-island-game="range">🎯<b>靶场挑战</b><small>击中10靶 · 奖励30金币</small></button>
      <button class="island-game-entry" data-island-game="race">🏁<b>竞速挑战</b><small>过5点 · 奖励30金币</small></button>
    </div>`;
  islandPanel.prepend(section);
};

islandPanel?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-island-game]");
  if (!btn) return;
  openIslandGame(btn.dataset.islandGame);
});

renderTankIsland();
