// 顶部/右侧大厅HUD：头像、赛季、手册、活动任务、表情动作、盲盒、充值中心。
const META_STORAGE_KEY = "tankBattleMeta_v1";

function metaDefaultData() {
  return {
    seasonXp: 0,
    claimedSeason: {},
    event: { kills: 0, clears: 0, islandVisits: 0, skinDraws: 0 },
    claimedTasks: {},
    selectedEmote: "😀",
    selectedAction: "挥手",
  };
}

function loadMetaData() {
  try {
    const raw = JSON.parse(localStorage.getItem(META_STORAGE_KEY) || "null");
    return Object.assign(metaDefaultData(), raw || {}, {
      event: Object.assign(metaDefaultData().event, raw?.event || {}),
      claimedSeason: raw?.claimedSeason || {},
      claimedTasks: raw?.claimedTasks || {},
    });
  } catch (_) {
    return metaDefaultData();
  }
}

let metaData = loadMetaData();
window.islandSocialState = window.islandSocialState || {
  emote: "",
  emoteUntil: 0,
  action: "",
  actionUntil: 0,
};

function saveMetaData() {
  try { localStorage.setItem(META_STORAGE_KEY, JSON.stringify(metaData)); } catch (_) {}
}

function metaAddCoins(amount) {
  if (typeof islandData === "undefined") return;
  islandData.coins = Math.max(0, (islandData.coins || 0) + amount);
  if (typeof saveIslandData === "function") saveIslandData();
  refreshMetaHud();
  if (typeof renderTankIsland === "function") renderTankIsland();
}

function metaToast(text) {
  let el = document.getElementById("meta-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "meta-toast";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(metaToast.timer);
  metaToast.timer = setTimeout(() => el.classList.remove("show"), 1800);
}

const SEASON_REWARDS = [
  { xp: 100, coins: 100 },
  { xp: 250, coins: 200 },
  { xp: 450, coins: 300 },
  { xp: 700, coins: 500 },
  { xp: 1000, coins: 800 },
];

const EVENT_TASKS = [
  { id: "kills20", label: "击败20辆敌方坦克", key: "kills", target: 20, reward: 120 },
  { id: "clears3", label: "完成3个关卡", key: "clears", target: 3, reward: 180 },
  { id: "island3", label: "进入坦克岛3次", key: "islandVisits", target: 3, reward: 90 },
  { id: "draw3", label: "抽取3次皮肤盲盒", key: "skinDraws", target: 3, reward: 150 },
];

const EMOTES = ["😀","😂","😎","🔥","❤️","👍","🎉","💥","🤝","👑"];
const ACTIONS = ["挥手","跳舞","敬礼","鼓掌","坐下"];

const BLIND_BOXES = [
  { id:"basic", name:"基础迷彩盲盒", icon:"📦", cost:100, rarities:["普通","普通","稀有"] },
  { id:"elite", name:"精英涂装盲盒", icon:"🎁", cost:180, rarities:["稀有","稀有","史诗"] },
  { id:"legend", name:"传说皮肤盲盒", icon:"✨", cost:320, rarities:["史诗","传说","传说"] },
];

function createMetaHud() {
  if (document.getElementById("meta-topbar")) return;

  const top = document.createElement("div");
  top.id = "meta-topbar";
  top.innerHTML = `
    <button class="meta-avatar" data-meta-panel="profile" title="头像">👤</button>
    <div class="meta-coins">🪙 <b id="meta-coins">0</b></div>
    <button data-meta-panel="season">🏆 赛季</button>
    <button data-meta-panel="manual">📘 手册</button>
  `;

  const right = document.createElement("div");
  right.id = "meta-rightbar";
  right.innerHTML = `
    <button data-meta-panel="tasks">📋<span>活动任务</span></button>
    <button data-meta-panel="social">😀<span>表情动作</span></button>
    <button data-meta-panel="boxes">🎁<span>盲盒</span></button>
    <button data-meta-panel="recharge">💎<span>充值</span></button>
  `;

  const modal = document.createElement("div");
  modal.id = "meta-modal";
  modal.className = "hidden";
  modal.innerHTML = `
    <div class="meta-modal-card">
      <div class="meta-modal-head">
        <b id="meta-modal-title">大厅</b>
        <button type="button" id="meta-modal-close">✕</button>
      </div>
      <div id="meta-modal-body"></div>
    </div>
  `;

  const wrap = document.getElementById("canvas-wrap");
  wrap.appendChild(top);
  wrap.appendChild(right);
  wrap.appendChild(modal);

  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-meta-panel]");
    if (!btn) return;
    openMetaPanel(btn.dataset.metaPanel);
  });
  modal.querySelector("#meta-modal-close")?.addEventListener("click", () => modal.classList.add("hidden"));
}

function refreshMetaHud() {
  const el = document.getElementById("meta-coins");
  if (el && typeof islandData !== "undefined") el.textContent = islandData.coins || 0;
}

