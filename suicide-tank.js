// 敌方自爆坦克
// 特性：无敌、主动追击玩家、靠近玩家后自爆造成2滴伤害；对基地完全无效。

ENEMY_TYPES.suicide = {
  name: "自爆坦克",
  color: "#ff3b30",
  speed: 2.45,
  hp: 1,
  fireChance: 0,
  shotCooldown: 9999,
  bulletSpeed: 0,
  score: 180,
  dropChance: 0.70,
  damage: 2,
  mark: "爆",
};

const SUICIDE_TRIGGER_DISTANCE = 50;
const SUICIDE_EXPLOSION_DAMAGE = 2;
const SUICIDE_EXPLOSION_VISUAL_FRAMES = 18;
const suicideExplosionEffects = [];

// 从第5关开始逐渐加入自爆坦克；BOSS召唤池保持原样。
if (ENEMY_SPAWN_PLANS[4] && ENEMY_SPAWN_PLANS[4].length >= 14) {
  ENEMY_SPAWN_PLANS[4][8] = "suicide";
}
if (ENEMY_SPAWN_PLANS[6] && ENEMY_SPAWN_PLANS[6].length >= 18) {
  ENEMY_SPAWN_PLANS[6][5] = "suicide";
  ENEMY_SPAWN_PLANS[6][14] = "suicide";
}
if (ENEMY_SPAWN_PLANS[7] && ENEMY_SPAWN_PLANS[7].length >= 20) {
  ENEMY_SPAWN_PLANS[7][4] = "suicide";
  ENEMY_SPAWN_PLANS[7][12] = "suicide";
  ENEMY_SPAWN_PLANS[7][18] = "suicide";
}
if (ENEMY_SPAWN_PLANS[8] && ENEMY_SPAWN_PLANS[8].length >= 22) {
  ENEMY_SPAWN_PLANS[8][3] = "suicide";
  ENEMY_SPAWN_PLANS[8][10] = "suicide";
  ENEMY_SPAWN_PLANS[8][17] = "suicide";
  ENEMY_SPAWN_PLANS[8][21] = "suicide";
}

function isSuicideTank(tank) {
  return !!tank && !tank.isPlayer && tank.type === "suicide";
}

// 自爆坦克无敌：玩家子弹、炸弹道具等都无法将它击杀。
const takeDamageBeforeSuicideTank = Tank.prototype.takeDamage;
Tank.prototype.takeDamage = function (amount = 1, allowDrop = true) {
  if (isSuicideTank(this) && this.alive) {
    this.suicideHitFlash = 6;
    return false;
  }
  return takeDamageBeforeSuicideTank.call(this, amount, allowDrop);
};

function suicideDistanceToPlayer(tank) {
  if (!player || !player.alive) return Infinity;
  const dx = player.cx - tank.cx;
  const dy = player.cy - tank.cy;
  return Math.sqrt(dx * dx + dy * dy);
}

function explodeSuicideTank(tank) {
  if (!isSuicideTank(tank) || !tank.alive || tank.suicideExploded) return;

  tank.suicideExploded = true;
  tank.alive = false;

  suicideExplosionEffects.push({
    x: tank.cx,
    y: tank.cy,
    timer: SUICIDE_EXPLOSION_VISUAL_FRAMES,
    maxTimer: SUICIDE_EXPLOSION_VISUAL_FRAMES,
  });

  // 自爆只伤害玩家，对基地完全无效。
  if (player && player.alive && suicideDistanceToPlayer(tank) <= SUICIDE_TRIGGER_DISTANCE + 12) {
    if ((player.shieldTimer || 0) <= 0) {
      killPlayer(SUICIDE_EXPLOSION_DAMAGE);
    }
  }

  // 自爆后该敌人正常从关卡中移除；不额外生成道具。
  handleEnemyDestroyed(tank, false);
}

function trySuicideMoveTowardPlayer(tank) {
  if (!player || !player.alive) return;

  const dx = player.cx - tank.cx;
  const dy = player.cy - tank.cy;
  const horizontal = dx < 0 ? DIR.LEFT : DIR.RIGHT;
  const vertical = dy < 0 ? DIR.UP : DIR.DOWN;
  const preferred = Math.abs(dx) >= Math.abs(dy)
    ? [horizontal, vertical]
    : [vertical, horizontal];

  tank.tryMove(preferred[0]);
  if (!tank.moving) tank.tryMove(preferred[1]);

  if (!tank.moving) {
    const fallback = [DIR.DOWN, DIR.LEFT, DIR.RIGHT, DIR.UP];
    tank.tryMove(fallback[Math.floor(rnd() * fallback.length)]);
  }
}

// 自爆坦克不使用普通敌方射击AI，而是专门追踪玩家。
const aiUpdateBeforeSuicideTank = Tank.prototype.aiUpdate;
Tank.prototype.aiUpdate = function () {
  if (!isSuicideTank(this)) {
    return aiUpdateBeforeSuicideTank.call(this);
  }

  if (this.suicideHitFlash > 0) this.suicideHitFlash--;

  const distance = suicideDistanceToPlayer(this);

  // “削弱”期间敌方不能发动攻击，因此自爆也会被禁止；仍然可以按削弱后的速度移动。
  const weakenedAndDisarmed =
    typeof globalEnemyWeakenTimer !== "undefined" && globalEnemyWeakenTimer > 0;

  if (!weakenedAndDisarmed && distance <= SUICIDE_TRIGGER_DISTANCE) {
    explodeSuicideTank(this);
    return;
  }

  trySuicideMoveTowardPlayer(this);
};

// 自爆坦克视觉：红色警示圈；被玩家击中时闪白，表示“无敌”。
const drawTankBeforeSuicideTank = drawTank;
drawTank = function (tank, color) {
  drawTankBeforeSuicideTank(tank, color);
  if (!isSuicideTank(tank) || !tank.alive) return;

  ctx.save();
  ctx.strokeStyle = tank.suicideHitFlash > 0 ? "#ffffff" : "#ff453a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(tank.cx, tank.cy, tank.size / 2 + 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("自爆", tank.cx, tank.y - 4);
  ctx.restore();
};

function updateSuicideExplosionEffects() {
  for (const effect of suicideExplosionEffects) effect.timer--;
  for (let i = suicideExplosionEffects.length - 1; i >= 0; i--) {
    if (suicideExplosionEffects[i].timer <= 0) suicideExplosionEffects.splice(i, 1);
  }
}

const updateBeforeSuicideEffects = update;
update = function () {
  updateBeforeSuicideEffects();
  updateSuicideExplosionEffects();
};

function drawSuicideExplosionEffects() {
  for (const effect of suicideExplosionEffects) {
    const progress = 1 - effect.timer / effect.maxTimer;
    const radius = 12 + progress * 42;
    ctx.save();
    ctx.globalAlpha = Math.max(0, effect.timer / effect.maxTimer);
    ctx.strokeStyle = "#ff9500";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

const drawBeforeSuicideEffects = draw;
draw = function () {
  drawBeforeSuicideEffects();
  drawSuicideExplosionEffects();
};
