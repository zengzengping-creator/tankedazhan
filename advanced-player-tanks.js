// 新增我方角色：飞行坦克 / 进化坦克，并让全能坦克继承两者能力。
const FLIGHT_DURATION = 20 * 60;
const EVOLUTION_DURATION = 20 * 60;
const FLIGHT_ALTITUDE = TILE * 3;

PLAYER_TANK_CLASSES.flight = {
  name: "飞行坦克",
  color: "#5bc0eb",
  mark: "飞",
  speed: 2.65,
  maxHp: 6,
  damage: 2,
  shotCooldown: 18,
  bulletSpeed: 6.6,
  skillName: "高空飞行",
  skillDesc: "升空3格，20秒无视地面障碍",
  cooldown: 20 * 60,
};

PLAYER_TANK_CLASSES.evolution = {
  name: "进化坦克",
  color: "#63d471",
  mark: "进",
  speed: 2.45,
  maxHp: 7,
  damage: 2,
  shotCooldown: 18,
  bulletSpeed: 6.1,
  skillName: "能力进化",
  skillDesc: "双人进化队友；单人进化自己并强化连击",
  cooldown: 22 * 60,
};

if (PLAYER_TANK_CLASSES.omni) {
  PLAYER_TANK_CLASSES.omni.skillName = "八能合一";
  PLAYER_TANK_CLASSES.omni.skillDesc = "原六能+飞行+进化，持续20秒";
}

function applyEvolutionToTank(target, duration = EVOLUTION_DURATION) {
  if (!target || !target.alive) return;
  if (target.evolutionOriginalSpeed == null) target.evolutionOriginalSpeed = target.baseSpeed;
  if (target.evolutionOriginalDamage == null) target.evolutionOriginalDamage = target.damage || 1;
  if (target.evolutionOriginalCooldown == null) target.evolutionOriginalCooldown = target.shotCooldown || 20;

  target.evolvedTimer = Math.max(target.evolvedTimer || 0, duration);
  target.baseSpeed = target.evolutionOriginalSpeed * 1.35;
  target.damage = Math.max(target.evolutionOriginalDamage + 2, Math.ceil(target.evolutionOriginalDamage * 1.5));
  target.shotCooldown = Math.max(7, Math.floor(target.evolutionOriginalCooldown * 0.62));
  target.fireTimer = Math.max(target.fireTimer || 0, duration);
  target.evolutionCombo = 0;
  target.evolutionComboMax = 8;
}

function restoreEvolutionTank(target) {
  if (!target) return;
  if (target.evolutionOriginalSpeed != null) target.baseSpeed = target.evolutionOriginalSpeed;
  if (target.evolutionOriginalDamage != null) target.damage = target.evolutionOriginalDamage;
  if (target.evolutionOriginalCooldown != null) target.shotCooldown = target.evolutionOriginalCooldown;
  target.evolutionOriginalSpeed = null;
  target.evolutionOriginalDamage = null;
  target.evolutionOriginalCooldown = null;
  target.evolutionCombo = 0;
}

function getEvolutionTeammate() {
  // 双人模式接口：后续只要第二名玩家实例暴露为 player2，即可直接进化队友。
  const teammate = globalThis.player2;
  return teammate && teammate.alive ? teammate : null;
}

function startFlightForTank(tank, duration = FLIGHT_DURATION) {
  if (!tank || !tank.alive) return;
  tank.flightTimer = Math.max(tank.flightTimer || 0, duration);
  tank.flightAltitude = FLIGHT_ALTITUDE;
  tank.isFlying = true;
}

const activatePlayerSkillBeforeAdvancedTanks = activatePlayerSkill;
activatePlayerSkill = function () {
  if (state !== "playing" || !player || !player.alive) return;

  const type = player.playerClass;
  const cfg = PLAYER_TANK_CLASSES[type] || PLAYER_TANK_CLASSES.normal;

  if (type === "flight") {
    if (player.skillCooldown > 0) return;
    player.skillCooldown = cfg.cooldown;
    player.skillActiveTimer = FLIGHT_DURATION;
    startFlightForTank(player, FLIGHT_DURATION);
    return;
  }

  if (type === "evolution") {
    if (player.skillCooldown > 0) return;
    player.skillCooldown = cfg.cooldown;
    player.skillActiveTimer = EVOLUTION_DURATION;

    const teammate = getEvolutionTeammate();
    // 双人时进化队友；单人时进化自己。
    applyEvolutionToTank(teammate || player, EVOLUTION_DURATION);
    return;
  }

  if (type === "omni") {
    const beforeCooldown = player.skillCooldown || 0;
    activatePlayerSkillBeforeAdvancedTanks();
    // 只有原全能技能成功发动后，再补上飞行和进化。
    if ((player.skillCooldown || 0) > beforeCooldown) {
      startFlightForTank(player, 20 * 60);
      const teammate = getEvolutionTeammate();
      applyEvolutionToTank(teammate || player, 20 * 60);
      player.skillActiveTimer = Math.max(player.skillActiveTimer || 0, 20 * 60);
    }
    return;
  }

  return activatePlayerSkillBeforeAdvancedTanks();
};

