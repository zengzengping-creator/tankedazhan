/* ===================================================================
   坦克大战 Tank Battle — 经典单人闯关
   Canvas 网格: 13 x 13 tiles, 每 tile 40px = 520x520
   =================================================================== */

const TILE = 40;
const GRID = 13;
const W = TILE * GRID;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// HUD 元素
const elLevel = document.getElementById("level");
const elLives = document.getElementById("lives");
const elScore = document.getElementById("score");
const elEnemies = document.getElementById("enemies-left");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");

// 方向常量
const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
const DIR_VEC = {
  0: { x: 0, y: -1 },
  1: { x: 1, y: 0 },
  2: { x: 0, y: 1 },
  3: { x: -1, y: 0 },
};

// 瓦片类型
const T = { EMPTY: 0, BRICK: 1, STEEL: 2, BASE: 3 };

// 敌人类型：掉落概率严格按约定设置
const ENEMY_TYPES = {
  normal: {
    name: "普通坦克",
    color: "#e74c3c",
    speed: 1.3,
    hp: 1,
    fireChance: 0.020,
    shotCooldown: 55,
    bulletSpeed: 5,
    score: 100,
    dropChance: 0.20,
    mark: "普",
  },
  fast: {
    name: "快速坦克",
    color: "#3498db",
    speed: 2.0,
    hp: 1,
    fireChance: 0.025,
    shotCooldown: 46,
    bulletSpeed: 5.6,
    score: 130,
    dropChance: 0.25,
    mark: "快",
  },
  armor: {
    name: "重甲坦克",
    color: "#95a5a6",
    speed: 0.9,
    hp: 3,
    fireChance: 0.018,
    shotCooldown: 62,
    bulletSpeed: 4.8,
    score: 220,
    dropChance: 0.30,
    mark: "甲",
  },
  firepower: {
    name: "火力坦克",
    color: "#e67e22",
    speed: 1.2,
    hp: 2,
    fireChance: 0.050,
    shotCooldown: 30,
    bulletSpeed: 6.2,
    score: 190,
    dropChance: 0.35,
    mark: "火",
  },
  elite: {
    name: "精英坦克",
    color: "#9b59b6",
    speed: 1.65,
    hp: 4,
    fireChance: 0.045,
    shotCooldown: 34,
    bulletSpeed: 6.4,
    score: 360,
    dropChance: 0.80,
    mark: "精",
  },
};

const POWERUP_TYPES = ["shield", "speed", "fire", "life", "bomb"];
const POWERUP_INFO = {
  shield: { icon: "🛡️", label: "护盾", bg: "#16a085" },
  speed: { icon: "⚡", label: "加速", bg: "#2980b9" },
  fire: { icon: "🔥", label: "火力", bg: "#d35400" },
  life: { icon: "❤️", label: "生命", bg: "#c0392b" },
  bomb: { icon: "💣", label: "炸弹", bg: "#7f8c8d" },
};

// ------------------- 游戏状态 -------------------
let state = "menu"; // menu | playing | paused | levelclear | gameover | win
let level = 1;
let lives = 3;
let score = 0;
let map = []; // GRID x GRID 二维数组
let player = null;
let enemies = [];
let bullets = [];
let powerUps = [];
let enemiesToSpawn = 0;
let spawnTimer = 0;
let enemySpawnIndex = 0;
let baseAlive = true;
let keys = {};
let lastTime = 0;

const MAX_LEVEL = 3;

// 每关固定混合，确保玩家能遇到不同类型敌人
const ENEMY_SPAWN_PLANS = [
  ["normal", "normal", "fast", "normal", "fast", "normal"],
  ["normal", "fast", "armor", "normal", "firepower", "fast", "armor", "normal"],
  ["normal", "fast", "armor", "firepower", "elite", "fast", "armor", "firepower", "normal", "elite"],
];

