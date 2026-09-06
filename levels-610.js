// 第6-10关与BOSS关扩展
// 第6关BOSS：10滴血
// 第10关最终BOSS：20滴血

const EXTENDED_MAX_LEVEL_10 = 10;

// ------------------- BOSS类型 -------------------
ENEMY_TYPES.boss6 = {
  name: "第六关BOSS",
  color: "#f39c12",
  speed: 1.10,
  hp: 10,
  fireChance: 0.065,
  shotCooldown: 24,
  bulletSpeed: 6.4,
  score: 1200,
  dropChance: 1.00,
  damage: 1,
  mark: "王",
};

ENEMY_TYPES.boss10 = {
  name: "最终BOSS",
  color: "#8e44ad",
  speed: 1.35,
  hp: 20,
  fireChance: 0.090,
  shotCooldown: 14,
  bulletSpeed: 7.5,
  score: 3000,
  dropChance: 1.00,
  damage: 2,
  mark: "终",
};

// ------------------- 第6-10关地图 -------------------
LEVELS.push(
  [
    ".............",
    ".S.........S.",
    ".B.BB...BB.B.",
    "...B..S..B...",
    "BB...BBB...BB",
    "..S.......S..",
    ".B...BBB...B.",
    "..S.......S..",
    "BB...BBB...BB",
    "...B.....B...",
    ".BB.BBBBB.BB.",
    "....BBEBB....",
    "....B.E.B....",
  ],
  [
    ".............",
    ".BB.S...S.BB.",
    "..B.BB.BB.B..",
    "S....B.B....S",
    ".BBB.....BBB.",
    "...S.B.B.S...",
    "BB...S.S...BB",
    "...S.B.B.S...",
    ".BBB.....BBB.",
    "S....B.B....S",
    ".BB.BBBBB.BB.",
    "....BBEBB....",
    "....B.E.B....",
  ],
  [
    ".............",
    ".S.BB...BB.S.",
    ".B..S.B.S..B.",
    "BB.B.....B.BB",
    "..S.BBB.B.S..",
    ".B...S.S...B.",
    "S.BB.....BB.S",
    ".B...S.S...B.",
    "..S.BBB.B.S..",
    "BB.B.....B.BB",
    ".BB.BBBBB.BB.",
    "....BBEBB....",
    "....B.E.B....",
  ],
  [
    ".............",
    ".S..B.S.B..S.",
    "BB.BB...BB.BB",
    "...S.B.B.S...",
    ".B.BB.S.BB.B.",
    "S...B...B...S",
    ".BB...S...BB.",
    "S...B...B...S",
    ".B.BB.S.BB.B.",
    "...S.B.B.S...",
    ".BB.BBBBB.BB.",
    "....BBEBB....",
    "....B.E.B....",
  ],
  [
    ".............",
    ".S.........S.",
    ".BB.S...S.BB.",
    "...B.B.B.B...",
    "S.B..BBB..B.S",
    ".B.S.....S.B.",
    "BB...S.S...BB",
    ".B.S.....S.B.",
    "S.B..BBB..B.S",
    "...B.B.B.B...",
    ".BB.BBBBB.BB.",
    "....BBEBB....",
    "....B.E.B....",
  ]
);

// ------------------- 第6-10关敌人编成 -------------------
// 数量与 startLevel 的 4 + level * 2 保持一致。
// BOSS都安排在该关编队最后出现。
ENEMY_SPAWN_PLANS.push(
  // 第6关：16辆，最后是10血BOSS
  [
    "armor", "firepower", "elite", "fortress",
    "destroyer", "fast", "fortress", "elite",
    "armor", "destroyer", "firepower", "fortress",
    "elite", "destroyer", "fortress", "boss6",
  ],
  // 第7关：18辆
  [
    "fortress", "destroyer", "elite", "armor", "firepower", "fast",
    "destroyer", "fortress", "elite", "armor", "destroyer", "firepower",
    "fortress", "elite", "destroyer", "armor", "fortress", "destroyer",
  ],
  // 第8关：20辆
  [
    "destroyer", "fortress", "elite", "destroyer", "armor",
    "firepower", "fortress", "destroyer", "elite", "fortress",
    "destroyer", "armor", "elite", "firepower", "fortress",
    "destroyer", "elite", "fortress", "destroyer", "armor",
  ],
  // 第9关：22辆
  [
    "fortress", "destroyer", "elite", "destroyer", "fortress", "firepower",
    "destroyer", "elite", "armor", "fortress", "destroyer", "elite",
    "fortress", "destroyer", "firepower", "elite", "destroyer", "fortress",
    "armor", "destroyer", "elite", "fortress",
  ],
  // 第10关：24辆，最后是20血最终BOSS
  [
    "destroyer", "fortress", "elite", "destroyer", "armor", "firepower",
    "fortress", "destroyer", "elite", "destroyer", "fortress", "elite",
    "destroyer", "armor", "fortress", "destroyer", "elite", "firepower",
    "destroyer", "fortress", "elite", "destroyer", "fortress", "boss10",
  ]
);

// ------------------- BOSS视觉强化 -------------------
const drawTankBeforeBossVisual = drawTank;
drawTank = function (tank, color) {
  drawTankBeforeBossVisual(tank, color);

  if (!tank || !tank.alive || (tank.type !== "boss6" && tank.type !== "boss10")) return;

  ctx.save();
  ctx.strokeStyle = tank.type === "boss10" ? "#ff00ff" : "#ffd700";
  ctx.lineWidth = 3;
  ctx.strokeRect(tank.x - 3, tank.y - 3, tank.size + 6, tank.size + 6);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(
    tank.type === "boss10" ? "FINAL BOSS" : "BOSS",
    tank.cx,
    tank.y - 7
  );
  ctx.restore();
};

// ------------------- 扩展通关逻辑到10关 -------------------
nextLevelOrWin = function () {
  if (level >= EXTENDED_MAX_LEVEL_10) {
    endGame(true);
    return;
  }

  state = "levelclear";
  overlay.classList.remove("hidden");
  overlayTitle.textContent = `关卡 ${level} 完成！`;

  const nextLevel = level + 1;
  let warning = "";
  if (nextLevel === 6) warning = "<br><b>⚠️ 下一关：10滴血 BOSS！</b>";
  if (nextLevel === 10) warning = "<br><b>⚠️ 下一关：20滴血 最终BOSS！</b>";

  overlayText.innerHTML = `准备进入第 ${nextLevel} 关...${warning}<br>得分: <b>${score}</b>`;
  startBtn.textContent = "下一关";
};