// 飞行时忽略地图障碍物，只保留边界限制；同时可以从地面坦克上方飞过。
const tankCollidesBeforeFlight = Tank.prototype.collides;
Tank.prototype.collides = function (nx, ny) {
  if (this.isPlayer && this.isFlying && this.flightTimer > 0) {
    if (nx < 0 || ny < 0 || nx + this.size > W || ny + this.size > W) return true;
    return false;
  }
  return tankCollidesBeforeFlight.call(this, nx, ny);
};

// 技能计时恢复。
const tankUpdateBeforeAdvancedTanks = Tank.prototype.update;
Tank.prototype.update = function () {
  tankUpdateBeforeAdvancedTanks.call(this);
  if (!this.isPlayer) return;

  if (this.flightTimer > 0) {
    this.flightTimer--;
    this.isFlying = true;
    this.flightAltitude = FLIGHT_ALTITUDE;
    if (this.flightTimer <= 0) {
      this.flightTimer = 0;
      this.flightAltitude = 0;
      this.isFlying = false;
    }
  }

  if (this.evolvedTimer > 0) {
    this.evolvedTimer--;
    if (this.evolvedTimer <= 0) restoreEvolutionTank(this);
  }
};

// 进化连击：进化状态下每次发炮增加连击，伤害逐步提高，最高8连击。
const shootBeforeEvolutionCombo = Tank.prototype.shoot;
Tank.prototype.shoot = function () {
  const before = bullets.length;
  shootBeforeEvolutionCombo.call(this);

  if (!this.isPlayer || (this.evolvedTimer || 0) <= 0) return;
  if (bullets.length <= before) return;

  this.evolutionCombo = Math.min(this.evolutionComboMax || 8, (this.evolutionCombo || 0) + 1);
  const comboBonus = Math.floor(this.evolutionCombo / 2);

  for (let i = before; i < bullets.length; i++) {
    bullets[i].damage = Math.max(bullets[i].damage || 1, (this.damage || 1) + comboBonus);
    bullets[i].evolutionCombo = this.evolutionCombo;
  }
};

// 飞行与进化的立体视觉。
const drawTankBeforeAdvancedTanks = drawTank;
drawTank = function (tank, color) {
  if (!tank || !tank.alive) return drawTankBeforeAdvancedTanks(tank, color);

  const flying = tank.isPlayer && tank.isFlying && tank.flightTimer > 0;
  if (!flying) {
    drawTankBeforeAdvancedTanks(tank, color);
  } else {
    // 主体向上投影，地面只留影子。
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath();
    ctx.ellipse(tank.cx + 5, tank.cy + 10, tank.size * .55, 8, 0, 0, Math.PI*2);
    ctx.fill();

    const lift = Math.min(72, (tank.flightAltitude || FLIGHT_ALTITUDE) * 0.55);
    ctx.translate(0, -lift);
    drawTankBeforeAdvancedTanks(tank, color);

    // 机翼
    ctx.fillStyle = "#d9f6ff";
    ctx.globalAlpha = .9;
    ctx.beginPath();
    ctx.moveTo(tank.x - 10, tank.cy);
    ctx.lineTo(tank.x + 5, tank.cy - 8);
    ctx.lineTo(tank.x + 5, tank.cy + 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tank.x + tank.size + 10, tank.cy);
    ctx.lineTo(tank.x + tank.size - 5, tank.cy - 8);
    ctx.lineTo(tank.x + tank.size - 5, tank.cy + 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (tank.isPlayer && (tank.evolvedTimer || 0) > 0) {
    ctx.save();
    ctx.strokeStyle = "#70ff86";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tank.cx, tank.cy - (flying ? 70 : 0), tank.size/2 + 8, 0, Math.PI*2);
    ctx.stroke();
    ctx.fillStyle = "#d8ffe0";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`进化 ${tank.evolutionCombo || 0}连`, tank.cx, tank.y - (flying ? 82 : 8));
    ctx.restore();
  }
};
