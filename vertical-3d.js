// 立体视野 + 双层障碍物 + 高射炮弹
// 空格：平射（攻击下层）；Shift + 空格：高射（攻击上层）。
// 砖墙默认2层。打掉下层时，上层自动坠落补到底层；高射可直接先打掉上层。

let obstacleHeights3D = [];
const BLOCK_3D_DEPTH = 11;

function initObstacleHeights3D() {
  obstacleHeights3D = Array.from({ length: GRID }, (_, r) =>
    Array.from({ length: GRID }, (_, c) => {
      const t = map?.[r]?.[c];
      if (t === T.BRICK || t === T.STEEL) return 2;
      if (t === T.BASE) return 1;
      return 0;
    })
  );
}

function getObstacleHeight3D(r, c) {
  if (!obstacleHeights3D[r]) return 0;
  return obstacleHeights3D[r][c] || 0;
}

function setObstacleHeight3D(r, c, h) {
  if (!obstacleHeights3D[r]) return;
  obstacleHeights3D[r][c] = Math.max(0, h);
  if (h <= 0 && map[r][c] !== T.BASE) map[r][c] = T.EMPTY;
}

initObstacleHeights3D();

const startLevelBefore3DStacks = startLevel;
startLevel = function (n) {
  startLevelBefore3DStacks(n);
  initObstacleHeights3D();
};

// ------------------- 射击高度 -------------------
// 保留所有现有射击限制、伤害和削弱逻辑，只给新生成的炮弹增加高度属性。
const tankShootBefore3DStacks = Tank.prototype.shoot;
Tank.prototype.shoot = function () {
  const before = bullets.length;
  tankShootBefore3DStacks.call(this);

  for (let i = before; i < bullets.length; i++) {
    const bullet = bullets[i];
    if (!bullet) continue;
    bullet.highShot = !!(this.isPlayer && keys["Shift"]);
    bullet.height3D = bullet.highShot ? 1 : 0;
    bullet.visualZ = bullet.highShot ? 25 : 5;
  }
};

function damageBrickLayer3D(r, c, highShot) {
  const h = getObstacleHeight3D(r, c);
  if (h <= 0) return false;

  // 高射只攻击“第二层”。如果只剩一层，炮弹从上方飞过去。
  if (highShot) {
    if (h < 2) return false;
    setObstacleHeight3D(r, c, h - 1);
    return true;
  }

  // 平射攻击最下面一层。
  // 两层时：底层被打掉后，上层立即掉下来，因此仍剩1层。
  setObstacleHeight3D(r, c, h - 1);
  return true;
}

function bulletRect3D(bullet) {
  return {
    x: bullet.x - bullet.size / 2,
    y: bullet.y - bullet.size / 2,
    w: bullet.size,
    h: bullet.size,
  };
}

// 最终子弹逻辑：兼容伤害值、基地血量、我方子弹穿基地、双层障碍和高射。
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
    const highShot = !!this.highShot;

    if (t === T.BRICK) {
      const hit = damageBrickLayer3D(r, c, highShot);
      if (hit) {
        this.alive = false;
        return;
      }
    } else if (t === T.STEEL) {
      // 钢墙也有2层立体外观，但保持不可摧毁。
      // 高射在还有上层时撞上上层；平射撞下层。
      const h = getObstacleHeight3D(r, c);
      if ((!highShot && h > 0) || (highShot && h >= 2)) {
        this.alive = false;
        return;
      }
    } else if (t === T.BASE && !highShot) {
      // 我方平射仍然穿过自己的基地。
      if (!this.fromPlayer) {
        const damage = Math.max(1, this.damage || 1);
        baseHP = Math.max(0, baseHP - damage);
        if (baseHP <= 0) {
          baseAlive = false;
          map[r][c] = T.EMPTY;
        } else {
          baseAlive = true;
          map[r][c] = T.BASE;
        }
        this.alive = false;
        updateHUD();
        return;
      }
    }
  }

  // 高射炮弹从坦克上方飞过，只用于攻击上层障碍。
  if (!this.highShot) {
    const b = bulletRect3D(this);

    if (this.fromPlayer) {
      for (const e of enemies) {
        if (e.alive && rectsOverlap(b, e.rect())) {
          e.takeDamage(this.damage || 1, true);
          this.alive = false;
          return;
        }
      }
    } else if (player && player.alive && !player.isFlying && rectsOverlap(b, player.rect())) {
      this.alive = false;
      if ((player.shieldTimer || 0) <= 0) killPlayer(this.damage || 1);
      return;
    }

    for (const o of bullets) {
      if (o === this || !o.alive || o.fromPlayer === this.fromPlayer || o.highShot) continue;
      if (rectsOverlap(b, bulletRect3D(o))) {
        o.alive = false;
        this.alive = false;
        return;
      }
    }
  }
};

