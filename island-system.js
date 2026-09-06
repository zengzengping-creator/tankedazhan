// 坦克岛：金币、每日任务、成就、坦克商店与技能时长强化
// 初始免费坦克：普通 / 快速 / 重甲。其他坦克使用金币永久解锁。

const TANK_ISLAND_STORAGE_KEY = "tankBattleIsland_v1";
const INITIAL_UNLOCKED_TANKS = ["normal", "fast", "armor"];
const TANK_SHOP_PRICES = {
  elite: 500,
  base: 1000,
  weaken: 1500,
  omni: 3000,
};

const DAILY_TASKS = {
  kills: { name: "击败10辆敌方坦克", target: 10, reward: 120 },
  levels: { name: "完成2个关卡", target: 2, reward: 150 },
  powerups: { name: "拾取3个道具", target: 3, reward: 120 },
  skills: { name: "使用3次坦克技能", target: 3, reward: 110 },
};

const ACHIEVEMENT_TASKS = {
  kills50: { name: "累计击败50辆敌军", stat: "kills", target: 50, reward: 400 },
  kills200: { name: "累计击败200辆敌军", stat: "kills", target: 200, reward: 1000 },
  levels10: { name: "累计完成10个关卡", stat: "levels", target: 10, reward: 600 },
  powerups30: { name: "累计拾取30个道具", stat: "powerups", target: 30, reward: 600 },
  collector: { name: "解锁全部我方坦克", stat: "owned", target: 7, reward: 1500 },
};

function islandTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function islandDefaultData() {
  return {
    coins: 0,
    unlocked: { normal: true, fast: true, armor: true },
    totals: { kills: 0, levels: 0, powerups: 0, skills: 0 },
    daily: {
      date: islandTodayKey(),
      progress: { kills: 0, levels: 0, powerups: 0, skills: 0 },
      claimed: {},
    },
    achievementsClaimed: {},
  };
}

function loadIslandData() {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(TANK_ISLAND_STORAGE_KEY) || "null");
  } catch (_) {
    data = null;
  }

  const defaults = islandDefaultData();
  if (!data || typeof data !== "object") data = defaults;

  data.coins = Number.isFinite(data.coins) ? Math.max(0, Math.floor(data.coins)) : 0;
  data.unlocked = data.unlocked || {};
  for (const type of INITIAL_UNLOCKED_TANKS) data.unlocked[type] = true;
  for (const type of Object.keys(TANK_SHOP_PRICES)) {
    if (data.unlocked[type] == null) data.unlocked[type] = false;
  }

  data.totals = { ...defaults.totals, ...(data.totals || {}) };
  data.achievementsClaimed = data.achievementsClaimed || {};
  data.daily = data.daily || defaults.daily;

  if (data.daily.date !== islandTodayKey()) {
    data.daily = defaults.daily;
  } else {
    data.daily.progress = { ...defaults.daily.progress, ...(data.daily.progress || {}) };
    data.daily.claimed = data.daily.claimed || {};
  }

  return data;
}

let islandData = loadIslandData();
let islandOpen = false;

function saveIslandData() {
  try {
    localStorage.setItem(TANK_ISLAND_STORAGE_KEY, JSON.stringify(islandData));
  } catch (_) {
    // 无法写入存储时，本次页面内仍然保持数据。
  }
}

function isTankUnlocked(type) {
  return !!islandData.unlocked[type];
}

function ownedTankCount() {
  return ["normal", "fast", "armor", "elite", "base", "weaken", "omni"]
    .filter((type) => isTankUnlocked(type)).length;
}

// ------------------- 技能时长强化 -------------------
if (PLAYER_TANK_CLASSES.normal) PLAYER_TANK_CLASSES.normal.skillDesc = "40秒无敌护盾";
if (PLAYER_TANK_CLASSES.fast) PLAYER_TANK_CLASSES.fast.skillDesc = "30秒极速冲刺";
if (PLAYER_TANK_CLASSES.elite) PLAYER_TANK_CLASSES.elite.skillDesc = "20秒高速连射";

