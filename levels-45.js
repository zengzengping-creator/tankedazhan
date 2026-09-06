// 第4、5关与高级敌人扩展
// 第4关：新增5滴血“堡垒坦克”
// 第5关：新增5滴血“毁灭坦克”，射速更快，每发造成1滴伤害

const EXTENDED_MAX_LEVEL = 5;

// ------------------- 新敌人类型 -------------------
ENEMY_TYPES.fortress = {
  name: "堡垒坦克",
  color: "#2ecc71",
  speed: 1.05,
  hp: 5,
  fireChance: 0.042,
  shotCooldown: 36,
  bulletSpeed: 6.0,
  score: 480,
  dropChance: 1.00,
  damage: 1,
  mark: "堡",
};

ENEMY_TYPES.destroyer = {
  name: "毁灭坦克",
  color: "#ff2d55",
  speed: 1.45,
  hp: 5,
  fireChance: 0.080,
  shotCooldown: 18,
  bulletSpeed: 7.0,
  score: 700,
  dropChance: 1.00,
  damage: 1,
  mark: "毁",
};

// 旧敌人默认每发1滴伤害
for (const type of Object.keys(ENEMY_TYPES)) {
  if (ENEMY_TYPES[type].damage == null) ENEMY_TYPES[type].damage = 1;
}

// ------------------- 新关卡地图 -------------------
LEVELS.push(
  [
    ".............",
    ".SS.BB.BB.SS.",
    ".BB....B..BB.",
    "...S.....S...",
    "BB.B.BBB.B.BB",
    "...B..S..B...",
    ".B...BBB...B.",
    "...S.....S...",
    "BB.B.BBB.B.BB",
    ".B.B.....B.B.",
    ".BB.BBBBB.BB.",
    "....BBEBB....",
    "....B.E.B....",
  ],
  [
    ".............",
    ".S.BB.S.BB.S.",
    ".B.B..B..B.B.",
    "BB..S...S..BB",
    "..B.BBB.B.B..",
    "S...B.S.B...S",
    ".BBB.....BBB.",
    "S...B.S.B...S",
    "..B.BBB.B.B..",
    "BB..S...S..BB",
    ".BB.BBBBB.BB.",
    "....BBEBB....",
    "....B.E.B....",
  ]
);

// 第4、5关敌人编成。
// startLevel() 会生成 4 + level * 2 个敌人：第4关12个，第5关14个。
ENEMY_SPAWN_PLANS.push(
  [
    "armor", "firepower", "elite", "fortress",
    "fast", "armor", "fortress", "firepower",
    "elite", "fortress", "armor", "fortress",
  ],
  [
    "armor", "firepower", "elite", "fortress", "destroyer",
    "fast", "fortress", "destroyer", "elite", "armor",
    "destroyer", "firepower", "fortress", "destroyer",
  ]
);

// ------------------- 让子弹携带伤害值 -------------------
Tank.prototype.shoot = function () {
  if (this.cooldown > 0) return;

  let cooldown = this.shotCooldown;
  let bulletSpeed = this.bulletSpeed;
  if (this.isPlayer && this.fireTimer > 0) {
    cooldown = 9;
    bulletSpeed = 7.5;
  }

  this.cooldown = cooldown;
  const v = DIR_VEC[this.dir];
  const bx = this.cx + v.x * (this.size / 2);
  const by = this.cy + v.y * (this.size / 2);
  const bullet = new Bullet(bx, by, this.dir, this.isPlayer, bulletSpeed);

  bullet.damage = this.isPlayer
    ? (this.damage || 1)
    : (this.damage || ENEMY_TYPES[this.type]?.damage || 1);

  bullets.push(bullet);
};

// 安全出生逻辑生成坦克后，把当前类型伤害属性同步到坦克实例。
const spawnEnemyBeforeAdvancedTypes = spawnEnemy;
spawnEnemy = function () {
  const before = enemies.length;
  spawnEnemyBeforeAdvancedTypes();

  for (let i = before; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy) continue;
    enemy.damage = ENEMY_TYPES[enemy.type]?.damage || 1;
  }
};

// ------------------- 子弹伤害逻辑 -------------------
// 玩家和敌方子弹都按 bullet.damage 结算伤害。
Bullet.prototype.update = function () {
  const v = DIR_VEC[this.dir];
  this.x += v.x * this.speed;
  this.y += v.y * this.speed;

  if (this.x < 0 || this.y < 0 || this.x > W || this.y > W) {
    this.alive = false;
    return;
  }

  const c = Math.floor(this.x / TILE);
  const r = Math.floor(this.y / TILE);
  if (r >= 0 && r < GRID && c >= 0 && c < GRID) {
    const t = map[r][c];
    if (t === T.BRICK) {
      map[r][c] = T.EMPTY;
      this.alive = false;
      return;
    } else if (t === T.STEEL) {
      this.alive = false;
      return;
    } else if (t === T.BASE) {
      map[r][c] = T.EMPTY;
      baseAlive = false;
      this.alive = false;
      return;
    }
  }

  const b = {
    x: this.x - this.size / 2,
    y: this.y - this.size / 2,
    w: this.size,
    h: this.size,
  };

  if (this.fromPlayer) {
    for (const e of enemies) {
      if (e.alive && rectsOverlap(b, e.rect())) {
        e.takeDamage(this.damage || 1, true);
        this.alive = false;
        return;
      }
    }
  } else if (player && player.alive && rectsOverlap(b, player.rect())) {
    this.alive = false;
    if (player.shieldTimer <= 0) killPlayer(this.damage || 1);
    return;
  }

  for (const o of bullets) {
    if (o !== this && o.alive && o.fromPlayer !== this.fromPlayer) {
      const ob = {
        x: o.x - o.size / 2,
        y: o.y - o.size / 2,
        w: o.size,
        h: o.size,
      };
      if (rectsOverlap(b, ob)) {
        o.alive = false;
        this.alive = false;
        return;
      }
    }
  }
};

// ------------------- 扩展通关逻辑到5关 -------------------
nextLevelOrWin = function () {
  if (level >= EXTENDED_MAX_LEVEL) {
    endGame(true);
  } else {
    state = "levelclear";
    overlay.classList.remove("hidden");
    overlayTitle.textContent = `关卡 ${level} 完成！`;
    overlayText.innerHTML = `准备进入第 ${level + 1} 关...<br>得分: <b>${score}</b>`;
    startBtn.textContent = "下一关";
  }
};