// ------------------- 主战场伪3D渲染 -------------------
function drawPrismFace3D(x, y, size, depth, topColor, sideColor) {
  ctx.fillStyle = sideColor;
  ctx.beginPath();
  ctx.moveTo(x + size, y);
  ctx.lineTo(x + size + depth, y - depth);
  ctx.lineTo(x + size + depth, y + size - depth);
  ctx.lineTo(x + size, y + size);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + depth, y - depth);
  ctx.lineTo(x + size + depth, y - depth);
  ctx.lineTo(x + size, y);
  ctx.closePath();
  ctx.fill();
}

const drawBrickFlatBefore3D = drawBrick;
drawBrick = function (x, y) {
  const c = Math.floor(x / TILE);
  const r = Math.floor(y / TILE);
  const h = Math.max(1, getObstacleHeight3D(r, c));

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.fillRect(x + 7, y + 8, TILE, TILE);

  for (let layer = 0; layer < h; layer++) {
    const lift = layer * 17;
    const yy = y - lift;
    ctx.fillStyle = layer === 0 ? "#8B4513" : "#a95627";
    ctx.fillRect(x, yy, TILE, TILE);
    drawPrismFace3D(x, yy, TILE, BLOCK_3D_DEPTH, "#c47742", "#6e351c");

    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 3, yy + 3, TILE - 6, TILE - 6);
    ctx.beginPath();
    ctx.moveTo(x + TILE/2, yy + 3);
    ctx.lineTo(x + TILE/2, yy + TILE - 3);
    ctx.moveTo(x + 3, yy + TILE/2);
    ctx.lineTo(x + TILE - 3, yy + TILE/2);
    ctx.stroke();
  }

  if (h >= 2) {
    ctx.fillStyle = "#ffe27a";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("2层", x + 3, y - 20);
  }
  ctx.restore();
};

const drawSteelFlatBefore3D = drawSteel;
drawSteel = function (x, y) {
  const c = Math.floor(x / TILE);
  const r = Math.floor(y / TILE);
  const h = Math.max(1, getObstacleHeight3D(r, c));

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.30)";
  ctx.fillRect(x + 7, y + 8, TILE, TILE);

  for (let layer = 0; layer < h; layer++) {
    const yy = y - layer * 17;
    ctx.fillStyle = "#7f8c8d";
    ctx.fillRect(x, yy, TILE, TILE);
    drawPrismFace3D(x, yy, TILE, BLOCK_3D_DEPTH, "#d0d5d8", "#626b70");
    ctx.fillStyle = "#596267";
    ctx.fillRect(x + 8, yy + 8, TILE - 16, TILE - 16);
  }
  ctx.restore();
};

const drawBaseFlatBefore3D = drawBase;
drawBase = function (x, y) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.32)";
  ctx.fillRect(x + 8, y + 9, TILE, TILE);
  ctx.fillStyle = baseAlive ? "#334d62" : "#444";
  ctx.fillRect(x, y, TILE, TILE);
  drawPrismFace3D(x, y, TILE, 10, baseAlive ? "#557b95" : "#666", "#223746");
  ctx.font = "26px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(baseAlive ? "🦅" : "💀", x + TILE/2 + 4, y + TILE/2 - 3);
  ctx.restore();
};