const activatePlayerSkillBeforeIsland = activatePlayerSkill;
activatePlayerSkill = function () {
  if (state !== "playing" || !player || !player.alive) return;

  const type = player.playerClass;
  const cfg = PLAYER_TANK_CLASSES[type] || PLAYER_TANK_CLASSES.normal;
  const beforeCooldown = player.skillCooldown || 0;

  if (type === "normal") {
    if (player.skillCooldown > 0) return;
    player.skillCooldown = cfg.cooldown;
    player.shieldTimer = Math.max(player.shieldTimer || 0, 40 * 60);
    player.skillActiveTimer = 40 * 60;
  } else if (type === "fast") {
    if (player.skillCooldown > 0) return;
    player.skillCooldown = cfg.cooldown;
    player.skillActiveTimer = 30 * 60;
    player.baseSpeed = cfg.speed * 1.7;
  } else if (type === "elite") {
    if (player.skillCooldown > 0) return;
    player.skillCooldown = cfg.cooldown;
    player.fireTimer = Math.max(player.fireTimer || 0, 20 * 60);
    player.skillActiveTimer = 20 * 60;
  } else {
    activatePlayerSkillBeforeIsland();
  }

  if ((player.skillCooldown || 0) > beforeCooldown) {
    recordIslandProgress("skills", 1);
  }
};

// ------------------- 道具无限叠加 -------------------
// 技能生效期间仍然可以继续拾取道具；护盾/速度/火力道具会继续增加剩余时间。
const applyPowerUpBeforeIsland = applyPowerUp;
applyPowerUp = function (powerUp) {
  if (!powerUp) return;

  recordIslandProgress("powerups", 1);

  if (player && player.alive && powerUp.type === "shield") {
    player.shieldTimer = (player.shieldTimer || 0) + 8 * 60;
    updateHUD();
    return;
  }
  if (player && player.alive && powerUp.type === "speed") {
    player.speedTimer = (player.speedTimer || 0) + 10 * 60;
    updateHUD();
    return;
  }
  if (player && player.alive && powerUp.type === "fire") {
    player.fireTimer = (player.fireTimer || 0) + 10 * 60;
    updateHUD();
    return;
  }

  applyPowerUpBeforeIsland(powerUp);
};

// ------------------- 任务进度 -------------------
function recordIslandProgress(kind, amount = 1) {
  if (!islandData.totals[kind] && islandData.totals[kind] !== 0) islandData.totals[kind] = 0;
  islandData.totals[kind] += amount;

  if (islandData.daily.date !== islandTodayKey()) {
    islandData.daily = islandDefaultData().daily;
  }
  if (islandData.daily.progress[kind] != null) {
    islandData.daily.progress[kind] += amount;
  }

  saveIslandData();
  renderTankIsland();
}

const handleEnemyDestroyedBeforeIsland = handleEnemyDestroyed;
handleEnemyDestroyed = function (enemy, allowDrop = true) {
  recordIslandProgress("kills", 1);
  return handleEnemyDestroyedBeforeIsland(enemy, allowDrop);
};

const nextLevelOrWinBeforeIsland = nextLevelOrWin;
nextLevelOrWin = function () {
  recordIslandProgress("levels", 1);
  return nextLevelOrWinBeforeIsland();
};

// ------------------- 坦克购买与选择限制 -------------------
const selectPlayerTankBeforeIsland = selectPlayerTank;
selectPlayerTank = function (type) {
  if (!isTankUnlocked(type)) {
    openTankIsland(`🔒 ${PLAYER_TANK_CLASSES[type]?.name || "该坦克"}尚未解锁，请在岛屿商店购买。`);
    return false;
  }
  return selectPlayerTankBeforeIsland(type);
};

function buyIslandTank(type) {
  const price = TANK_SHOP_PRICES[type];
  if (price == null || isTankUnlocked(type)) return;

  if (islandData.coins < price) {
    setIslandNotice(`金币不足：还差 ${price - islandData.coins} 金币。`);
    return;
  }

  islandData.coins -= price;
  islandData.unlocked[type] = true;
  saveIslandData();
  setIslandNotice(`✅ 已解锁 ${PLAYER_TANK_CLASSES[type]?.name || type}！`);
  refreshTankLockUI();
  renderTankIsland();
  selectPlayerTank(type);
}

function claimDailyTask(taskId) {
  const task = DAILY_TASKS[taskId];
  if (!task || islandData.daily.claimed[taskId]) return;
  const progress = islandData.daily.progress[taskId] || 0;
  if (progress < task.target) return;

  islandData.daily.claimed[taskId] = true;
  islandData.coins += task.reward;
  saveIslandData();
  setIslandNotice(`🪙 每日任务完成，获得 ${task.reward} 金币！`);
  refreshTankLockUI();
  renderTankIsland();
}

function achievementProgress(task) {
  if (task.stat === "owned") return ownedTankCount();
  return islandData.totals[task.stat] || 0;
}

function claimAchievement(taskId) {
  const task = ACHIEVEMENT_TASKS[taskId];
  if (!task || islandData.achievementsClaimed[taskId]) return;
  if (achievementProgress(task) < task.target) return;

  islandData.achievementsClaimed[taskId] = true;
  islandData.coins += task.reward;
  saveIslandData();
  setIslandNotice(`🏆 成就完成，获得 ${task.reward} 金币！`);
  refreshTankLockUI();
  renderTankIsland();
}

