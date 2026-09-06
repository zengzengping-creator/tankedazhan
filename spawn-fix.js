// 修复敌人出生在墙体中的问题。
// 原逻辑固定使用 0 / 6 / 12 三个出生列，第二关中间第6列正好是钢墙。
// 现在会先检查地图，只有完整坦克区域都是空地时才允许出生。

function enemySpawnAreaHitsMap(x, y) {
  const size = TILE - 6;
  const edge = size - 1;
  const points = [
    [x, y],
    [x + edge, y],
    [x, y + edge],
    [x + edge, y + edge],
  ];

  for (const [px, py] of points) {
    const c = Math.floor(px / TILE);
    const r = Math.floor(py / TILE);
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return true;
    if (map[r][c] !== T.EMPTY) return true;
  }

  return false;
}

function getSafeEnemySpawnSpots() {
  // 各关优先出生列；第二关明确绕开中央钢墙。
  const preferredColumns = {
    1: [0, 6, 12, 2, 10],
    2: [0, 2, 10, 12],
    3: [2, 6, 10],
  };

  const preferred = preferredColumns[level] || [0, 2, 4, 6, 8, 10, 12];
  const orderedColumns = [...preferred];

  // 如果以后地图改动，再自动补充其它可用列，避免再次出现同类问题。
  for (let c = 0; c < GRID; c++) {
    if (!orderedColumns.includes(c)) orderedColumns.push(c);
  }

  return orderedColumns
    .map((c) => ({ x: c * TILE + 3, y: 3 }))
    .filter((s) => {
      if (enemySpawnAreaHitsMap(s.x, s.y)) return false;

      const r = { x: s.x, y: s.y, w: TILE - 6, h: TILE - 6 };
      return ![player, ...enemies].some(
        (t) => t && t.alive && rectsOverlap(r, t.rect())
      );
    });
}

spawnEnemy = function () {
  if (enemiesToSpawn <= 0) return;

  const safeSpots = getSafeEnemySpawnSpots();
  if (safeSpots.length === 0) return;

  const s = safeSpots[Math.floor(rnd() * safeSpots.length)];
  const e = new Tank(s.x, s.y, DIR.DOWN, false, nextEnemyType());
  enemies.push(e);
  enemiesToSpawn--;
};