// ------------------- 地图布局 -------------------
// 用字符串简单描述每关地图: . 空  B 砖  S 钢  E 鹰(基地)
const LEVELS = [
  [
    ".............",
    ".BB.BB.BB.BB.",
    ".BB.BB.BB.BB.",
    ".............",
    "..S.......S..",
    "..S...BB..S..",
    "..S...BB..S..",
    "..S.......S..",
    ".............",
    ".BB.BB.BB.BB.",
    ".BB.B...B.BB.",
    "....BBEBB....",
    "....B.E.B....",
  ],
  [
    "....SSSSS....",
    ".B.B.....B.B.",
    ".B.B.BBB.B.B.",
    ".B.B.B.B.B.B.",
    "...S.B.B.S...",
    "BBB..B.B..BBB",
    ".S.........S.",
    "BBB..B.B..BBB",
    "...S.B.B.S...",
    ".B.B.B.B.B.B.",
    ".B.B.BBB.B.B.",
    "....BBEBB....",
    "....B.E.B....",
  ],
  [
    "S...S...S...S",
    ".BBB.BBB.BBB.",
    ".B.........B.",
    ".B.SS.S.SS.B.",
    "....B...B....",
    "BB.B.BBB.B.BB",
    "...B..S..B...",
    "BB.B.BBB.B.BB",
    "....B...B....",
    ".B.SS.S.SS.B.",
    ".B.........B.",
    ".BBB.BEB.BBB.",
    "....B.E.B....",
  ],
];

function buildMap(layout) {
  const m = [];
  for (let r = 0; r < GRID; r++) {
    const row = [];
    for (let c = 0; c < GRID; c++) {
      const ch = layout[r][c];
      if (ch === "B") row.push(T.BRICK);
      else if (ch === "S") row.push(T.STEEL);
      else if (ch === "E") row.push(T.BASE);
      else row.push(T.EMPTY);
    }
    m.push(row);
  }
  return m;
}

// ------------------- 坦克类 -------------------
class Tank {
  constructor(x, y, dir, isPlayer, type = "normal") {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.isPlayer = isPlayer;
    this.type = isPlayer ? "player" : type;
    this.size = TILE - 6;
    this.cooldown = 0;
    this.alive = true;
    this.moving = false;

    if (isPlayer) {
      this.baseSpeed = 2.2;
      this.maxHp = 1;
      this.hp = 1;
      this.color = "#f1c40f";
      this.fireChance = 0;
      this.shotCooldown = 22;
      this.bulletSpeed = 5;
      this.scoreValue = 0;
      this.dropChance = 0;
      this.mark = "";
      this.shieldTimer = 0;
      this.speedTimer = 0;
      this.fireTimer = 0;
    } else {
      const stats = ENEMY_TYPES[type] || ENEMY_TYPES.normal;
      this.baseSpeed = stats.speed;
      this.maxHp = stats.hp;
      this.hp = stats.hp;
      this.color = stats.color;
      this.fireChance = stats.fireChance;
      this.shotCooldown = stats.shotCooldown;
      this.bulletSpeed = stats.bulletSpeed;
      this.scoreValue = stats.score;
      this.dropChance = stats.dropChance;
      this.mark = stats.mark;
    }

    // 敌人 AI
    this.aiTimer = 0;
    this.aiDir = dir;
  }

  get cx() { return this.x + this.size / 2; }
  get cy() { return this.y + this.size / 2; }

  get speed() {
    if (this.isPlayer && this.speedTimer > 0) return this.baseSpeed * 1.4;
    return this.baseSpeed;
  }

  rect() {
    return { x: this.x, y: this.y, w: this.size, h: this.size };
  }

  tryMove(dir) {
    this.dir = dir;
    const v = DIR_VEC[dir];
    const nx = this.x + v.x * this.speed;
    const ny = this.y + v.y * this.speed;
    if (!this.collides(nx, ny)) {
      this.x = nx;
      this.y = ny;
      this.moving = true;
    } else {
      this.moving = false;
    }
  }

  collides(nx, ny) {
    if (nx < 0 || ny < 0 || nx + this.size > W || ny + this.size > W) return true;

    const corners = [
      [nx, ny],
      [nx + this.size, ny],
      [nx, ny + this.size],
      [nx + this.size, ny + this.size],
    ];
    for (const [px, py] of corners) {
      const c = Math.floor(px / TILE);
      const r = Math.floor(py / TILE);
      if (r < 0 || r >= GRID || c < 0 || c >= GRID) return true;
      const t = map[r][c];
      if (t === T.BRICK || t === T.STEEL || t === T.BASE) return true;
    }

    const all = [player, ...enemies].filter((t) => t && t !== this && t.alive);
    const me = { x: nx, y: ny, w: this.size, h: this.size };
    for (const o of all) {
      if (rectsOverlap(me, o.rect())) return true;
    }
    return false;
  }

  shoot() {
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
    bullets.push(new Bullet(bx, by, this.dir, this.isPlayer, bulletSpeed));
  }

