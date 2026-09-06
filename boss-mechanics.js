// BOSS战机制：第6关 / 第10关
// 规则：BOSS无敌并召唤小坦克 -> 清光召唤物 -> BOSS眩晕5秒且可受伤 -> 再次召唤

const BOSS_TYPES = new Set(["boss6", "boss10"]);
const BOSS_MINION_TYPES = ["normal", "fast", "armor", "elite", "fortress", "destroyer"];
const BOSS_STUN_FRAMES = 5 * 60;
let bossSerial = 0;

// 第6、10关是真正的BOSS关：只由BOSS本体进入常规出生队列，杂兵由BOSS亲自召唤。
ENEMY_SPAWN_PLANS[5] = ["boss6"];
ENEMY_SPAWN_PLANS[9] = ["boss10"];

function isBoss(tank) {
  return !!tank && BOSS_TYPES.has(tank.type);
}

function rectHitsSolidMap(rect) {
  const left = Math.floor(rect.x / TILE);
  const right = Math.floor((rect.x + rect.w - 1) / TILE);
  const top = Math.floor(rect.y / TILE);
  const bottom = Math.floor((rect.y + rect.h - 1) / TILE);

  if (left < 0 || top < 0 || right >= GRID || bottom >= GRID) return true;

  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      if (map[r][c] !== T.EMPTY) return true;
    }
  }
  return false;
}

function bossPositionIsSafe(boss, x, y) {
  const rect = { x, y, w: boss.size, h: boss.size };
  if (rectHitsSolidMap(rect)) return false;

  return ![player, ...enemies].some((tank) =>
    tank && tank !== boss && tank.alive && rectsOverlap(rect, tank.rect())
  );
}

