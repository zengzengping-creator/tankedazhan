// 玩家坦克选择与技能系统
// 当前免费开放：普通 / 快速 / 精英。未来可接金币购买系统。

const PLAYER_TANK_CLASSES = {
  normal: {
    name: "普通坦克",
    color: "#f1c40f",
    mark: "普",
    speed: 2.2,
    shotCooldown: 22,
    bulletSpeed: 5.0,
    skillName: "钢铁护盾",
    skillDesc: "4秒无敌",
    cooldown: 15 * 60,
  },
  fast: {
    name: "快速坦克",
    color: "#3498db",
    mark: "快",
    speed: 3.0,
    shotCooldown: 20,
    bulletSpeed: 5.6,
    skillName: "极速冲刺",
    skillDesc: "3秒移动速度大幅提升",
    cooldown: 12 * 60,
  },
  elite: {
    name: "精英坦克",
    color: "#9b59b6",
    mark: "精",
    speed: 2.5,
    shotCooldown: 16,
    bulletSpeed: 6.4,
    skillName: "火力爆发",
    skillDesc: "5秒高速连射",
    cooldown: 18 * 60,
  },
};

let selectedPlayerTank = "normal";

const elTankSelect = document.getElementById("tank-select");
const elPlayerTankName = document.getElementById("player-tank-name");
const elSkillStatus = document.getElementById("skill-status");
const tankChoiceButtons = Array.from(document.querySelectorAll(".tank-choice"));

function getSelectedPlayerConfig() {
  return PLAYER_TANK_CLASSES[selectedPlayerTank] || PLAYER_TANK_CLASSES.normal;
}

function applyPlayerClass(tank) {
  if (!tank) return tank;

  const cfg = getSelectedPlayerConfig();
  tank.playerClass = selectedPlayerTank;
  tank.color = cfg.color;
  tank.baseSpeed = cfg.speed;
  tank.shotCooldown = cfg.shotCooldown;
  tank.bulletSpeed = cfg.bulletSpeed;
  tank.skillCooldown = 0;
  tank.skillActiveTimer = 0;

  // 保留之前约定的玩家5滴血。
  tank.maxHp = typeof PLAYER_MAX_HP !== "undefined" ? PLAYER_MAX_HP : 5;
  tank.hp = tank.maxHp;
  lives = tank.hp;

  return tank;
}

// 接在血量系统后面创建玩家，确保每关都使用当前选择的坦克。
const createPlayerAtSpawnBeforeClasses = createPlayerAtSpawn;
createPlayerAtSpawn = function () {
  return applyPlayerClass(createPlayerAtSpawnBeforeClasses());
};

function selectPlayerTank(type) {
  if (!PLAYER_TANK_CLASSES[type]) return;
  selectedPlayerTank = type;

  for (const btn of tankChoiceButtons) {
    btn.classList.toggle("selected", btn.dataset.playerTank === type);
  }

  if (elPlayerTankName) elPlayerTankName.textContent = PLAYER_TANK_CLASSES[type].name;
}

for (const btn of tankChoiceButtons) {
  btn.addEventListener("click", () => selectPlayerTank(btn.dataset.playerTank));
}
selectPlayerTank("normal");

function activatePlayerSkill() {
  if (state !== "playing" || !player || !player.alive) return;
  if (player.skillCooldown > 0) return;

  const cfg = PLAYER_TANK_CLASSES[player.playerClass] || PLAYER_TANK_CLASSES.normal;
  player.skillCooldown = cfg.cooldown;

  if (player.playerClass === "normal") {
    // 普通坦克：4秒无敌护盾。
    player.shieldTimer = Math.max(player.shieldTimer || 0, 4 * 60);
    player.skillActiveTimer = 4 * 60;
  } else if (player.playerClass === "fast") {
    // 快速坦克：3秒极速冲刺。基础速度提升70%。
    player.skillActiveTimer = 3 * 60;
    player.baseSpeed = cfg.speed * 1.7;
  } else if (player.playerClass === "elite") {
    // 精英坦克：复用现有火力强化机制，5秒高速连射。
    player.fireTimer = Math.max(player.fireTimer || 0, 5 * 60);
    player.skillActiveTimer = 5 * 60;
  }
}

window.addEventListener("keydown", (e) => {
  if ((e.key === "q" || e.key === "Q") && !e.repeat) {
    e.preventDefault();
    activatePlayerSkill();
  }
});

// 技能冷却与快速坦克冲刺恢复。
const tankUpdateBeforePlayerSkills = Tank.prototype.update;
Tank.prototype.update = function () {
  tankUpdateBeforePlayerSkills.call(this);

  if (!this.isPlayer) return;

  if (this.skillCooldown > 0) this.skillCooldown--;
  if (this.skillActiveTimer > 0) {
    this.skillActiveTimer--;

    if (this.skillActiveTimer <= 0 && this.playerClass === "fast") {
      const cfg = PLAYER_TANK_CLASSES.fast;
      this.baseSpeed = cfg.speed;
    }
  }
};

// 玩家坦克显示自己的类型标记。
const drawTankBeforePlayerClasses = drawTank;
drawTank = function (tank, color) {
  drawTankBeforePlayerClasses(tank, color);

  if (!tank || !tank.alive || !tank.isPlayer || !tank.playerClass) return;
  const cfg = PLAYER_TANK_CLASSES[tank.playerClass] || PLAYER_TANK_CLASSES.normal;

  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(cfg.mark, tank.cx, tank.cy);
  ctx.restore();
};

function syncPlayerClassUI() {
  if (elTankSelect) {
    const show = state === "menu" || state === "gameover" || state === "win";
    elTankSelect.style.display = show ? "flex" : "none";
  }

  const cfg = player && player.playerClass
    ? (PLAYER_TANK_CLASSES[player.playerClass] || getSelectedPlayerConfig())
    : getSelectedPlayerConfig();

  if (elPlayerTankName) elPlayerTankName.textContent = cfg.name;

  if (elSkillStatus) {
    if (!player || !player.alive) {
      elSkillStatus.textContent = `Q ${cfg.skillName}`;
    } else if (player.skillActiveTimer > 0) {
      elSkillStatus.textContent = `${cfg.skillName} 生效中`;
    } else if (player.skillCooldown > 0) {
      elSkillStatus.textContent = `${Math.ceil(player.skillCooldown / 60)}秒`;
    } else {
      elSkillStatus.textContent = `Q 可用`;
    }
  }

  requestAnimationFrame(syncPlayerClassUI);
}
requestAnimationFrame(syncPlayerClassUI);
