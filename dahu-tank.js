// 特殊玩家坦克：虎式坦克·大虎 / 同化坦克
// 虎式：Q循环变大/缩小，发射能量炮。
// 同化：同化弹把敌军转成我方队友；友军变成初始界面里的我方坦克；Boss/豹子不能同化。

PLAYER_TANK_CLASSES.dahu = {
  name: "虎式坦克·大虎",
  color: "#f39c38",
  mark: "虎",
  speed: 2.45,
  maxHp: 8,
  damage: 2,
  shotCooldown: 18,
  bulletSpeed: 7.0,
  skillName: "虎形变换",
  skillDesc: "Q循环：正常→巨大→迷你；发射高能炮弹",
  cooldown: 2 * 60,
};

PLAYER_TANK_CLASSES.assimilate = {
  name: "同化坦克",
  color: "#55d6c2",
  mark: "同",
  speed: 2.30,
  maxHp: 7,
  damage: 1,
  shotCooldown: 22,
  bulletSpeed: 6.2,
  skillName: "同化脉冲",
  skillDesc: "炮弹可把敌军变成队友；Q同化最近目标；Boss免疫",
  cooldown: 12 * 60,
};

const DAHU_FORMS = {
  normal: { size: TILE - 6, speed: 2.45, damage: 2, cooldown: 18, label:"正常" },
  giant:  { size: 52,       speed: 1.75, damage: 4, cooldown: 24, label:"巨大" },
  mini:   { size: 24,       speed: 3.35, damage: 1, cooldown: 12, label:"迷你" },
};
const DAHU_FORM_ORDER = ["normal","giant","mini"];

const ASSIMILATE_BLOCKED_TYPES = new Set(["boss6","boss10","leopard"]);
const ASSIMILATE_PLAYER_CLASS_MAP = {
  normal:"normal",
  fast:"fast",
  armor:"armor",
  firepower:"elite",
  elite:"elite",
  fortress:"armor",
  destroyer:"base"
};
const ASSIMILATE_SUICIDE_RANDOM_TYPES = [
  "normal","fast","elite","armor","base","weaken",
  "flight","evolution","omni","dahu","assimilate"
];

let assimilatedAllies = [];
globalThis.getAssimilatedAllies = () => assimilatedAllies;

function dahuCfg(tank){
  return DAHU_FORMS[tank?.dahuForm] || DAHU_FORMS.normal;
}

function applyDahuForm(tank, form, silent=false){
  if(!tank || tank.playerClass!=="dahu") return false;
  const next=DAHU_FORMS[form] || DAHU_FORMS.normal;
  const prev={
    form:tank.dahuForm||"normal",size:tank.size,baseSpeed:tank.baseSpeed,
    damage:tank.damage,shotCooldown:tank.shotCooldown,x:tank.x,y:tank.y
  };
  const cx=tank.cx, cy=tank.cy;
  tank.dahuForm=form;
  tank.size=next.size;
  tank.x=cx-next.size/2;
  tank.y=cy-next.size/2;
  tank.baseSpeed=next.speed;
  tank.damage=next.damage;
  tank.shotCooldown=next.cooldown;

  // 放大后若压进墙或其他单位，取消本次变化。
  if(typeof tank.collides==="function" && tank.collides(tank.x,tank.y)){
    tank.dahuForm=prev.form;
    tank.size=prev.size;
    tank.baseSpeed=prev.baseSpeed;
    tank.damage=prev.damage;
    tank.shotCooldown=prev.shotCooldown;
    tank.x=prev.x;
    tank.y=prev.y;
    return false;
  }
  tank.skillActiveTimer=35;
  if(!silent && typeof updateHUD==="function") updateHUD();
  return true;
}

const createPlayerBeforeSpecialTanks=createPlayerAtSpawn;
createPlayerAtSpawn=function(){
  const t=createPlayerBeforeSpecialTanks();
  if(t?.playerClass==="dahu") applyDahuForm(t,"normal",true);
  return t;
};

