// 统一任务通关奖励：每个任务首通500金币，重复通关300金币。
const TASK_CLEAR_STORAGE_KEY = "tankBattleTaskClears_v1";

function loadTankTaskClears() {
  try {
    return JSON.parse(localStorage.getItem(TASK_CLEAR_STORAGE_KEY) || "{}") || {};
  } catch (_) {
    return {};
  }
}

let tankTaskClears = loadTankTaskClears();

function saveTankTaskClears() {
  try {
    localStorage.setItem(TASK_CLEAR_STORAGE_KEY, JSON.stringify(tankTaskClears));
  } catch (_) {}
}

function getTankTaskReward(taskId) {
  return tankTaskClears[taskId] ? 300 : 500;
}

function awardTankTask(taskId, label) {
  const firstClear = !tankTaskClears[taskId];
  const reward = firstClear ? 500 : 300;
  tankTaskClears[taskId] = (tankTaskClears[taskId] || 0) + 1;
  saveTankTaskClears();

  if (typeof addIslandCoins === "function") {
    addIslandCoins(reward, firstClear ? `${label} · 首通` : `${label} · 重复通关`);
  } else if (typeof islandData !== "undefined") {
    islandData.coins = Math.max(0, (islandData.coins || 0) + reward);
    if (typeof saveIslandData === "function") saveIslandData();
  }

  if (typeof metaToast === "function") {
    metaToast(firstClear
      ? `🏆 ${label} 首通奖励 +500金币`
      : `🎮 ${label} 通关奖励 +300金币`);
  }

  return { reward, firstClear };
}

function tankTaskRewardText(taskId) {
  return tankTaskClears[taskId] ? "重复通关：300金币" : "首通：500金币";
}

// 坦克岛基础小游戏：足球 / 靶场 / 竞速。
if (typeof finishIslandGame === "function") {
  const finishIslandGameRewardBase = finishIslandGame;
  finishIslandGame = function(_oldReward, text) {
    if (!islandGameState || islandGameState.finished) return;
    const mode = islandGameMode || "unknown";
    const ranked = typeof partyHubData !== "undefined" && !!partyHubData.rankedActive;
    const taskId = ranked ? `ranked-${mode}` : `island-${mode}`;
    const firstClear = !tankTaskClears[taskId];
    const reward = firstClear ? 500 : 300;

    // 原函数负责结束状态与提示；传入统一奖励。
    const result = finishIslandGameRewardBase(reward, text);
    if (!tankTaskClears[taskId]) tankTaskClears[taskId] = 1;
    else tankTaskClears[taskId] += 1;
    saveTankTaskClears();

    if (typeof metaToast === "function") {
      metaToast(firstClear
        ? `🏆 ${text} 首通 +500金币`
        : `🎮 ${text} 再次通关 +300金币`);
    }
    return result;
  };
}

// 派对特殊模式：寻宝 / 据点 / 技能大乱斗。
if (typeof finishPartySpecial === "function") {
  const finishPartySpecialRewardBase = finishPartySpecial;
  finishPartySpecial = function(text, _oldCoins) {
    if (!partySpecialState || partySpecialState.finished) return;
    const mode = partySpecialMode || "unknown";
    const taskId = `special-${mode}`;
    const firstClear = !tankTaskClears[taskId];
    const reward = firstClear ? 500 : 300;

    const result = finishPartySpecialRewardBase(text, reward);
    if (!tankTaskClears[taskId]) tankTaskClears[taskId] = 1;
    else tankTaskClears[taskId] += 1;
    saveTankTaskClears();

    if (typeof metaToast === "function") {
      metaToast(firstClear
        ? `🏆 ${text} 首通 +500金币`
        : `🎮 ${text} 再次通关 +300金币`);
    }
    return result;
  };
}

// 主线每一关单独计算首通。
if (typeof nextLevelOrWin === "function") {
  const nextLevelOrWinRewardBase = nextLevelOrWin;
  nextLevelOrWin = function() {
    const taskId = `story-level-${level}`;
    const result = awardTankTask(taskId, `主线第${level}关`);
    const baseResult = nextLevelOrWinRewardBase();

    // 将奖励同时显示在过关界面。
    if (typeof overlayText !== "undefined" && overlayText && (state === "levelclear" || state === "win")) {
      const extra = result.firstClear ? "首通奖励：500金币" : "重复通关奖励：300金币";
      overlayText.innerHTML += `<br><b>🪙 ${extra}</b>`;
    }
    return baseResult;
  };
}
