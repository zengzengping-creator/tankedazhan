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

// ------------------- 游戏状态 -------------------
let state = "menu"; // menu | playing | paused | levelclear | gameover | win
let level = 1;
let lives = 3;
let score = 0;
let map = []; // GRID x GRID 二维数组
let player = null;
let enemies = [];
let bullets = [];
let enemiesToSpawn = 0;
let spawnTimer = 0;
let baseAlive = true;
let keys = {};
let lastTime = 0;

const MAX_LEVEL = 3;

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
  constructor(x, y, dir, isPlayer) {
    this.x = x; // 像素左上角
    this.y = y;
    this.dir = dir;
    this.isPlayer = isPlayer;
    this.size = TILE - 6;
    this.speed = isPlayer ? 2.2 : 1.3;
    this.cooldown = 0;
    this.alive = true;
    this.moving = false;
    // 敌人 AI
    this.aiTimer = 0;
    this.aiDir = dir;
  }

  get cx() { return this.x + this.size / 2; }
  get cy() { return this.y + this.size / 2; }

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
    // 边界
    if (nx < 0 || ny < 0 || nx + this.size > W || ny + this.size > W) return true;
    // 地图瓦片
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
    // 与其它坦克
    const all = [player, ...enemies].filter((t) => t && t !== this && t.alive);
    const me = { x: nx, y: ny, w: this.size, h: this.size };
    for (const o of all) {
      if (rectsOverlap(me, o.rect())) return true;
    }
    return false;
  }

  shoot() {
    if (this.cooldown > 0) return;
    this.cooldown = this.isPlayer ? 22 : 55;
    const v = DIR_VEC[this.dir];
    const bx = this.cx + v.x * (this.size / 2);
    const by = this.cy + v.y * (this.size / 2);
    bullets.push(new Bullet(bx, by, this.dir, this.isPlayer));
  }

  update() {
    if (this.cooldown > 0) this.cooldown--;
    if (!this.isPlayer) this.aiUpdate();
  }

  aiUpdate() {
    this.aiTimer--;
    if (this.aiTimer <= 0) {
      // 随机选方向，略偏向下/向基地
      const choices = [DIR.DOWN, DIR.DOWN, DIR.LEFT, DIR.RIGHT, DIR.UP];
      this.aiDir = choices[Math.floor(rnd() * choices.length)];
      this.aiTimer = 30 + Math.floor(rnd() * 60);
    }
    this.tryMove(this.aiDir);
    if (!this.moving) this.aiTimer = 0; // 撞墙立刻换方向
    // 随机开火
    if (rnd() < 0.02) this.shoot();
  }
}

// ------------------- 子弹类 -------------------
class Bullet {
  constructor(x, y, dir, fromPlayer) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.fromPlayer = fromPlayer;
    this.speed = 5;
    this.size = 6;
    this.alive = true;
  }

  update() {
    const v = DIR_VEC[this.dir];
    this.x += v.x * this.speed;
    this.y += v.y * this.speed;

    // 出界
    if (this.x < 0 || this.y < 0 || this.x > W || this.y > W) {
      this.alive = false;
      return;
    }

    // 撞墙
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

    // 撞坦克
    const b = { x: this.x - this.size / 2, y: this.y - this.size / 2, w: this.size, h: this.size };
    if (this.fromPlayer) {
      for (const e of enemies) {
        if (e.alive && rectsOverlap(b, e.rect())) {
          e.alive = false;
          this.alive = false;
          score += 100;
          return;
        }
      }
    } else {
      if (player && player.alive && rectsOverlap(b, player.rect())) {
        this.alive = false;
        killPlayer();
        return;
      }
    }

    // 子弹互相抵消
    for (const o of bullets) {
      if (o !== this && o.alive && o.fromPlayer !== this.fromPlayer) {
        const ob = { x: o.x - o.size / 2, y: o.y - o.size / 2, w: o.size, h: o.size };
        if (rectsOverlap(b, ob)) {
          o.alive = false;
          this.alive = false;
          return;
        }
      }
    }
  }
}

// ------------------- 工具函数 -------------------
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// 轻量级伪随机（避免依赖，不影响玩法）
let seed = 12345;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

// ------------------- 关卡管理 -------------------
function startLevel(n) {
  map = buildMap(LEVELS[n - 1]);
  baseAlive = true;
  bullets = [];
  enemies = [];
  // 玩家出生在基地旁边
  player = new Tank(4 * TILE + 3, 12 * TILE + 3, DIR.UP, true);
  enemiesToSpawn = 4 + n * 2; // 第1关6个，递增
  spawnTimer = 0;
  updateHUD();
}

function spawnEnemy() {
  if (enemiesToSpawn <= 0) return;
  const spots = [0, 6, 12].map((c) => ({ x: c * TILE + 3, y: 3 }));
  // 选一个没被占据的出生点
  for (let i = 0; i < spots.length; i++) {
    const s = spots[Math.floor(rnd() * spots.length)];
    const r = { x: s.x, y: s.y, w: TILE - 6, h: TILE - 6 };
    const blocked = [player, ...enemies].some((t) => t && t.alive && rectsOverlap(r, t.rect()));
    if (!blocked) {
      const e = new Tank(s.x, s.y, DIR.DOWN, false);
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
    // 重生
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

  // 玩家输入
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

  // 敌人生成
  spawnTimer--;
  const aliveEnemies = enemies.filter((e) => e.alive).length;
  if (spawnTimer <= 0 && enemiesToSpawn > 0 && aliveEnemies < 4) {
    spawnEnemy();
    spawnTimer = 120;
  }

  // 敌人更新
  for (const e of enemies) if (e.alive) e.update();
  enemies = enemies.filter((e) => e.alive);

  // 子弹更新
  for (const b of bullets) if (b.alive) b.update();
  bullets = bullets.filter((b) => b.alive);

  // 失败：基地被毁
  if (!baseAlive) {
    endGame(false);
    return;
  }

  // 胜利：所有敌人消灭
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

  // 瓦片
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const t = map[r][c];
      const x = c * TILE, y = r * TILE;
      if (t === T.BRICK) drawBrick(x, y);
      else if (t === T.STEEL) drawSteel(x, y);
      else if (t === T.BASE) drawBase(x, y);
    }
  }

  // 坦克
  for (const e of enemies) if (e.alive) drawTank(e, "#e74c3c");
  if (player && player.alive) drawTank(player, "#f1c40f");

  // 子弹
  ctx.fillStyle = "#fff";
  for (const b of bullets) {
    if (b.alive) ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
  }
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
  // 车身
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  // 履带
  ctx.fillStyle = "#333";
  ctx.fillRect(x, y, 5, size);
  ctx.fillRect(x + size - 5, y, 5, size);
  // 炮塔
  ctx.fillStyle = "#222";
  const cx = x + size / 2, cy = y + size / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 4, 0, Math.PI * 2);
  ctx.fill();
  // 炮管
  ctx.fillStyle = "#222";
  const v = DIR_VEC[tank.dir];
  const bw = 5;
  ctx.fillRect(cx - bw / 2 + v.x * size / 2, cy - bw / 2 + v.y * size / 2,
    v.x !== 0 ? size / 2 : bw, v.y !== 0 ? size / 2 : bw);
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
