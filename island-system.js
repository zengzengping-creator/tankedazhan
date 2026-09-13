// 坦克岛：金币、坦克商店、娱乐区入口与技能时长强化
// 初始免费坦克：普通 / 快速 / 重甲。其他坦克使用金币永久解锁。

const TANK_ISLAND_STORAGE_KEY = "tankBattleIsland_v1";
const INITIAL_UNLOCKED_TANKS = ["normal", "fast", "armor"];
const TANK_SHOP_PRICES = {
  elite: 200,
  base: 300,
  weaken: 400,
  flight: 500,
  evolution: 600,
  omni: 800,
};

function islandDefaultData() {
  return {
    coins: 0,
    tankCoins: 0,
    midTankCoins: 0,
    highTankCoins: 0,
    unlocked: { normal: true, fast: true, armor: true },
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
  data.tankCoins = Number.isFinite(data.tankCoins) ? Math.max(0, Math.floor(data.tankCoins)) : 0;
  data.midTankCoins = Number.isFinite(data.midTankCoins) ? Math.max(0, Math.floor(data.midTankCoins)) : 0;
  data.highTankCoins = Number.isFinite(data.highTankCoins) ? Math.max(0, Math.floor(data.highTankCoins)) : 0;
  data.unlocked = data.unlocked || {};
  for (const type of INITIAL_UNLOCKED_TANKS) data.unlocked[type] = true;
  for (const type of Object.keys(TANK_SHOP_PRICES)) {
    if (data.unlocked[type] == null) data.unlocked[type] = false;
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

// ------------------- 技能时长强化 -------------------
if (PLAYER_TANK_CLASSES.normal) PLAYER_TANK_CLASSES.normal.skillDesc = "40秒无敌护盾";
if (PLAYER_TANK_CLASSES.fast) PLAYER_TANK_CLASSES.fast.skillDesc = "30秒极速冲刺";
if (PLAYER_TANK_CLASSES.elite) PLAYER_TANK_CLASSES.elite.skillDesc = "20秒高速连射";

const activatePlayerSkillBeforeIsland = activatePlayerSkill;
activatePlayerSkill = function () {
  if (state !== "playing" || !player || !player.alive) return;

  const type = player.playerClass;
  const cfg = PLAYER_TANK_CLASSES[type] || PLAYER_TANK_CLASSES.normal;

  if (type === "normal") {
    if (player.skillCooldown > 0) return;
    player.skillCooldown = cfg.cooldown;
    player.shieldTimer = Math.max(player.shieldTimer || 0, 40 * 60);
    player.skillActiveTimer = 40 * 60;
    return;
  }

  if (type === "fast") {
    if (player.skillCooldown > 0) return;
    player.skillCooldown = cfg.cooldown;
    player.skillActiveTimer = 30 * 60;
    player.baseSpeed = cfg.speed * 1.7;
    return;
  }

  if (type === "elite") {
    if (player.skillCooldown > 0) return;
    player.skillCooldown = cfg.cooldown;
    player.fireTimer = Math.max(player.fireTimer || 0, 20 * 60);
    player.skillActiveTimer = 20 * 60;
    return;
  }

  return activatePlayerSkillBeforeIsland();
};

// ------------------- 道具无限叠加 -------------------
// 技能生效期间仍然可以继续拾取道具；护盾/速度/火力道具会继续增加剩余时间。
const applyPowerUpBeforeIsland = applyPowerUp;
applyPowerUp = function (powerUp) {
  if (!powerUp) return;

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

// ------------------- 坦克购买与选择限制 -------------------
const selectPlayerTankBeforeIsland = selectPlayerTank;
selectPlayerTank = function (type) {
  if (!isTankUnlocked(type)) {
    openTankIsland(`🔒 ${PLAYER_TANK_CLASSES[type]?.name || "该坦克"}尚未解锁，请在坦克商店购买。`);
    return false;
  }
  return selectPlayerTankBeforeIsland(type);
};

function buyIslandTank(type) {
  const basePrice = TANK_SHOP_PRICES[type];
  if (basePrice == null || isTankUnlocked(type)) return;
  const price = typeof globalThis.getVipDiscountedPrice === "function"
    ? globalThis.getVipDiscountedPrice(basePrice,"shop")
    : basePrice;

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

// ------------------- 坦克岛界面 -------------------
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
    // 主入口直接进入坦克岛世界；商店仍可由岛上的“商场”打开。
    if (typeof openIslandWorld === "function") {
      openIslandWorld();
      return;
    }
    if (islandOpen) closeTankIsland();
    else openTankIsland();
  });
}

function renderTankIsland() {
  if (islandCoinText) islandCoinText.textContent = islandData.coins;
  refreshTankLockUI();
  if (!islandPanel) return;

  const shopHtml = Object.entries(TANK_SHOP_PRICES).map(([type, basePrice]) => {
    const cfg = PLAYER_TANK_CLASSES[type];
    const owned = isTankUnlocked(type);
    const price = typeof globalThis.getVipDiscountedPrice === "function"
      ? globalThis.getVipDiscountedPrice(basePrice,"shop")
      : basePrice;
    return `<div class="island-shop-row"><span>${cfg?.name || type}<small>${owned ? "✅ 已拥有" : `${price} 金币${price<basePrice?" · VIP价":""}`}</small></span>${owned ? "" : `<button class="island-mini-btn" data-buy="${type}">购买</button>`}</div>`;
  }).join("");

  islandPanel.innerHTML = `
    <div class="island-section">
      <h3>🏝️ 坦克岛</h3>
      <div class="island-owned-note">主入口现在直接进入可自由移动的坦克岛世界。</div>
      <button type="button" class="island-entertainment-enter" data-enter-entertainment="1">🏝️ 进入坦克岛世界</button>
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