  takeDamage(amount = 1, allowDrop = true) {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      if (!this.isPlayer) handleEnemyDestroyed(this, allowDrop);
      return true;
    }
    return false;
  }

  update() {
    if (this.cooldown > 0) this.cooldown--;

    if (this.isPlayer) {
      if (this.shieldTimer > 0) this.shieldTimer--;
      if (this.speedTimer > 0) this.speedTimer--;
      if (this.fireTimer > 0) this.fireTimer--;
    } else {
      this.aiUpdate();
    }
  }

  aiUpdate() {
    this.aiTimer--;
    if (this.aiTimer <= 0) {
      const choices = [DIR.DOWN, DIR.DOWN, DIR.LEFT, DIR.RIGHT, DIR.UP];
      this.aiDir = choices[Math.floor(rnd() * choices.length)];
      this.aiTimer = 30 + Math.floor(rnd() * 60);
    }
    this.tryMove(this.aiDir);
    if (!this.moving) this.aiTimer = 0;
    if (rnd() < this.fireChance) this.shoot();
  }
}

// ------------------- 子弹类 -------------------
class Bullet {
  constructor(x, y, dir, fromPlayer, speed = 5) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.fromPlayer = fromPlayer;
    this.speed = speed;
    this.size = 6;
    this.alive = true;
  }

  update() {
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
          e.takeDamage(1, true);
          this.alive = false;
          return;
        }
      }
    } else if (player && player.alive && rectsOverlap(b, player.rect())) {
      this.alive = false;
      if (player.shieldTimer <= 0) killPlayer();
      return;
    }

    // 子弹互相抵消
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
  }
}

// ------------------- 道具类 -------------------
class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.size = 28;
    this.alive = true;
    this.lifeTimer = 900; // 约15秒后消失
  }

  rect() {
    return { x: this.x, y: this.y, w: this.size, h: this.size };
  }

  update() {
    this.lifeTimer--;
    if (this.lifeTimer <= 0) this.alive = false;
  }
}

// ------------------- 工具函数 -------------------
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

let seed = 12345;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function randomPowerUpType() {
  return POWERUP_TYPES[Math.floor(rnd() * POWERUP_TYPES.length)];
}

function handleEnemyDestroyed(enemy, allowDrop = true) {
  score += enemy.scoreValue;
  if (allowDrop && rnd() < enemy.dropChance) {
    const type = randomPowerUpType();
    const px = Math.max(4, Math.min(W - 32, enemy.x + enemy.size / 2 - 14));
    const py = Math.max(4, Math.min(W - 32, enemy.y + enemy.size / 2 - 14));
    powerUps.push(new PowerUp(px, py, type));
  }
  updateHUD();
}

function applyPowerUp(powerUp) {
  if (!player || !player.alive) return;

  switch (powerUp.type) {
    case "shield":
      player.shieldTimer = Math.max(player.shieldTimer, 8 * 60);
      break;
    case "speed":
      player.speedTimer = Math.max(player.speedTimer, 10 * 60);
      break;
    case "fire":
      player.fireTimer = Math.max(player.fireTimer, 10 * 60);
      break;
    case "life":
      lives++;
      break;
    case "bomb":
      // 炸弹对当前屏幕所有敌人造成2点伤害
      for (const e of enemies) {
        if (e.alive) e.takeDamage(2, true);
      }
      break;
  }

  updateHUD();
}

// ------------------- 关卡管理 -------------------
function startLevel(n) {
  map = buildMap(LEVELS[n - 1]);
  baseAlive = true;
  bullets = [];
  enemies = [];
  powerUps = [];
  enemySpawnIndex = 0;
  player = new Tank(4 * TILE + 3, 12 * TILE + 3, DIR.UP, true);
  enemiesToSpawn = 4 + n * 2;
  spawnTimer = 0;
  updateHUD();
}

function nextEnemyType() {
  const plan = ENEMY_SPAWN_PLANS[level - 1] || ENEMY_SPAWN_PLANS[0];
  const type = plan[enemySpawnIndex % plan.length] || "normal";
  enemySpawnIndex++;
  return type;
}

function spawnEnemy() {
  if (enemiesToSpawn <= 0) return;
  const spots = [0, 6, 12].map((c) => ({ x: c * TILE + 3, y: 3 }));

  for (let i = 0; i < spots.length; i++) {
    const s = spots[Math.floor(rnd() * spots.length)];
    const r = { x: s.x, y: s.y, w: TILE - 6, h: TILE - 6 };
    const blocked = [player, ...enemies].some((t) => t && t.alive && rectsOverlap(r, t.rect()));
    if (!blocked) {
      const e = new Tank(s.x, s.y, DIR.DOWN, false, nextEnemyType());
      enemies.push(e);
      enemiesToSpawn--;
      return;
    }
  }
}