// ------------------- 岛屿界面 -------------------
const islandButton = document.getElementById("island-btn");
const islandPanel = document.getElementById("island-panel");
const islandCoinText = document.getElementById("island-coins");
const islandNotice = document.getElementById("island-notice");
const freeNote = document.querySelector(".free-note");

function setIslandNotice(text) {
  if (islandNotice) islandNotice.textContent = text || "";
}

function openTankIsland(message = "") {
  islandOpen = true;
  if (elTankSelect) elTankSelect.classList.add("island-hidden");
  if (freeNote) freeNote.classList.add("island-hidden");
  if (startBtn) startBtn.classList.add("island-hidden");
  if (islandPanel) islandPanel.classList.remove("hidden");
  if (islandButton) islandButton.textContent = "⬅️ 返回坦克选择";
  setIslandNotice(message);
  renderTankIsland();
}

function closeTankIsland() {
  islandOpen = false;
  if (elTankSelect) elTankSelect.classList.remove("island-hidden");
  if (freeNote) freeNote.classList.remove("island-hidden");
  if (startBtn) startBtn.classList.remove("island-hidden");
  if (islandPanel) islandPanel.classList.add("hidden");
  if (islandButton) islandButton.textContent = "🏝️ 进入坦克岛";
  setIslandNotice("");
}

if (islandButton) {
  islandButton.addEventListener("click", () => {
    if (islandOpen) closeTankIsland();
    else openTankIsland();
  });
}

function taskRowHtml(id, task, progress, claimed, kind) {
  const done = progress >= task.target;
  const status = claimed ? "✅ 已领取" : `${Math.min(progress, task.target)}/${task.target}`;
  const action = claimed
    ? ""
    : `<button class="island-mini-btn" data-${kind}="${id}" ${done ? "" : "disabled"}>领取 ${task.reward}🪙</button>`;
  return `<div class="island-task-row"><span>${task.name}<small>${status}</small></span>${action}</div>`;
}

function renderTankIsland() {
  if (islandCoinText) islandCoinText.textContent = islandData.coins;
  refreshTankLockUI();
  if (!islandPanel) return;

  const dailyHtml = Object.entries(DAILY_TASKS).map(([id, task]) =>
    taskRowHtml(id, task, islandData.daily.progress[id] || 0, !!islandData.daily.claimed[id], "daily")
  ).join("");

  const achievementHtml = Object.entries(ACHIEVEMENT_TASKS).map(([id, task]) =>
    taskRowHtml(id, task, achievementProgress(task), !!islandData.achievementsClaimed[id], "achievement")
  ).join("");

  const shopHtml = Object.entries(TANK_SHOP_PRICES).map(([type, price]) => {
    const cfg = PLAYER_TANK_CLASSES[type];
    const owned = isTankUnlocked(type);
    return `<div class="island-shop-row"><span>${cfg?.name || type}<small>${owned ? "✅ 已拥有" : `${price} 金币`}</small></span>${owned ? "" : `<button class="island-mini-btn" data-buy="${type}">购买</button>`}</div>`;
  }).join("");

  islandPanel.innerHTML = `
    <div class="island-section">
      <h3>📅 每日任务</h3>
      ${dailyHtml}
    </div>
    <div class="island-section">
      <h3>🏆 成就任务</h3>
      ${achievementHtml}
    </div>
    <div class="island-section">
      <h3>🛒 坦克商店</h3>
      <div class="island-owned-note">初始可用：普通、快速、重甲</div>
      ${shopHtml}
    </div>`;
}

if (islandPanel) {
  islandPanel.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.buy) buyIslandTank(btn.dataset.buy);
    if (btn.dataset.daily) claimDailyTask(btn.dataset.daily);
    if (btn.dataset.achievement) claimAchievement(btn.dataset.achievement);
  });
}

function refreshTankLockUI() {
  for (const btn of document.querySelectorAll(".tank-choice")) {
    const type = btn.dataset.playerTank;
    const unlocked = isTankUnlocked(type);
    btn.classList.toggle("locked", !unlocked);

    let badge = btn.querySelector(".tank-lock-badge");
    if (!badge) {
      badge = document.createElement("small");
      badge.className = "tank-lock-badge";
      btn.appendChild(badge);
    }

    if (unlocked) {
      badge.textContent = INITIAL_UNLOCKED_TANKS.includes(type) ? "✅ 初始可用" : "✅ 已解锁";
    } else {
      badge.textContent = `🔒 ${TANK_SHOP_PRICES[type] || 0}金币`;
    }
  }
}

saveIslandData();
refreshTankLockUI();
renderTankIsland();
