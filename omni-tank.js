// 全能坦克：集合现有五个我方角色的能力
// 普通护盾 + 快速冲刺 + 精英火力 + 重甲回血 + 基地维修

PLAYER_TANK_CLASSES.omni = {
  name: "全能坦克",
  color: "#ff8c00",
  mark: "全",
  speed: 3.0,
  maxHp: 10,
  baseMaxHp: 5,
  damage: 2,
  shotCooldown: 15,
  bulletSpeed: 6.4,
  skillName: "五能合一",
  skillDesc: "同时发动五种坦克技能",
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
  player.skillActiveTimer = 5 * 60;

  // 普通坦克：4秒无敌护盾
  player.shieldTimer = Math.max(player.shieldTimer || 0, 4 * 60);

  // 快速坦克：3秒极速冲刺（基础速度提升70%）
  player.omniSpeedTimer = 3 * 60;
  player.baseSpeed = cfg.speed * 1.7;

  // 精英坦克：5秒高速连射
  player.fireTimer = Math.max(player.fireTimer || 0, 5 * 60);

  // 重甲坦克：自己恢复2滴，最多10滴
  player.hp = Math.min(cfg.maxHp, player.hp + 2);
  lives = player.hp;

  // 基地坦克：基地恢复2滴，最多5滴
  baseHP = Math.min(cfg.baseMaxHp, baseHP + 2);
  if (baseHP > 0) baseAlive = true;

  updateHUD();
};

// 冲刺3秒结束后恢复全能坦克正常速度。
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