function isAssimilationBlocked(enemy){
  if(!enemy || !enemy.alive || enemy.isPlayer) return true;
  if(ASSIMILATE_BLOCKED_TYPES.has(enemy.type)) return true;
  if(String(enemy.type||"").startsWith("boss")) return true;
  if(enemy.bossConfigured || enemy.bossId) return true;
  return false;
}

function playerClassForAssimilatedEnemy(enemyType){
  return ASSIMILATE_PLAYER_CLASS_MAP[enemyType] || "normal";
}

function randomInitialFriendlyTankClass(){
  const pool=ASSIMILATE_SUICIDE_RANDOM_TYPES.filter(type=>PLAYER_TANK_CLASSES[type]);
  return pool[Math.floor(rnd()*pool.length)] || "normal";
}

function configureAssimilatedAllyAsPlayerTank(tank,classType){
  const cfg=PLAYER_TANK_CLASSES[classType] || PLAYER_TANK_CLASSES.normal;
  tank.type="ally_"+classType;
  tank.assimilatedPlayerClass=classType;
  tank.size=TILE-6;
  tank.baseSpeed=cfg.speed;
  tank.maxHp=cfg.maxHp;
  tank.hp=cfg.maxHp;
  tank.color=cfg.color;
  tank.fireChance=0;
  tank.shotCooldown=cfg.shotCooldown;
  tank.bulletSpeed=cfg.bulletSpeed;
  tank.damage=cfg.damage||1;
  tank.scoreValue=0;
  tank.dropChance=0;
  tank.mark=cfg.mark||"友";
  tank.cooldown=10;
  tank.aiTimer=0;

  // 清掉原敌军/自爆/削弱状态，避免同化后继续执行敌方特殊逻辑。
  tank.weakenOriginalBaseSpeed=null;
  tank.weakenedByPlayer=false;
  tank.suicideExploded=false;
  tank.suicideHitFlash=0;
  tank.bossConfigured=false;
  tank.bossShielded=false;
  tank.bossStunned=false;
  tank.isFlying=false;
  tank.flightTimer=0;
  tank.evolvedTimer=0;

  // 虎式友军按初始界面的正常形态出现，不继承玩家当前巨大/迷你状态。
  if(classType==="dahu"){
    tank.size=DAHU_FORMS.normal.size;
    tank.baseSpeed=DAHU_FORMS.normal.speed;
    tank.damage=DAHU_FORMS.normal.damage;
    tank.shotCooldown=DAHU_FORMS.normal.cooldown;
    tank.dahuForm="normal";
  }else{
    tank.dahuForm=null;
  }
}

function assimilateEnemyToAlly(enemy){
  if(!enemy || !enemy.alive || enemy.isPlayer || enemy.isAssimilated) return false;
  if(isAssimilationBlocked(enemy)) return false;

  const originalType=enemy.type;
  const friendlyClass=originalType==="suicide"
    ? randomInitialFriendlyTankClass()
    : playerClassForAssimilatedEnemy(originalType);

  const idx=enemies.indexOf(enemy);
  if(idx>=0) enemies.splice(idx,1);

  // 同化后改成初始界面里的我方坦克：普通→普通、快速→快速、重甲→重甲；
  // 其他敌军映射到对应我方坦克，自爆坦克则随机变成一辆初始界面坦克。
  configureAssimilatedAllyAsPlayerTank(enemy,friendlyClass);

  enemy.isAssimilated=true;
  enemy.friendlyAlly=true;
  enemy.assimilatedFromSuicide=originalType==="suicide";
  enemy.assimilatedOriginalType=originalType;
  enemy.cooldown=Math.min(enemy.cooldown||0,12);
  enemy.aiTimer=0;
  assimilatedAllies.push(enemy);

  if(typeof updateHUD==="function") updateHUD();
  return true;
}
globalThis.assimilateEnemyToAlly=assimilateEnemyToAlly;

