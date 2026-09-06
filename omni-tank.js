// 全能坦克：集合现有五个我方角色的能力
// 普通护盾 + 快速冲刺 + 精英火力 + 重甲回血 + 基地维修

PLAYER_TANK_CLASSES.omni = {
  name: "全能坦克",
  color: "#ff8c00",
  mark: "全",
  speed: 3.0,
  maxHp: 10,
  baseMaxHp: 5,
  damage: 5,
  shotCooldown: 15,
  bulletSpeed: 6.4,
  skillName: "五能合一",
  skillDesc: "五种能力同时发动10秒",
  cooldown: 18 * 60,
};

// 全能坦克的Q技能同时发动五个角色的技能效果。
const activatePlayerSkillBeforeOmni = activatePlayerSkill;
activatePlayerSkill = function () {
  if (!player || player.playerClass !== "omni") {
    return activatePlayerSkillBeforeOmni();
  }

  if (state !== "playing" || !player.alive || player.skillCooldown > 0) return;

  const cfg = PLAYER_TANK_CLASSES.omni;
  player.skillCooldown = cfg.cooldown;
  player.skillActiveTimer = 10 * 60;

  // 普通坦克能力：10秒无敌护盾。
  player.shieldTimer = Math.max(player.shieldTimer || 0, 10 * 60);

  // 快速坦克能力：10秒极速冲刺，基础速度提升70%。
  player.omniSpeedTimer = 10 * 60;
  player.baseSpeed = cfg.speed * 1.7;

  // 精英坦克能力：10秒高速连射。
  player.fireTimer = Math.max(player.fireTimer || 0, 10 * 60);

  // 重甲坦克能力：自己一次直接恢复满血到10滴。
  player.hp = cfg.maxHp;
  lives = player.hp;

  // 基地坦克能力：基地一次直接恢复满血到5滴。
  baseHP = cfg.baseMaxHp;
  baseAlive = true;

  updateHUD();
};

// 全能坦克10秒冲刺结束后恢复正常速度。
const tankUpdateBeforeOmni = Tank.prototype.update;
Tank.prototype.update = function () {
  tankUpdateBeforeOmni.call(this);

  if (!this.isPlayer || this.playerClass !== "omni") return;

  if (this.omniSpeedTimer > 0) {
    this.omniSpeedTimer--;
    if (this.omniSpeedTimer <= 0) {
      this.baseSpeed = PLAYER_TANK_CLASSES.omni.speed;
    }
  }
};
