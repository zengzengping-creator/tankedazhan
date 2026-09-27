// 创造系坦克：大虎
// 能力：Q切换正常/巨大/迷你形态；能量炮可同化普通敌军，被同化坦克成为友军。

PLAYER_TANK_CLASSES.dahu = {
  name: "大虎",
  color: "#f39c38",
  mark: "虎",
  speed: 2.45,
  maxHp: 8,
  damage: 2,
  shotCooldown: 18,
  bulletSpeed: 7.0,
  skillName: "虎形变换",
  skillDesc: "Q循环：正常→巨大→迷你；能量炮同化敌军",
  cooldown: 2 * 60,
};

const DAHU_FORMS = {
  normal: { size: TILE - 6, speed: 2.45, damage: 2, cooldown: 18, label:"正常" },
  giant:  { size: 52,       speed: 1.75, damage: 4, cooldown: 24, label:"巨大" },
  mini:   { size: 24,       speed: 3.35, damage: 1, cooldown: 12, label:"迷你" },
};
const DAHU_FORM_ORDER = ["normal","giant","mini"];
const DAHU_ASSIMILATE_BLOCKED = new Set(["boss6","boss10","suicide"]);
let dahuAllies = [];

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

  // 放大后若压进墙或其他单位，就取消这次变化。
  if(typeof tank.collides==="function" && tank.collides(tank.x,tank.y)){
    tank.dahuForm=prev.form;tank.size=prev.size;tank.baseSpeed=prev.baseSpeed;
    tank.damage=prev.damage;tank.shotCooldown=prev.shotCooldown;tank.x=prev.x;tank.y=prev.y;
    return false;
  }
  tank.skillActiveTimer=35;
  if(!silent && typeof updateHUD==="function") updateHUD();
  return true;
}

const createPlayerBeforeDahu=createPlayerAtSpawn;
createPlayerAtSpawn=function(){
  const t=createPlayerBeforeDahu();
  if(t?.playerClass==="dahu") applyDahuForm(t,"normal",true);
  return t;
};

const activateSkillBeforeDahu=activatePlayerSkill;
activatePlayerSkill=function(){
  if(!player || player.playerClass!=="dahu") return activateSkillBeforeDahu();
  if(state!=="playing" || !player.alive || player.skillCooldown>0) return;
  const current=player.dahuForm||"normal";
  const idx=DAHU_FORM_ORDER.indexOf(current);
  const next=DAHU_FORM_ORDER[(idx+1)%DAHU_FORM_ORDER.length];
  if(applyDahuForm(player,next)){
    player.skillCooldown=PLAYER_TANK_CLASSES.dahu.cooldown;
  }
};

function createDahuEnergyBullet(tank){
  const v=DIR_VEC[tank.dir];
  const bx=tank.cx+v.x*(tank.size/2+5);
  const by=tank.cy+v.y*(tank.size/2+5);
  const bullet=new Bullet(bx,by,tank.dir,true,tank.bulletSpeed||7);
  bullet.damage=tank.damage||2;
  bullet.size=tank.dahuForm==="giant"?12:tank.dahuForm==="mini"?7:9;
  bullet.dahuEnergy=true;
  bullet.dahuForm=tank.dahuForm||"normal";
  bullets.push(bullet);
}

const shootBeforeDahu=Tank.prototype.shoot;
Tank.prototype.shoot=function(){
  if(this.isPlayer && this.playerClass==="dahu"){
    if(this.cooldown>0)return;
    this.cooldown=this.shotCooldown;
    createDahuEnergyBullet(this);
    return;
  }
  return shootBeforeDahu.call(this);
};

function assimilateEnemyByDahu(enemy){
  if(!enemy || !enemy.alive || enemy.isPlayer || enemy.isAssimilated) return false;
  if(DAHU_ASSIMILATE_BLOCKED.has(enemy.type)) return false;

  const idx=enemies.indexOf(enemy);
  if(idx>=0) enemies.splice(idx,1);
  enemy.isAssimilated=true;
  enemy.assimilatedByDahu=true;
  enemy.mark="同";
  enemy.cooldown=20;
  enemy.aiTimer=0;
  // 保留被同化前的类型/速度/血量/颜色。
  dahuAllies.push(enemy);
  score+=(enemy.scoreValue||0);
  if(typeof updateHUD==="function") updateHUD();
  return true;
}