function nearestAssimilatableEnemy(origin,maxDistance=Infinity){
  let best=null,bestD=maxDistance;
  for(const e of enemies){
    if(!e?.alive || isAssimilationBlocked(e)) continue;
    const d=Math.hypot(e.cx-origin.cx,e.cy-origin.cy);
    if(d<bestD){best=e;bestD=d;}
  }
  return best;
}

const activateSkillBeforeSpecialTanks=activatePlayerSkill;
activatePlayerSkill=function(){
  if(state!=="playing" || !player || !player.alive) return;
  const type=player.playerClass;

  if(type==="dahu"){
    if(player.skillCooldown>0) return;
    const current=player.dahuForm||"normal";
    const idx=DAHU_FORM_ORDER.indexOf(current);
    const next=DAHU_FORM_ORDER[(idx+1)%DAHU_FORM_ORDER.length];
    if(applyDahuForm(player,next)){
      player.skillCooldown=PLAYER_TANK_CLASSES.dahu.cooldown;
    }
    return;
  }

  if(type==="assimilate"){
    if(player.skillCooldown>0) return;
    const target=nearestAssimilatableEnemy(player,220);
    if(!target) return;
    if(assimilateEnemyToAlly(target)){
      player.skillCooldown=PLAYER_TANK_CLASSES.assimilate.cooldown;
      player.skillActiveTimer=40;
    }
    return;
  }

  return activateSkillBeforeSpecialTanks();
};

function createTigerEnergyBullet(tank){
  const v=DIR_VEC[tank.dir];
  const bx=tank.cx+v.x*(tank.size/2+5);
  const by=tank.cy+v.y*(tank.size/2+5);
  const bullet=new Bullet(bx,by,tank.dir,true,tank.bulletSpeed||7);
  bullet.damage=tank.damage||2;
  bullet.size=tank.dahuForm==="giant"?12:tank.dahuForm==="mini"?7:9;
  bullet.tigerEnergy=true;
  bullet.dahuForm=tank.dahuForm||"normal";
  bullets.push(bullet);
}

function createAssimilationBullet(tank){
  const v=DIR_VEC[tank.dir];
  const bx=tank.cx+v.x*(tank.size/2+4);
  const by=tank.cy+v.y*(tank.size/2+4);
  const bullet=new Bullet(bx,by,tank.dir,true,tank.bulletSpeed||6.2);
  bullet.damage=tank.damage||1;
  bullet.size=9;
  bullet.assimilationShot=true;
  bullets.push(bullet);
}

const shootBeforeSpecialTanks=Tank.prototype.shoot;
Tank.prototype.shoot=function(){
  if(this.isPlayer && this.playerClass==="dahu"){
    if(this.cooldown>0)return;
    this.cooldown=this.shotCooldown;
    createTigerEnergyBullet(this);
    return;
  }
  if(this.isPlayer && this.playerClass==="assimilate"){
    if(this.cooldown>0)return;
    this.cooldown=this.shotCooldown;
    createAssimilationBullet(this);
    return;
  }
  return shootBeforeSpecialTanks.call(this);
};

function updateSpecialPlayerBullet(b,mode){
  const v=DIR_VEC[b.dir];
  b.x+=v.x*b.speed;
  b.y+=v.y*b.speed;
  if(b.x<0||b.y<0||b.x>W||b.y>W){b.alive=false;return;}

  const c=Math.floor(b.x/TILE), r=Math.floor(b.y/TILE);
  if(r>=0&&r<GRID&&c>=0&&c<GRID){
    const tile=map[r][c];
    if(tile===T.BRICK){map[r][c]=T.EMPTY;b.alive=false;return;}
    // 特殊友军炮弹不会误伤自己的基地。
    if(tile===T.STEEL||tile===T.BASE){b.alive=false;return;}
  }

  const rect={x:b.x-b.size/2,y:b.y-b.size/2,w:b.size,h:b.size};
  for(const enemy of [...enemies]){
    if(!enemy.alive || !rectsOverlap(rect,enemy.rect())) continue;

    if(mode==="assimilate" && !isAssimilationBlocked(enemy)){
      assimilateEnemyToAlly(enemy);
      b.alive=false;
      return;
    }

    // Boss不可同化：同化炮命中Boss时只造成普通伤害。
    enemy.takeDamage(b.damage||1,true);
    b.alive=false;
    return;
  }

  for(const other of bullets){
    if(other===b||!other.alive||other.fromPlayer===b.fromPlayer)continue;
    const ob={x:other.x-other.size/2,y:other.y-other.size/2,w:other.size,h:other.size};
    if(rectsOverlap(rect,ob)){other.alive=false;b.alive=false;return;}
  }
}

