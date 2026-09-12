// 局内仓库消耗品：先在坦克岛仓库选择，战斗中按 F 使用当前道具技能。
// 数字键1-5只负责快速切换当前道具，不会直接消耗。
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
  if (!islandData.selectedSupply) islandData.selectedSupply = "fuel";

  bar.innerHTML = `<div class="battle-supply-f">F 使用</div>` + order.map((id, i) => {
    const item = battleSupplyItem(id);
    const count = islandData.supplies?.[id] || 0;
    const selected = islandData.selectedSupply === id;
    return `<div class="battle-supply-slot ${count > 0 ? "" : "empty"} ${selected ? "selected" : ""}">
      <kbd>${i+1}</kbd><span>${item?.icon || "📦"}</span><small>x${count}</small>
    </div>`;
  }).join("");
  bar.classList.toggle("hidden", state !== "playing");
}

window.addEventListener("keydown", (e) => {
  if (state !== "playing" || e.repeat) return;

  if (e.code === "KeyF") {
    e.preventDefault();
    const id = islandData.selectedSupply || "fuel";
    const used = useBattleSupply(id);
    if (!used && typeof metaToast === "function") {
      const item = battleSupplyItem(id);
      metaToast(`${item?.icon || "📦"} 当前道具无法使用或库存不足`);
    }
    return;
  }

  const id = BATTLE_SUPPLY_KEYS[e.code];
  if (!id) return;
  e.preventDefault();
  islandData.selectedSupply = id;
  saveIslandData();
  renderBattleSupplyBar();
  if (typeof metaToast === "function") {
    const item = battleSupplyItem(id);
    metaToast(`已切换：${item?.icon || "📦"} ${item?.name || "道具"} · 按F使用`);
  }
}, true);

setInterval(renderBattleSupplyBar, 500);