function placeBossSafely(boss) {
  // BOSS实体也比普通坦克大；最终BOSS更大。
  boss.size = boss.type === "boss10" ? 62 : 54;

  const candidates = [];
  for (let r = 0; r <= 5; r++) {
    for (let c = 0; c < GRID; c++) {
      const x = c * TILE + 3;
      const y = r * TILE + 3;
      if (bossPositionIsSafe(boss, x, y)) {
        const centerDistance = Math.abs((x + boss.size / 2) - W / 2);
        candidates.push({ x, y, score: r * 100 + centerDistance });
      }
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  if (candidates.length > 0) {
    boss.x = candidates[0].x;
    boss.y = candidates[0].y;
  } else {
    // 极端情况下缩小一点，保证不会因为地图改动再次卡墙。
    boss.size = 46;
  }
}

function findSafeMinionSpot() {
  const candidates = [];
  const size = TILE - 6;

  // 召唤物优先出现在地图上半区，不直接贴着基地生成。
  for (let r = 0; r <= 6; r++) {
    for (let c = 0; c < GRID; c++) {
      if (map[r][c] !== T.EMPTY) continue;

      const x = c * TILE + 3;
      const y = r * TILE + 3;
      const rect = { x, y, w: size, h: size };
      const blocked = [player, ...enemies].some((tank) =>
        tank && tank.alive && rectsOverlap(rect, tank.rect())
      );
      if (!blocked) candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(rnd() * candidates.length)];
}

function summonOneBossMinion(boss, type) {
  const spot = findSafeMinionSpot();
  if (!spot) return false;

  const minion = new Tank(spot.x, spot.y, DIR.DOWN, false, type);
  minion.damage = ENEMY_TYPES[type]?.damage || 1;
  minion.summonedByBoss = boss.bossId;
  minion.isBossMinion = true;
  enemies.push(minion);
  return true;
}

function summonBossWave(boss) {
  if (!boss || !boss.alive) return;

  const count = boss.type === "boss10" ? 5 : 3;
  boss.bossWave = (boss.bossWave || 0) + 1;
  boss.bossShielded = true;
  boss.bossStunned = false;
  boss.stunTimer = 0;

  for (let i = 0; i < count; i++) {
    // 每波从普通、快速、重甲、精英、堡垒、毁灭中随机召唤。
    const type = BOSS_MINION_TYPES[Math.floor(rnd() * BOSS_MINION_TYPES.length)];
    summonOneBossMinion(boss, type);
  }
}

function configureBoss(boss) {
  if (!isBoss(boss) || boss.bossConfigured) return;

  boss.bossConfigured = true;
  boss.bossId = `boss-${++bossSerial}`;
  boss.damage = ENEMY_TYPES[boss.type]?.damage || 1;
  boss.bossShielded = true;
  boss.bossStunned = false;
  boss.stunTimer = 0;
  boss.bossWave = 0;
  placeBossSafely(boss);
  summonBossWave(boss);
}

// 在BOSS关只生成1个BOSS本体；之后的小坦克由BOSS召唤。
const startLevelBeforeBossMechanics = startLevel;
startLevel = function (n) {
  startLevelBeforeBossMechanics(n);
  if (n === 6 || n === 10) {
    enemiesToSpawn = 1;
    enemySpawnIndex = 0;
    spawnTimer = 0;
    updateHUD();
  }
};

// 接到现有的安全出生逻辑后面，BOSS出生后立即放大、移动到安全大空间并开始召唤。
const spawnEnemyBeforeBossMechanics = spawnEnemy;
spawnEnemy = function () {
  const before = enemies.length;
  spawnEnemyBeforeBossMechanics();

  for (let i = before; i < enemies.length; i++) {
    if (isBoss(enemies[i])) configureBoss(enemies[i]);
  }
};

// BOSS在护盾阶段完全无敌；只有眩晕窗口能受到伤害。
const takeDamageBeforeBossMechanics = Tank.prototype.takeDamage;
Tank.prototype.takeDamage = function (amount = 1, allowDrop = true) {
  if (isBoss(this) && this.bossConfigured && !this.bossStunned) {
    this.bossBlockedHitFlash = 8;
    return false;
  }
  return takeDamageBeforeBossMechanics.call(this, amount, allowDrop);
};

// 眩晕期间BOSS完全停止移动和开火。
const aiUpdateBeforeBossMechanics = Tank.prototype.aiUpdate;
Tank.prototype.aiUpdate = function () {
  if (isBoss(this) && this.bossStunned) {
    this.moving = false;
    return;
  }
  aiUpdateBeforeBossMechanics.call(this);
};

function updateBossPhases() {
  const bosses = enemies.filter((tank) => isBoss(tank) && tank.alive);

  for (const boss of bosses) {
    if (boss.bossBlockedHitFlash > 0) boss.bossBlockedHitFlash--;

    const aliveMinions = enemies.filter(
      (tank) => tank.alive && tank.summonedByBoss === boss.bossId
    ).length;

    if (boss.bossStunned) {
      boss.stunTimer--;
      if (boss.stunTimer <= 0 && boss.alive) {
        summonBossWave(boss);
      }
      continue;
    }

    // 护盾阶段的小坦克全部清除后，BOSS进入5秒眩晕弱点期。
    if (boss.bossShielded && aliveMinions === 0) {
      boss.bossShielded = false;
      boss.bossStunned = true;
      boss.stunTimer = BOSS_STUN_FRAMES;
      boss.moving = false;
      boss.aiTimer = 60;
    }
  }
}

const updateBeforeBossMechanics = update;
update = function () {
  updateBeforeBossMechanics();
  if (state === "playing") updateBossPhases();
};

// ------------------- BOSS视觉与状态提示 -------------------
const drawTankBeforeBossMechanics = drawTank;
drawTank = function (tank, color) {
  drawTankBeforeBossMechanics(tank, color);
  if (!isBoss(tank) || !tank.alive) return;

  ctx.save();

  // 护盾阶段显示明显保护圈。
  if (!tank.bossStunned) {
    ctx.strokeStyle = tank.bossBlockedHitFlash > 0 ? "#ffffff" : "#00e5ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(tank.cx, tank.cy, tank.size / 2 + 8, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // 眩晕时闪烁星星，明确告诉玩家现在可以攻击。
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💫", tank.cx - 15, tank.y - 5);
    ctx.fillText("💫", tank.cx + 15, tank.y - 5);
  }

  ctx.restore();
};

function drawBossBattleHUD() {
  const boss = enemies.find((tank) => isBoss(tank) && tank.alive);
  if (!boss) return;

  const aliveMinions = enemies.filter(
    (tank) => tank.alive && tank.summonedByBoss === boss.bossId
  ).length;

  const x = 135;
  const y = 7;
  const width = 250;
  const hpRatio = Math.max(0, boss.hp / boss.maxHp);

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.78)";
  ctx.fillRect(x, y, width, 48);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(
    boss.type === "boss10" ? `👑 FINAL BOSS  ${boss.hp}/${boss.maxHp}` : `👑 BOSS  ${boss.hp}/${boss.maxHp}`,
    x + width / 2,
    y + 4
  );

  ctx.fillStyle = "#333";
  ctx.fillRect(x + 12, y + 21, width - 24, 8);
  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(x + 12, y + 21, (width - 24) * hpRatio, 8);

  ctx.font = "bold 11px sans-serif";
  if (boss.bossStunned) {
    ctx.fillStyle = "#ffe66d";
    ctx.fillText(`💫 BOSS眩晕！可攻击 ${Math.ceil(boss.stunTimer / 60)}秒`, x + width / 2, y + 33);
  } else {
    ctx.fillStyle = "#66e0ff";
    ctx.fillText(`🛡️ BOSS无敌 · 先清除召唤坦克 ${aliveMinions}辆`, x + width / 2, y + 33);
  }
  ctx.restore();
}

const drawBeforeBossMechanics = draw;
draw = function () {
  drawBeforeBossMechanics();
  drawBossBattleHUD();
};