function killPlayer() {
  lives--;
  player.alive = false;
  if (lives <= 0) {
    endGame(false);
  } else {
    setTimeout(() => {
      if (state === "playing") {
        player = new Tank(4 * TILE + 3, 12 * TILE + 3, DIR.UP, true);
      }
    }, 600);
  }
  updateHUD();
}

function endGame(win) {
  state = win ? "win" : "gameover";
  overlay.classList.remove("hidden");
  if (win) {
    overlayTitle.textContent = "🏆 胜利！";
    overlayText.innerHTML = `你通关了所有关卡！<br>最终得分: <b>${score}</b>`;
  } else {
    overlayTitle.textContent = "💥 游戏结束";
    overlayText.innerHTML = baseAlive
      ? `你的坦克全部被摧毁。<br>得分: <b>${score}</b>`
      : `基地 🦅 被摧毁了！<br>得分: <b>${score}</b>`;
  }
  startBtn.textContent = "再玩一次";
}

function nextLevelOrWin() {
  if (level >= MAX_LEVEL) {
    endGame(true);
  } else {
    state = "levelclear";
    overlay.classList.remove("hidden");
    overlayTitle.textContent = `关卡 ${level} 完成！`;
    overlayText.innerHTML = `准备进入第 ${level + 1} 关...<br>得分: <b>${score}</b>`;
    startBtn.textContent = "下一关";
  }
}

function updateHUD() {
  elLevel.textContent = level;
  elLives.textContent = lives;
  elScore.textContent = score;
  elEnemies.textContent = enemiesToSpawn + enemies.filter((e) => e.alive).length;
}

// ------------------- 主循环 -------------------
function update() {
  if (state !== "playing") return;

  if (player && player.alive) {
    let moved = false;
    if (keys["ArrowUp"]) { player.tryMove(DIR.UP); moved = true; }
    else if (keys["ArrowDown"]) { player.tryMove(DIR.DOWN); moved = true; }
    else if (keys["ArrowLeft"]) { player.tryMove(DIR.LEFT); moved = true; }
    else if (keys["ArrowRight"]) { player.tryMove(DIR.RIGHT); moved = true; }
    if (!moved) player.moving = false;
    if (keys[" "]) player.shoot();
    player.update();
  }

  spawnTimer--;
  const aliveEnemies = enemies.filter((e) => e.alive).length;
  if (spawnTimer <= 0 && enemiesToSpawn > 0 && aliveEnemies < 4) {
    spawnEnemy();
    spawnTimer = 120;
  }

  for (const e of enemies) if (e.alive) e.update();

  for (const b of bullets) if (b.alive) b.update();
  bullets = bullets.filter((b) => b.alive);

  for (const p of powerUps) {
    if (!p.alive) continue;
    p.update();
    if (player && player.alive && rectsOverlap(player.rect(), p.rect())) {
      p.alive = false;
      applyPowerUp(p);
    }
  }
  powerUps = powerUps.filter((p) => p.alive);
  enemies = enemies.filter((e) => e.alive);

  if (!baseAlive) {
    endGame(false);
    return;
  }

  if (enemiesToSpawn === 0 && enemies.length === 0) {
    nextLevelOrWin();
    return;
  }

  updateHUD();
}

// ------------------- 渲染 -------------------
function draw() {
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, W, W);

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const t = map[r][c];
      const x = c * TILE, y = r * TILE;
      if (t === T.BRICK) drawBrick(x, y);
      else if (t === T.STEEL) drawSteel(x, y);
      else if (t === T.BASE) drawBase(x, y);
    }
  }

  for (const p of powerUps) if (p.alive) drawPowerUp(p);
  for (const e of enemies) if (e.alive) drawTank(e, e.color);
  if (player && player.alive) drawTank(player, player.color);

  ctx.fillStyle = "#fff";
  for (const b of bullets) {
    if (b.alive) ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
  }

  drawActiveEffects();
}

function drawBrick(x, y) {
  ctx.fillStyle = "#8B4513";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "#a0522d";
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillRect(x + j * 20 + 2, y + i * 20 + 2, 16, 16);
    }
  }
}

