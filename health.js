// 玩家与基地血量系统
const PLAYER_MAX_HP = 5;
const BASE_MAX_HP = 3;
let baseHP = BASE_MAX_HP;

const elBaseHP = document.getElementById("base-hp");

// 把原来的“生命”改成真正的玩家血量：5滴血，扣到0才游戏结束。
const originalCreatePlayerAtSpawn = createPlayerAtSpawn;
createPlayerAtSpawn = function () {
  const tank = originalCreatePlayerAtSpawn();
  tank.maxHp = PLAYER_MAX_HP;
  tank.hp = PLAYER_MAX_HP;
  lives = tank.hp;
  return tank;
};

// 每一关开始时，玩家和基地都恢复满血。
const originalStartLevel = startLevel;
startLevel = function (n) {
  baseHP = BASE_MAX_HP;
  originalStartLevel(n);
  if (player) {
    player.maxHp = PLAYER_MAX_HP;
    player.hp = PLAYER_MAX_HP;
    lives = player.hp;
  }
  updateHUD();
};

// 玩家受伤：按敌方子弹的 damage 扣血。
killPlayer = function (damage = 1) {
  if (!player || !player.alive) return;

  const actualDamage = Math.max(1, damage || 1);
  player.hp = Math.max(0, (player.hp ?? PLAYER_MAX_HP) - actualDamage);
  lives = player.hp;

  if (player.hp <= 0) {
    player.alive = false;
    endGame(false);
  }

  updateHUD();
};

// ❤️ 道具恢复1滴玩家血量，最多恢复到5滴。
const originalApplyPowerUp = applyPowerUp;
applyPowerUp = function (powerUp) {
  if (powerUp.type === "life") {
    if (player && player.alive) {
      player.hp = Math.min(PLAYER_MAX_HP, player.hp + 1);
      lives = player.hp;
      updateHUD();
    }
    return;
  }

  originalApplyPowerUp(powerUp);
};

// 基地血量系统：
// 1. 我方子弹碰到自己的基地时直接穿过去，不扣血、不消失。
// 2. 敌方子弹正常伤害基地，按 bullet.damage 扣血。
const originalBulletUpdate = Bullet.prototype.update;
Bullet.prototype.update = function () {
  const v = DIR_VEC[this.dir];
  const nextX = this.x + v.x * this.speed;
  const nextY = this.y + v.y * this.speed;
  const c = Math.floor(nextX / TILE);
  const r = Math.floor(nextY / TILE);
  const nextIsBase =
    r >= 0 && r < GRID && c >= 0 && c < GRID && map[r][c] === T.BASE;

  // 我方子弹：临时把基地格当作空地，让原子弹逻辑继续运行，随后恢复基地。
  if (this.fromPlayer && nextIsBase) {
    map[r][c] = T.EMPTY;
    originalBulletUpdate.call(this);

    // 只要基地还活着，就恢复基地格。子弹本身会继续飞行。
    if (baseHP > 0 && baseAlive) {
      map[r][c] = T.BASE;
    }
    return;
  }

  const willHitBase = !this.fromPlayer && nextIsBase;
  originalBulletUpdate.call(this);

  if (willHitBase) {
    const damage = Math.max(1, this.damage || 1);
    baseHP = Math.max(0, baseHP - damage);

    if (baseHP > 0) {
      baseAlive = true;
      // 原逻辑会把被击中的基地格清空；基地还有血时把它恢复回来。
      map[r][c] = T.BASE;
    } else {
      baseAlive = false;
    }

    updateHUD();
  }
};

// HUD 同步显示玩家血量与基地血量。
const originalUpdateHUD = updateHUD;
updateHUD = function () {
  if (player && player.alive) lives = player.hp;
  originalUpdateHUD();
  if (elBaseHP) elBaseHP.textContent = baseHP;
};

// 菜单初始显示正确血量。
lives = PLAYER_MAX_HP;
updateHUD();