function nearestEnemyForAlly(ally){
  let best=null,bestD=Infinity;
  for(const e of enemies){
    if(!e?.alive)continue;
    const d=Math.hypot(e.cx-ally.cx,e.cy-ally.cy);
    if(d<bestD){best=e;bestD=d;}
  }
  return best;
}

function fireAssimilatedAlly(ally,target){
  if(ally.cooldown>0||!target)return;
  const dx=target.cx-ally.cx,dy=target.cy-ally.cy;
  let dir;
  if(Math.abs(dx)>=Math.abs(dy))dir=dx<0?DIR.LEFT:DIR.RIGHT;
  else dir=dy<0?DIR.UP:DIR.DOWN;
  ally.dir=dir;
  const v=DIR_VEC[dir];
  const bullet=new Bullet(
    ally.cx+v.x*(ally.size/2),
    ally.cy+v.y*(ally.size/2),
    dir,true,ally.bulletSpeed||5
  );
  bullet.damage=Math.max(1,ally.damage||ENEMY_TYPES[ally.type]?.damage||1);
  bullet.friendlyAllyShot=true;
  bullets.push(bullet);
  ally.cooldown=Math.max(10,ally.shotCooldown||30);
}

function updateFriendlyAllyBullet(b){
  const v=DIR_VEC[b.dir];
  b.x+=v.x*b.speed;
  b.y+=v.y*b.speed;
  if(b.x<0||b.y<0||b.x>W||b.y>W){b.alive=false;return;}

  const c=Math.floor(b.x/TILE),r=Math.floor(b.y/TILE);
  if(r>=0&&r<GRID&&c>=0&&c<GRID){
    const tile=map[r][c];
    if(tile===T.BRICK){map[r][c]=T.EMPTY;b.alive=false;return;}
    if(tile===T.STEEL||tile===T.BASE){b.alive=false;return;}
  }

  const rect={x:b.x-b.size/2,y:b.y-b.size/2,w:b.size,h:b.size};
  for(const e of enemies){
    if(!e?.alive||!rectsOverlap(rect,e.rect()))continue;
    e.takeDamage(b.damage||1,true);
    b.alive=false;
    return;
  }

  for(const other of bullets){
    if(other===b||!other.alive||other.fromPlayer===b.fromPlayer)continue;
    const ob={x:other.x-other.size/2,y:other.y-other.size/2,w:other.size,h:other.size};
    if(rectsOverlap(rect,ob)){other.alive=false;b.alive=false;return;}
  }
}

function damageFriendlyAllyFromEnemyBullet(b){
  if(!b.alive || b.fromPlayer) return;
  const rect={x:b.x-b.size/2,y:b.y-b.size/2,w:b.size,h:b.size};
  for(const ally of assimilatedAllies){
    if(!ally?.alive || !rectsOverlap(rect,ally.rect())) continue;
    ally.hp=Math.max(0,(ally.hp||1)-1);
    if(ally.hp<=0) ally.alive=false;
    b.alive=false;
    return;
  }
}

const bulletUpdateBeforeSpecialTanks=Bullet.prototype.update;
Bullet.prototype.update=function(){
  if(this.tigerEnergy) return updateSpecialPlayerBullet(this,"energy");
  if(this.assimilationShot) return updateSpecialPlayerBullet(this,"assimilate");
  if(this.friendlyAllyShot) return updateFriendlyAllyBullet(this);

  const wasEnemy=!this.fromPlayer;
  bulletUpdateBeforeSpecialTanks.call(this);
  if(wasEnemy && this.alive) damageFriendlyAllyFromEnemyBullet(this);
};

