// 角色强化：基地10血、全能六能合一、削弱坦克
// 削弱效果只作用于敌方坦克：血量压到1、移速-50%、禁止开火。

const WEAKEN_TANK_DURATION = 10 * 60;
const OMNI_DURATION = 20 * 60;
let globalEnemyWeakenTimer = 0;

// ------------------- 强化基地坦克 / 全能坦克 -------------------
if (PLAYER_TANK_CLASSES.base) {
  PLAYER_TANK_CLASSES.base.baseMaxHp = 10;
  PLAYER_TANK_CLASSES.base.damage = 5;
  PLAYER_TANK_CLASSES.base.skillDesc = "基地立即恢复满血到10滴";
}

if (PLAYER_TANK_CLASSES.omni) {
  PLAYER_TANK_CLASSES.omni.baseMaxHp = 10;
  PLAYER_TANK_CLASSES.omni.damage = 5;
  PLAYER_TANK_CLASSES.omni.skillName = "六能合一";
  PLAYER_TANK_CLASSES.omni.skillDesc = "六种能力同时发动20秒";
}

// ------------------- 新增玩家角色：削弱坦克 -------------------
PLAYER_TANK_CLASSES.weaken = {
  name: "削弱坦克",
  color: "#00bcd4",
  mark: "弱",
  speed: 2.35,
  maxHp: 5,
  damage: 1,
  shotCooldown: 20,
  bulletSpeed: 5.5,
  skillName: "削弱",
  skillDesc: "敌军变1血、减速50%、禁火10秒",
  cooldown: 20 * 60,
};

function weakenEnemyTank(tank) {
  if (!tank || !tank.alive || tank.isPlayer) return;

  // 血量直接降到1滴；削弱结束后血量不会自动恢复。
  tank.hp = 1;

  // 只记录一次原始速度，避免每帧重复减半。
  if (tank.weakenOriginalBaseSpeed == null) {
    tank.weakenOriginalBaseSpeed = tank.baseSpeed;
  }
  tank.baseSpeed = tank.weakenOriginalBaseSpeed * 0.5;
  tank.weakenedByPlayer = true;
}

function restoreEnemyMovementAfterWeakening() {
  for (const tank of enemies) {
    if (!tank || tank.weakenOriginalBaseSpeed == null) continue;
    tank.baseSpeed = tank.weakenOriginalBaseSpeed;
    tank.weakenOriginalBaseSpeed = null;
    tank.weakenedByPlayer = false;
  }
}

function applyGlobalEnemyWeakening(durationFrames) {
  globalEnemyWeakenTimer = Math.max(globalEnemyWeakenTimer, durationFrames);
  for (const tank of enemies) weakenEnemyTank(tank);
}

// 削弱期间所有敌方坦克（包括BOSS）都不能开火。
const shootBeforeWeakening = Tank.prototype.shoot;
Tank.prototype.shoot = function () {
  if (!this.isPlayer && globalEnemyWeakenTimer > 0) return;
  return shootBeforeWeakening.call(this);
};

// 每帧把削弱效果同步给新出生/新召唤的敌军。
const updateBeforeWeakening = update;
update = function () {
  updateBeforeWeakening();

  if (state !== "playing" || globalEnemyWeakenTimer <= 0) return;

  for (const tank of enemies) weakenEnemyTank(tank);
  globalEnemyWeakenTimer--;

  if (globalEnemyWeakenTimer <= 0) {
    restoreEnemyMovementAfterWeakening();
  }
};

// 换关时清除上一关剩余的临时削弱状态。
const startLevelBeforeWeakening = startLevel;
startLevel = function (n) {
  restoreEnemyMovementAfterWeakening();
  globalEnemyWeakenTimer = 0;
  startLevelBeforeWeakening(n);
};

// ------------------- 覆盖Q技能：基地 / 削弱 / 全能 -------------------
const activatePlayerSkillBeforeBalanceUpgrade = activatePlayerSkill;
activatePlayerSkill = function () {
  if (state !== "playing" || !player || !player.alive) return;

  const type = player.playerClass;
  const cfg = PLAYER_TANK_CLASSES[type] || PLAYER_TANK_CLASSES.normal;

  if (type === "base") {
    if (player.skillCooldown > 0 || baseHP >= 10) return;
    player.skillCooldown = cfg.cooldown;
    baseHP = 10;
    baseAlive = true;
    updateHUD();
    return;
  }

  if (type === "weaken") {
    if (player.skillCooldown > 0) return;
    player.skillCooldown = cfg.cooldown;
    player.skillActiveTimer = WEAKEN_TANK_DURATION;
    applyGlobalEnemyWeakening(WEAKEN_TANK_DURATION);
    updateHUD();
    return;
  }

  if (type === "omni") {
    if (player.skillCooldown > 0) return;

    player.skillCooldown = cfg.cooldown;
    player.skillActiveTimer = OMNI_DURATION;

    // 1. 普通坦克能力：20秒无敌护盾。
    player.shieldTimer = Math.max(player.shieldTimer || 0, OMNI_DURATION);

    // 2. 快速坦克能力：20秒极速冲刺。
    player.omniSpeedTimer = OMNI_DURATION;
    player.baseSpeed = cfg.speed * 1.7;

    // 3. 精英坦克能力：20秒高速连射。
    player.fireTimer = Math.max(player.fireTimer || 0, OMNI_DURATION);

    // 4. 重甲坦克能力：自己直接回满10滴血。
    player.hp = cfg.maxHp;
    lives = player.hp;

    // 5. 基地坦克能力：基地直接回满10滴血。
    baseHP = cfg.baseMaxHp;
    baseAlive = true;

    // 6. 削弱坦克能力：全场敌军20秒减速/禁火，血量直接降到1。
    applyGlobalEnemyWeakening(OMNI_DURATION);

    updateHUD();
    return;
  }

  return activatePlayerSkillBeforeBalanceUpgrade();
};

// ------------------- 削弱状态视觉提示 -------------------
const drawTankBeforeWeakening = drawTank;
drawTank = function (tank, color) {
  drawTankBeforeWeakening(tank, color);

  if (!tank || !tank.alive || tank.isPlayer || !tank.weakenedByPlayer) return;
  ctx.save();
  ctx.fillStyle = "#7df9ff";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("弱", tank.cx, tank.y - 3);
  ctx.restore();
};