// 保留现有角色标记/BOSS特效链，再额外增加坦克车体立体顶面与阴影。
const drawTankBefore3DVisual = drawTank;
drawTank = function (tank, color) {
  drawTankBefore3DVisual(tank, color);
  if (!tank || !tank.alive) return;

  const { x, y, size } = tank;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.23)";
  ctx.beginPath();
  ctx.ellipse(tank.cx + 6, tank.cy + size/2 - 1, size * .52, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // 顶装甲板，形成明显高度感。
  ctx.fillStyle = color || tank.color || "#999";
  ctx.globalAlpha = .92;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 3);
  ctx.lineTo(x + 10, y - 5);
  ctx.lineTo(x + size - 3, y - 5);
  ctx.lineTo(x + size - 8, y + 3);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,.34)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
};

// 在原有画面之后叠加高射炮弹的高度轨迹、操作提示和透视地面线。
const drawBefore3DOverlay = draw;
draw = function () {
  drawBefore3DOverlay();

  ctx.save();

  // 地面透视参考线，让战场从纯平面变成有纵深感。
  ctx.strokeStyle = "rgba(120,190,210,.055)";
  ctx.lineWidth = 1;
  for (let y = 40; y < W; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y - 28);
    ctx.stroke();
  }

  for (const b of bullets) {
    if (!b.alive || !b.highShot) continue;
    const z = 22;
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 3, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffd84a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + 3, b.y - z);
    ctx.stroke();

    ctx.fillStyle = "#fff3a6";
    ctx.beginPath();
    ctx.arc(b.x + 3, b.y - z, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state === "playing") {
    ctx.fillStyle = "rgba(0,0,0,.66)";
    ctx.fillRect(W - 185, W - 42, 178, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("空格：平射（下层）", W - 177, W - 36);
    ctx.fillStyle = "#ffe27a";
    ctx.fillText("Shift + 空格：高射（上层）", W - 177, W - 21);
  }

  ctx.restore();
};

// ------------------- 坦克岛立体化 -------------------
if (typeof drawIslandWorldBuilding === "function") {
  const drawIslandWorldBuildingBefore3D = drawIslandWorldBuilding;
  drawIslandWorldBuilding = function (ctx2, b) {
    drawIslandWorldBuildingBefore3D(ctx2, b);

    // 建筑向右上方挤出立体侧面和屋顶。
    const d = 8;
    if (b.id !== "wheel") {
      ctx2.save();
      ctx2.fillStyle = "rgba(20,20,35,.36)";
      ctx2.beginPath();
      ctx2.moveTo(b.x + b.w/2, b.y - b.h/2);
      ctx2.lineTo(b.x + b.w/2 + d, b.y - b.h/2 - d);
      ctx2.lineTo(b.x + b.w/2 + d, b.y + b.h/2 - d);
      ctx2.lineTo(b.x + b.w/2, b.y + b.h/2);
      ctx2.closePath();
      ctx2.fill();

      ctx2.fillStyle = "rgba(255,255,255,.20)";
      ctx2.beginPath();
      ctx2.moveTo(b.x - b.w/2, b.y - b.h/2);
      ctx2.lineTo(b.x - b.w/2 + d, b.y - b.h/2 - d);
      ctx2.lineTo(b.x + b.w/2 + d, b.y - b.h/2 - d);
      ctx2.lineTo(b.x + b.w/2, b.y - b.h/2);
      ctx2.closePath();
      ctx2.fill();
      ctx2.restore();
    }
  };
}

if (typeof drawIslandWorldTank === "function") {
  const drawIslandWorldTankBefore3D = drawIslandWorldTank;
  drawIslandWorldTank = function (ctx2, p) {
    drawIslandWorldTankBefore3D(ctx2, p);
    const cfg = PLAYER_TANK_CLASSES[islandWorldTankType] || PLAYER_TANK_CLASSES.normal;
    const yy = p.y - p.z;
    ctx2.save();
    ctx2.fillStyle = cfg.color || "#ffd23f";
    ctx2.globalAlpha = .9;
    ctx2.beginPath();
    ctx2.moveTo(p.x - 13, yy - 13);
    ctx2.lineTo(p.x - 7, yy - 20);
    ctx2.lineTo(p.x + 15, yy - 20);
    ctx2.lineTo(p.x + 13, yy - 13);
    ctx2.closePath();
    ctx2.fill();
    ctx2.restore();
  };
}