function updateDahuEnergyBullet(b){
  const v=DIR_VEC[b.dir];
  b.x+=v.x*b.speed;
  b.y+=v.y*b.speed;
  if(b.x<0||b.y<0||b.x>W||b.y>W){b.alive=false;return;}

  const c=Math.floor(b.x/TILE), r=Math.floor(b.y/TILE);
  if(r>=0&&r<GRID&&c>=0&&c<GRID){
    const tile=map[r][c];
    if(tile===T.BRICK){map[r][c]=T.EMPTY;b.alive=false;return;}
    if(tile===T.STEEL||tile===T.BASE){b.alive=false;return;}
  }

  const rect={x:b.x-b.size/2,y:b.y-b.size/2,w:b.size,h:b.size};
  for(const enemy of enemies){
    if(!enemy.alive || !rectsOverlap(rect,enemy.rect())) continue;
    if(assimilateEnemyByDahu(enemy)){
      b.alive=false;
      return;
    }
    // BOSS/自爆坦克不能被同化，能量炮按普通伤害处理。
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

const bulletUpdateBeforeDahu=Bullet.prototype.update;
Bullet.prototype.update=function(){
  if(this.dahuEnergy)return updateDahuEnergyBullet(this);
  return bulletUpdateBeforeDahu.call(this);
};

function nearestEnemyForDahuAlly(ally){
  let best=null,bestD=Infinity;
  for(const e of enemies){
    if(!e?.alive)continue;
    const d=Math.hypot(e.cx-ally.cx,e.cy-ally.cy);
    if(d<bestD){best=e;bestD=d;}
  }
  return best;
}

function fireDahuAlly(ally,target){
  if(ally.cooldown>0||!target)return;
  const dx=target.cx-ally.cx,dy=target.cy-ally.cy;
  let dir;
  if(Math.abs(dx)>=Math.abs(dy))dir=dx<0?DIR.LEFT:DIR.RIGHT;
  else dir=dy<0?DIR.UP:DIR.DOWN;
  ally.dir=dir;
  const v=DIR_VEC[dir];
  const bullet=new Bullet(ally.cx+v.x*(ally.size/2),ally.cy+v.y*(ally.size/2),dir,true,ally.bulletSpeed||5);
  bullet.damage=Math.max(1,ally.damage||ENEMY_TYPES[ally.type]?.damage||1);
  bullet.dahuAllyShot=true;
  bullets.push(bullet);
  ally.cooldown=Math.max(16,ally.shotCooldown||30);
}

function updateDahuAllies(){
  for(const ally of dahuAllies){
    if(!ally.alive)continue;
    if(ally.cooldown>0)ally.cooldown--;
    const target=nearestEnemyForDahuAlly(ally);
    if(!target){ally.moving=false;continue;}
    const dx=target.cx-ally.cx,dy=target.cy-ally.cy;
    const dist=Math.hypot(dx,dy);
    if(dist>75){
      const dir=Math.abs(dx)>Math.abs(dy)?(dx<0?DIR.LEFT:DIR.RIGHT):(dy<0?DIR.UP:DIR.DOWN);
      ally.tryMove(dir,0.72);
    }else{
      ally.moving=false;
    }
    if(dist<260 || Math.abs(dx)<28 || Math.abs(dy)<28) fireDahuAlly(ally,target);
  }
  dahuAllies=dahuAllies.filter(a=>a&&a.alive);
}

const updateBeforeDahu=update;
update=function(){
  updateBeforeDahu();
  if(state==="playing")updateDahuAllies();
};

const startLevelBeforeDahu=startLevel;
startLevel=function(n){
  dahuAllies=[];
  startLevelBeforeDahu(n);
  if(player?.playerClass==="dahu")applyDahuForm(player,"normal",true);
};

function drawDahuExtras(){
  for(const ally of dahuAllies){
    if(!ally?.alive)continue;
    drawTank(ally,ally.color);
    ctx.save();
    ctx.strokeStyle="#53f3ff";
    ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(ally.cx,ally.cy,ally.size/2+5,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="#bdfaff";ctx.font="bold 9px sans-serif";ctx.textAlign="center";
    ctx.fillText("同化友军",ally.cx,ally.y-5);
    ctx.restore();
  }

  if(player?.alive&&player.playerClass==="dahu"){
    const f=dahuCfg(player);
    ctx.save();
    ctx.strokeStyle="#ffb13b";ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(player.cx,player.cy,player.size/2+6,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="#ffe0a1";ctx.font="bold 10px sans-serif";ctx.textAlign="center";
    ctx.fillText("大虎·"+f.label,player.cx,player.y-7);
    ctx.restore();
  }

  for(const b of bullets){
    if(!b.alive||!b.dahuEnergy)continue;
    ctx.save();
    ctx.shadowBlur=12;ctx.shadowColor="#63efff";
    ctx.fillStyle="#9ff7ff";
    ctx.beginPath();ctx.arc(b.x,b.y,Math.max(5,b.size*.7),0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}

const drawBeforeDahu=draw;
draw=function(){
  drawBeforeDahu();
  drawDahuExtras();
};
