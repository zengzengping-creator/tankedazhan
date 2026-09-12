// 立体视觉加强：坦克、人物头部、建筑门面统一增加体积和光影。

function drawIsoBox(ctx2, x, y, w, h, depth, front, top, side) {
  ctx2.save();
  ctx2.fillStyle = front;
  ctx2.fillRect(x, y, w, h);

  ctx2.fillStyle = top;
  ctx2.beginPath();
  ctx2.moveTo(x, y);
  ctx2.lineTo(x + depth, y - depth);
  ctx2.lineTo(x + w + depth, y - depth);
  ctx2.lineTo(x + w, y);
  ctx2.closePath();
  ctx2.fill();

  ctx2.fillStyle = side;
  ctx2.beginPath();
  ctx2.moveTo(x + w, y);
  ctx2.lineTo(x + w + depth, y - depth);
  ctx2.lineTo(x + w + depth, y + h - depth);
  ctx2.lineTo(x + w, y + h);
  ctx2.closePath();
  ctx2.fill();
  ctx2.restore();
}

if (typeof drawIslandWorldBuilding === "function") {
  const drawIslandWorldBuildingBeforeFull3D = drawIslandWorldBuilding;
  drawIslandWorldBuilding = function (ctx2, b) {
    // 先画原有场景，再叠加门、立体墙体和招牌。
    drawIslandWorldBuildingBeforeFull3D(ctx2, b);

    if (b.id === "wheel" || b.id === "soccer") return;

    const x = b.x - b.w / 2;
    const y = b.y - b.h / 2;
    const d = b.id === "tower" ? 15 : 10;

    ctx2.save();
    ctx2.globalAlpha = .96;
    drawIsoBox(
      ctx2, x, y, b.w, b.h, d,
      b.color || "#666",
      "rgba(255,255,255,.28)",
      "rgba(0,0,0,.30)"
    );

    // 立体门
    const doorW = Math.max(16, Math.min(26, b.w * .28));
    const doorH = Math.max(20, Math.min(36, b.h * .48));
    const doorX = b.x - doorW / 2;
    const doorY = y + b.h - doorH;
    ctx2.fillStyle = "#26323a";
    ctx2.fillRect(doorX, doorY, doorW, doorH);
    ctx2.fillStyle = "#506977";
    ctx2.fillRect(doorX + 3, doorY + 3, doorW - 6, doorH - 5);
    ctx2.fillStyle = "#ffd66b";
    ctx2.beginPath();
    ctx2.arc(doorX + doorW - 5, doorY + doorH/2, 2, 0, Math.PI*2);
    ctx2.fill();

    // 坦克大楼加高层与窗户
    if (b.id === "tower") {
      for (let floor = 0; floor < 3; floor++) {
        const fy = y + 10 + floor * 14;
        ctx2.fillStyle = "#9ed5ff";
        ctx2.fillRect(x + 10, fy, 16, 7);
        ctx2.fillRect(x + b.w - 26, fy, 16, 7);
      }
      ctx2.fillStyle = "#ecf5ff";
      ctx2.font = "bold 9px sans-serif";
      ctx2.textAlign = "center";
      ctx2.fillText("TRAINING", b.x, y + 12);
    }
    ctx2.restore();
  };
}

if (typeof drawIslandHuman3D === "function") {
  const drawIslandHumanBeforeFull3D = drawIslandHuman3D;
  drawIslandHuman3D = function (ctx2, h) {
    drawIslandHumanBeforeFull3D(ctx2, h);

    const clothes = typeof activeIslandClothes === "function" ? activeIslandClothes() : { color:"#56c271" };
    const y = h.y - h.z;
    ctx2.save();

    // 立体头：后侧阴影 + 正面高光
    const grad = ctx2.createRadialGradient(h.x - 2, y - 15, 1, h.x, y - 13, 7);
    grad.addColorStop(0, "#ffe0bd");
    grad.addColorStop(.65, "#e7b188");
    grad.addColorStop(1, "#9e6e52");
    ctx2.fillStyle = grad;
    ctx2.beginPath();
    ctx2.arc(h.x, y - 13, 6.5, 0, Math.PI*2);
    ctx2.fill();

    // 立体身体侧面
    ctx2.fillStyle = clothes.color;
    ctx2.fillRect(h.x - 7, y - 7, 13, 16);
    ctx2.fillStyle = "rgba(0,0,0,.28)";
    ctx2.beginPath();
    ctx2.moveTo(h.x + 6, y - 7);
    ctx2.lineTo(h.x + 10, y - 11);
    ctx2.lineTo(h.x + 10, y + 5);
    ctx2.lineTo(h.x + 6, y + 9);
    ctx2.closePath();
    ctx2.fill();

    ctx2.fillStyle = "rgba(255,255,255,.22)";
    ctx2.beginPath();
    ctx2.moveTo(h.x - 7, y - 7);
    ctx2.lineTo(h.x - 3, y - 11);
    ctx2.lineTo(h.x + 10, y - 11);
    ctx2.lineTo(h.x + 6, y - 7);
    ctx2.closePath();
    ctx2.fill();

    ctx2.restore();
  };
}

// 主战斗坦克再次加强体积：炮塔、履带、车体都带立体面。
const drawTankBeforeFull3D = drawTank;
drawTank = function (tank, color) {
  drawTankBeforeFull3D(tank, color);
  if (!tank || !tank.alive) return;

  const flyingLift = tank.isFlying ? 68 : 0;
  const x = tank.x;
  const y = tank.y - flyingLift;
  const s = tank.size;
  const body = color || tank.color || "#999";

  ctx.save();
  // 右侧装甲面
  ctx.fillStyle = "rgba(0,0,0,.30)";
  ctx.beginPath();
  ctx.moveTo(x + s, y + 3);
  ctx.lineTo(x + s + 7, y - 4);
  ctx.lineTo(x + s + 7, y + s - 6);
  ctx.lineTo(x + s, y + s);
  ctx.closePath();
  ctx.fill();

  // 顶甲
  ctx.fillStyle = body;
  ctx.globalAlpha = .88;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + 3);
  ctx.lineTo(x + 10, y - 5);
  ctx.lineTo(x + s + 7, y - 5);
  ctx.lineTo(x + s, y + 3);
  ctx.closePath();
  ctx.fill();

  // 立体炮塔
  const cx = x + s/2, cy = y + s/2;
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#2b3136";
  ctx.beginPath();
  ctx.arc(cx + 2, cy - 2, s/4 + 2, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.beginPath();
  ctx.arc(cx - 2, cy - 5, s/6, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
};