function openMetaPanel(type) {
  const modal = document.getElementById("meta-modal");
  const title = document.getElementById("meta-modal-title");
  const body = document.getElementById("meta-modal-body");
  if (!modal || !title || !body) return;

  modal.classList.remove("hidden");

  if (type === "profile") renderProfile(title, body);
  else if (type === "season") renderSeason(title, body);
  else if (type === "manual") renderManual(title, body);
  else if (type === "tasks") renderTasks(title, body);
  else if (type === "social") renderSocial(title, body);
  else if (type === "boxes") renderBoxes(title, body);
  else if (type === "recharge") renderRecharge(title, body);
}

function renderProfile(title, body) {
  title.textContent = "👤 我的头像";
  const tankName = PLAYER_TANK_CLASSES[selectedPlayerTank]?.name || "普通坦克";
  body.innerHTML = `
    <div class="meta-profile-card">
      <div class="meta-profile-avatar">👤</div>
      <b>坦克指挥官</b>
      <small>当前坦克：${tankName}</small>
      <small>金币：${islandData?.coins || 0}</small>
      <small>赛季经验：${metaData.seasonXp}</small>
    </div>`;
}

function renderSeason(title, body) {
  title.textContent = "🏆 当前赛季";
  body.innerHTML = `
    <div class="meta-season-banner">
      <b>第1赛季 · 钢铁远征</b>
      <small>战斗、活动和盲盒都能积累赛季经验</small>
      <div class="meta-progress"><i style="width:${Math.min(100, metaData.seasonXp/10)}%"></i></div>
      <span>${metaData.seasonXp} / 1000 XP</span>
    </div>
    <div class="meta-list">
      ${SEASON_REWARDS.map((r,i)=>{
        const claimed=!!metaData.claimedSeason[i];
        const ready=metaData.seasonXp>=r.xp;
        return `<div class="meta-row"><span><b>${r.xp} XP</b><small>奖励 ${r.coins}金币</small></span><button data-season-claim="${i}" ${!ready||claimed?"disabled":""}>${claimed?"已领取":ready?"领取":"未解锁"}</button></div>`;
      }).join("")}
    </div>`;
  body.querySelectorAll("[data-season-claim]").forEach(btn=>{
    btn.onclick=()=>{
      const i=Number(btn.dataset.seasonClaim);
      const r=SEASON_REWARDS[i];
      if(!r||metaData.claimedSeason[i]||metaData.seasonXp<r.xp)return;
      metaData.claimedSeason[i]=true; saveMetaData(); metaAddCoins(r.coins); renderSeason(title,body);
    };
  });
}

function renderManual(title, body) {
  title.textContent = "📘 坦克手册";
  body.innerHTML = `
    <div class="meta-manual-grid">
      <div><b>🎮 战斗</b><small>方向键移动，空格射击，Shift+空格高射，Q技能。</small></div>
      <div><b>🖱️ 3D相机</b><small>左键旋转、滚轮缩放、右键平移、C重置相机。</small></div>
      <div><b>🏝️ 坦克岛</b><small>B下车，靠近坦克空格上车，J跳跃，E互动。</small></div>
      <div><b>🧬 进化</b><small>双人时优先进化队友，单人强化自己并积累连击。</small></div>
      <div><b>✈️ 飞行</b><small>升空3格后无视地面障碍和普通地面炮火。</small></div>
      <div><b>🎁 皮肤</b><small>皮肤可通过不同盲盒获得并永久保存。</small></div>
    </div>`;
}

function renderTasks(title, body) {
  title.textContent = "📋 活动任务";
  body.innerHTML = EVENT_TASKS.map(t=>{
    const value=Math.min(t.target, metaData.event[t.key]||0);
    const done=value>=t.target;
    const claimed=!!metaData.claimedTasks[t.id];
    return `<div class="meta-task">
      <div><b>${t.label}</b><small>${value}/${t.target} · 奖励${t.reward}金币</small></div>
      <div class="meta-progress"><i style="width:${value/t.target*100}%"></i></div>
      <button data-task-claim="${t.id}" ${!done||claimed?"disabled":""}>${claimed?"已领取":done?"领取":"进行中"}</button>
    </div>`;
  }).join("");
  body.querySelectorAll("[data-task-claim]").forEach(btn=>{
    btn.onclick=()=>{
      const t=EVENT_TASKS.find(x=>x.id===btn.dataset.taskClaim);
      if(!t||metaData.claimedTasks[t.id]||(metaData.event[t.key]||0)<t.target)return;
      metaData.claimedTasks[t.id]=true; saveMetaData(); metaAddCoins(t.reward); renderTasks(title,body);
    };
  });
}

function useEmote(emote) {
  window.islandSocialState.emote=emote;
  window.islandSocialState.emoteUntil=performance.now()+3000;
  metaData.selectedEmote=emote; saveMetaData();
  metaToast(`${emote} 表情已使用`);
}

function useAction(action) {
  if (!(typeof islandWorldActive!=="undefined" && islandWorldActive && islandWorldState && !islandWorldState.mounted)) {
    metaToast("动作只能在人下坦克后使用");
    return;
  }
  window.islandSocialState.action=action;
  window.islandSocialState.actionUntil=performance.now()+3500;
  metaData.selectedAction=action; saveMetaData();
  metaToast(`动作：${action}`);
}