function drawSteel(x, y) {
  ctx.fillStyle = "#888";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "#bbb";
  ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
  ctx.fillStyle = "#666";
  ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
}

function drawBase(x, y) {
  ctx.fillStyle = baseAlive ? "#2c3e50" : "#444";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.font = "28px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(baseAlive ? "🦅" : "💀", x + TILE / 2, y + TILE / 2);
}

function drawTank(tank, color) {
  const { x, y, size } = tank;
  ctx.save();

  // 护盾视觉效果
  if (tank.isPlayer && tank.shieldTimer > 0) {
    ctx.strokeStyle = "#5dade2";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tank.cx, tank.cy, size / 2 + 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);

  ctx.fillStyle = "#333";
  ctx.fillRect(x, y, 5, size);
  ctx.fillRect(x + size - 5, y, 5, size);

  ctx.fillStyle = "#222";
  const cx = x + size / 2, cy = y + size / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 4, 0, Math.PI * 2);
  ctx.fill();

  const v = DIR_VEC[tank.dir];
  const bw = 5;
  ctx.fillRect(
    cx - bw / 2 + v.x * size / 2,
    cy - bw / 2 + v.y * size / 2,
    v.x !== 0 ? size / 2 : bw,
    v.y !== 0 ? size / 2 : bw
  );

  // 敌人类型标记
  if (!tank.isPlayer) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tank.mark, cx, cy);

    // 多血量坦克显示血条
    if (tank.maxHp > 1) {
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(x, y - 5, size, 3);
      ctx.fillStyle = "#2ecc71";
      ctx.fillRect(x, y - 5, size * (tank.hp / tank.maxHp), 3);
    }
  }

  ctx.restore();
}

function drawPowerUp(powerUp) {
  const info = POWERUP_INFO[powerUp.type];
  const pulse = 0.85 + Math.sin(powerUp.lifeTimer / 8) * 0.15;
  const size = powerUp.size * pulse;
  const offset = (powerUp.size - size) / 2;

  ctx.save();
  ctx.fillStyle = info.bg;
  ctx.globalAlpha = powerUp.lifeTimer < 180 ? 0.55 + 0.45 * Math.abs(Math.sin(powerUp.lifeTimer / 8)) : 0.95;
  ctx.fillRect(powerUp.x + offset, powerUp.y + offset, size, size);
  ctx.globalAlpha = 1;
  ctx.font = "19px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(info.icon, powerUp.x + powerUp.size / 2, powerUp.y + powerUp.size / 2 + 1);
  ctx.restore();
}

function drawActiveEffects() {
  if (!player || !player.alive) return;

  const effects = [];
  if (player.shieldTimer > 0) effects.push(`🛡️ ${Math.ceil(player.shieldTimer / 60)}s`);
  if (player.speedTimer > 0) effects.push(`⚡ ${Math.ceil(player.speedTimer / 60)}s`);
  if (player.fireTimer > 0) effects.push(`🔥 ${Math.ceil(player.fireTimer / 60)}s`);
  if (effects.length === 0) return;

  ctx.save();
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const text = effects.join("   ");
  const width = ctx.measureText(text).width + 18;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(6, 6, width, 26);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, 14, 12);
  ctx.restore();
}

// ------------------- 循环驱动 -------------------
function loop(ts) {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ------------------- 输入 -------------------
window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }
  keys[e.key] = true;
  if (e.key === "p" || e.key === "P") togglePause();
});
window.addEventListener("keyup", (e) => { keys[e.key] = false; });

function togglePause() {
  if (state === "playing") {
    state = "paused";
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "⏸ 暂停";
    overlayText.textContent = "按继续或再次按 P 恢复游戏。";
    startBtn.textContent = "继续";
  } else if (state === "paused") {
    state = "playing";
    overlay.classList.add("hidden");
  }
}

// ------------------- 按钮 -------------------
startBtn.addEventListener("click", () => {
  if (state === "menu" || state === "gameover" || state === "win") {
    level = 1;
    lives = 3;
    score = 0;
    startLevel(level);
    state = "playing";
    overlay.classList.add("hidden");
  } else if (state === "levelclear") {
    level++;
    startLevel(level);
    state = "playing";
    overlay.classList.add("hidden");
  } else if (state === "paused") {
    state = "playing";
    overlay.classList.add("hidden");
  }
});

// 启动渲染循环（菜单也会绘制空地图）
map = buildMap(LEVELS[0]);
requestAnimationFrame(loop);
