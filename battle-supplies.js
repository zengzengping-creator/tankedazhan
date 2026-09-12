// 局内仓库消耗品：数字键1-5使用坦克大厦仓库中的补给。
const BATTLE_SUPPLY_KEYS = {
  Digit1: "fuel",
  Digit2: "oil",
  Digit3: "battery",
  Digit4: "repair",
  Digit5: "ammo",
};

function battleSupplyItem(id) {
  return typeof ISLAND_TANK_FOOD !== "undefined"
    ? ISLAND_TANK_FOOD.find((x) => x.id === id)
    : null;
}

function useBattleSupply(id) {
  if (state !== "playing" || !player || !player.alive) return false;
  islandData.supplies = islandData.supplies || {};
  const count = islandData.supplies[id] || 0;
  if (count <= 0) return false;

  if (id === "fuel") {
    player.speedTimer = (player.speedTimer || 0) + 10 * 60;
  } else if (id === "oil") {
    player.shieldTimer = (player.shieldTimer || 0) + 6 * 60;
  } else if (id === "battery") {
    player.skillCooldown = Math.max(0, (player.skillCooldown || 0) - 10 * 60);
  } else if (id === "repair") {
    const cfg = PLAYER_TANK_CLASSES[player.playerClass] || PLAYER_TANK_CLASSES.normal;
    if ((player.hp || 0) >= (cfg.maxHp || player.maxHp || 5)) return false;
    player.hp = Math.min(cfg.maxHp || player.maxHp || 5, (player.hp || 0) + 2);
    lives = player.hp;
  } else if (id === "ammo") {
    player.fireTimer = (player.fireTimer || 0) + 12 * 60;
  } else {
    return false;
  }

  islandData.supplies[id] = count - 1;
  saveIslandData();
  updateHUD();
  renderBattleSupplyBar();
  if (typeof metaToast === "function") {
    const item = battleSupplyItem(id);
    metaToast(`${item?.icon || "📦"} 使用${item?.name || "补给"}`);
  }
  return true;
}

function ensureBattleSupplyBar() {
  let bar = document.getElementById("battle-supply-bar");
  if (bar) return bar;
  bar = document.createElement("div");
  bar.id = "battle-supply-bar";
  document.getElementById("canvas-wrap")?.appendChild(bar);
  return bar;
}

function renderBattleSupplyBar() {
  const bar = ensureBattleSupplyBar();
  const order = ["fuel","oil","battery","repair","ammo"];
  bar.innerHTML = order.map((id, i) => {
    const item = battleSupplyItem(id);
    const count = islandData.supplies?.[id] || 0;
    return `<div class="battle-supply-slot ${count > 0 ? "" : "empty"}"><kbd>${i+1}</kbd><span>${item?.icon || "📦"}</span><small>x${count}</small></div>`;
  }).join("");
  bar.classList.toggle("hidden", state !== "playing");
}

window.addEventListener("keydown", (e) => {
  const id = BATTLE_SUPPLY_KEYS[e.code];
  if (!id || e.repeat) return;
  if (state !== "playing") return;
  e.preventDefault();
  useBattleSupply(id);
}, true);

setInterval(renderBattleSupplyBar, 500);