function updateAssimilatedAllies(){
  for(const ally of assimilatedAllies){
    if(!ally?.alive)continue;
    if(ally.cooldown>0)ally.cooldown--;

    const target=nearestEnemyForAlly(ally);
    if(!target){ally.moving=false;continue;}

    const dx=target.cx-ally.cx,dy=target.cy-ally.cy;
    const dist=Math.hypot(dx,dy);

    if(dist>72){
      const primary=Math.abs(dx)>=Math.abs(dy)
        ? (dx<0?DIR.LEFT:DIR.RIGHT)
        : (dy<0?DIR.UP:DIR.DOWN);
      const secondary=Math.abs(dx)>=Math.abs(dy)
        ? (dy<0?DIR.UP:DIR.DOWN)
        : (dx<0?DIR.LEFT:DIR.RIGHT);
      ally.tryMove(primary,0.72);
      if(!ally.moving) ally.tryMove(secondary,0.62);
    }else{
      ally.moving=false;
    }

    if(dist<280 || Math.abs(dx)<32 || Math.abs(dy)<32){
      fireAssimilatedAlly(ally,target);
    }
  }
  assimilatedAllies=assimilatedAllies.filter(a=>a&&a.alive);
}

const updateBeforeSpecialTanks=update;
update=function(){
  updateBeforeSpecialTanks();
  if(state==="playing")updateAssimilatedAllies();
};

const startLevelBeforeSpecialTanks=startLevel;
startLevel=function(n){
  assimilatedAllies=[];
  startLevelBeforeSpecialTanks(n);
  if(player?.playerClass==="dahu")applyDahuForm(player,"normal",true);
};

function drawSpecialTankExtras(){
  for(const ally of assimilatedAllies){
    if(!ally?.alive)continue;
    // 同化后显示成玩家在初始界面选中的坦克，只加绿色友军光圈。
    drawTank(ally,ally.color);
    ctx.save();
    ctx.strokeStyle="#52f1a9";
    ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(ally.cx,ally.cy,ally.size/2+5,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="#bfffe3";
    ctx.font="bold 9px sans-serif";
    ctx.textAlign="center";
    const allyName=PLAYER_TANK_CLASSES[ally.assimilatedPlayerClass]?.name||"友军坦克";
    ctx.fillText("队友·"+allyName,ally.cx,ally.y-5);
    ctx.restore();
  }

  if(player?.alive&&player.playerClass==="dahu"){
    const f=dahuCfg(player);
    ctx.save();
    ctx.strokeStyle="#ffb13b";ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(player.cx,player.cy,player.size/2+6,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="#ffe0a1";ctx.font="bold 10px sans-serif";ctx.textAlign="center";
    ctx.fillText("虎式·"+f.label,player.cx,player.y-7);
    ctx.restore();
  }

  if(player?.alive&&player.playerClass==="assimilate"){
    ctx.save();
    ctx.strokeStyle="#55f2d5";ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(player.cx,player.cy,player.size/2+6,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="#c9fff5";ctx.font="bold 10px sans-serif";ctx.textAlign="center";
    ctx.fillText("同化坦克",player.cx,player.y-7);
    ctx.restore();
  }

  for(const b of bullets){
    if(!b.alive||(!b.tigerEnergy&&!b.assimilationShot))continue;
    ctx.save();
    ctx.shadowBlur=12;
    ctx.shadowColor=b.assimilationShot?"#55f2d5":"#63efff";
    ctx.fillStyle=b.assimilationShot?"#a8ffec":"#9ff7ff";
    ctx.beginPath();ctx.arc(b.x,b.y,Math.max(5,b.size*.7),0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}

const drawBeforeSpecialTanks=draw;
draw=function(){
  drawBeforeSpecialTanks();
  drawSpecialTankExtras();
};