function renderSocial(title, body) {
  title.textContent = "😀 表情与动作";
  const humanReady=typeof islandWorldActive!=="undefined" && islandWorldActive && islandWorldState && !islandWorldState.mounted;
  body.innerHTML = `
    <h4>表情 · 人和坦克都可使用</h4>
    <div class="meta-emote-grid">${EMOTES.map(e=>`<button data-emote="${e}">${e}</button>`).join("")}</div>
    <h4>人物动作 · 仅下坦克后可用</h4>
    <div class="meta-action-grid">${ACTIONS.map(a=>`<button data-action="${a}" ${humanReady?"":"disabled"}>${a}</button>`).join("")}</div>
    <small class="meta-note">${humanReady?"当前为步行状态，可以使用动作。":"请先进入坦克岛并按B下坦克。"}</small>
  `;
  body.querySelectorAll("[data-emote]").forEach(btn=>btn.onclick=()=>useEmote(btn.dataset.emote));
  body.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=()=>useAction(btn.dataset.action));
}

function skinPoolForBox(box) {
  const all = typeof ISLAND_SKINS !== "undefined" ? ISLAND_SKINS : [];
  const pool = all.filter(s=>box.rarities.includes(s.rarity));
  return pool.length ? pool : all;
}

function drawMetaBlindBox(box) {
  if ((islandData.coins||0)<box.cost) {
    metaToast("金币不足");
    return;
  }
  const pool=skinPoolForBox(box);
  if(!pool.length)return;
  islandData.coins-=box.cost;
  const skin=pool[Math.floor(Math.random()*pool.length)];
  const duplicate=!!islandData.skins?.[skin.id];
  islandData.skins=islandData.skins||{};
  islandData.skins[skin.id]=true;
  islandData.equippedSkin=skin.id;
  if(duplicate)islandData.coins+=Math.floor(box.cost*0.25);
  saveIslandData();
  metaData.event.skinDraws++;
  metaData.seasonXp+=20;
  saveMetaData();
  refreshMetaHud();
  metaToast(duplicate?`重复【${skin.name}】，返还部分金币`:`获得【${skin.rarity}·${skin.name}】`);
}

function renderBoxes(title, body) {
  title.textContent = "🎁 皮肤盲盒中心";
  body.innerHTML = `
    <div class="meta-boxes">
      ${BLIND_BOXES.map(box=>`<div class="meta-box-card"><div>${box.icon}</div><b>${box.name}</b><small>${box.rarities.join(" / ")}</small><button data-box="${box.id}">${box.cost}金币抽一次</button></div>`).join("")}
    </div>
    <div class="meta-skin-count">已拥有皮肤：${Object.values(islandData.skins||{}).filter(Boolean).length} / ${typeof ISLAND_SKINS!=="undefined"?ISLAND_SKINS.length:0}</div>`;
  body.querySelectorAll("[data-box]").forEach(btn=>btn.onclick=()=>{
    const box=BLIND_BOXES.find(x=>x.id===btn.dataset.box);
    if(box)drawMetaBlindBox(box);
    renderBoxes(title,body);
  });
}

function renderRecharge(title, body) {
  title.textContent = "💎 金币充值中心";
  const packs=[1,6,18,30,68,128];
  body.innerHTML = `
    <div class="meta-recharge-rate"><b>固定兑换比例：1元 = 300金币</b><small>当前项目运行在 GitHub Pages，尚未接入真实支付服务器。</small></div>
    <div class="meta-recharge-grid">
      ${packs.map(y=>`<div class="meta-recharge-card"><b>¥${y}</b><strong>🪙 ${y*300}</strong><button disabled>待接支付渠道</button></div>`).join("")}
    </div>
    <div class="meta-payment-warning">真实充值需要接入支付服务商、订单服务器和支付回调验证；当前不会假装扣款或直接发放付费金币。</div>`;
}

// 活动进度：击杀。
if (typeof handleEnemyDestroyed === "function") {
  const handleEnemyDestroyedBeforeMeta = handleEnemyDestroyed;
  handleEnemyDestroyed = function(enemy, allowDrop=true) {
    const wasAlive=!!enemy?.alive;
    const result=handleEnemyDestroyedBeforeMeta(enemy,allowDrop);
    metaData.event.kills++;
    metaData.seasonXp+=5;
    saveMetaData();
    return result;
  };
}

// 活动进度：进入岛屿。
if (typeof openIslandWorld === "function") {
  const openIslandWorldBeforeMeta = openIslandWorld;
  openIslandWorld = function() {
    metaData.event.islandVisits++;
    metaData.seasonXp+=10;
    saveMetaData();
    return openIslandWorldBeforeMeta();
  };
}

// 活动进度：过关。nextLevelOrWin 会在每关清空敌人后调用。
if (typeof nextLevelOrWin === "function") {
  const nextLevelOrWinBeforeMeta = nextLevelOrWin;
  nextLevelOrWin = function() {
    metaData.event.clears++;
    metaData.seasonXp+=40;
    saveMetaData();
    return nextLevelOrWinBeforeMeta();
  };
}

createMetaHud();
refreshMetaHud();
setInterval(refreshMetaHud,1000);
