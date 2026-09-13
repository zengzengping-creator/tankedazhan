// 顶部/右侧大厅HUD：头像、赛季、手册、活动任务、表情动作、盲盒、充值中心。
const META_STORAGE_KEY = "tankBattleMeta_v1";
const VIP_CACHE_KEY = "tankBattleVipCache_v1";

const VIP_FALLBACK_LEVELS = [
  {level:0,threshold:0,title:"普通车长",dailyCoins:0,dailyTankCoins:0,shopDiscount:0,boxDiscount:0},
  {level:1,threshold:6,title:"VIP青铜",dailyCoins:50,dailyTankCoins:0,shopDiscount:2,boxDiscount:2},
  {level:2,threshold:30,title:"VIP白银",dailyCoins:100,dailyTankCoins:5,shopDiscount:3,boxDiscount:4},
  {level:3,threshold:68,title:"VIP黄金",dailyCoins:180,dailyTankCoins:10,shopDiscount:5,boxDiscount:6},
  {level:4,threshold:128,title:"VIP铂金",dailyCoins:300,dailyTankCoins:20,shopDiscount:7,boxDiscount:8},
  {level:5,threshold:328,title:"VIP钻石",dailyCoins:500,dailyTankCoins:30,shopDiscount:10,boxDiscount:10},
  {level:6,threshold:648,title:"VIP至尊",dailyCoins:800,dailyTankCoins:50,shopDiscount:12,boxDiscount:12},
];

function loadVipCache(){
  try{
    const v=JSON.parse(localStorage.getItem(VIP_CACHE_KEY)||"null");
    return v&&typeof v==="object"?v:{level:0,title:"普通车长",paidYuan:0,shopDiscount:0,boxDiscount:0,dailyClaimed:false};
  }catch(_){
    return {level:0,title:"普通车长",paidYuan:0,shopDiscount:0,boxDiscount:0,dailyClaimed:false};
  }
}
let metaVipCache=loadVipCache();

function saveVipCache(vip){
  metaVipCache=Object.assign({},metaVipCache,vip||{});
  try{localStorage.setItem(VIP_CACHE_KEY,JSON.stringify(metaVipCache));}catch(_){}
  refreshMetaHud();
}

function vipDiscountedPrice(base,kind="shop"){
  const pct=kind==="box"?(metaVipCache.boxDiscount||0):(metaVipCache.shopDiscount||0);
  return Math.max(1,Math.floor(Number(base||0)*(100-pct)/100));
}
globalThis.getVipDiscountedPrice=vipDiscountedPrice;

async function syncVipStatus(silent=true){
  if(typeof getCommunityServerUrl!=="function"||!getCommunityServerUrl()||typeof getVipStatusOnline!=="function")return metaVipCache;
  try{
    const result=await getVipStatusOnline();
    if(result?.vip)saveVipCache(result.vip);
    return metaVipCache;
  }catch(err){
    if(!silent)metaToast("VIP服务器连接失败："+(err?.message||"未知错误"));
    return metaVipCache;
  }
}

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

function metaAddTankCoins(amount) {
  if (typeof islandData === "undefined") return;
  islandData.tankCoins = Math.max(0, (islandData.tankCoins || 0) + Math.floor(Number(amount)||0));
  if (typeof saveIslandData === "function") saveIslandData();
  refreshMetaHud();
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

const ISLAND_PETS = [
  {id:"scout",name:"侦察小虎机",icon:"🐯",price:0},
  {id:"drone",name:"蓝光无人机",icon:"🛸",price:180},
  {id:"bot",name:"迷你维修机器人",icon:"🤖",price:260},
  {id:"fox",name:"机械小狐狸",icon:"🦊",price:360},
  {id:"dragon",name:"钢铁小龙",icon:"🐲",price:520},
];

function ensurePetData() {
  if (typeof islandData === "undefined") return;
  islandData.pets = islandData.pets || {};
  islandData.pets.scout = true;
  if (!islandData.equippedPet) islandData.equippedPet = "scout";
  saveIslandData();
}

function activeIslandPet() {
  ensurePetData();
  return ISLAND_PETS.find(p=>p.id===islandData?.equippedPet) || ISLAND_PETS[0];
}
globalThis.activeIslandPet = activeIslandPet;

function skinDirectPrice(skin) {
  const base=skin?.rarity==="传说" ? 500 : skin?.rarity==="史诗" ? 320 : skin?.rarity==="稀有" ? 200 : 120;
  return vipDiscountedPrice(base,"shop");
}

const CURRENCY_INFO = {
  coins:{icon:"🪙",name:"金币"},
  tankCoins:{icon:"🔷",name:"坦克币"},
  midTankCoins:{icon:"🟣",name:"中级坦克币"},
  highTankCoins:{icon:"💎",name:"高级坦克币"},
};

const BLIND_BOXES = [
  { id:"basic", name:"基础迷彩盲盒", icon:"📦", cost:100, currency:"coins", rarities:["普通","普通","稀有"] },
  { id:"mid", name:"中级坦克盲盒", icon:"🎁", cost:20, currency:"midTankCoins", rarities:["稀有","稀有","史诗"] },
  { id:"high", name:"高级坦克盲盒", icon:"✨", cost:20, currency:"highTankCoins", rarities:["史诗","传说","传说"] },
];

function createMetaHud() {
  if (document.getElementById("meta-topbar")) return;

  const top = document.createElement("div");
  top.id = "meta-topbar";
  top.innerHTML = `
    <button class="meta-avatar" data-meta-panel="profile" title="头像">👤</button>
    <div class="meta-coins">🪙 <b id="meta-coins">0</b></div>
    <button data-meta-panel="currency" class="meta-tank-currency">🔷 <b id="meta-tank-coins">0</b></button>
    <button data-meta-panel="vip" class="meta-vip-top">👑 <b id="meta-vip-level">VIP0</b></button>
    <button data-meta-panel="pets">🐾 宠物</button>
    <button data-meta-panel="skinshop">🎨 皮肤商城</button>
    <button data-meta-panel="recharge" class="meta-recharge-top">💎 充值</button>
  `;

  const right = document.createElement("div");
  right.id = "meta-rightbar";
  right.className = "meta-emote-quickbar";
  right.innerHTML = `
    <button data-emote-quick="😀" title="开心">😀</button>
    <button data-emote-quick="😂" title="大笑">😂</button>
    <button data-emote-quick="🔥" title="厉害">🔥</button>
    <button data-emote-quick="👍" title="点赞">👍</button>
    <button data-emote-quick="❤️" title="喜欢">❤️</button>
    <button data-meta-panel="social">🎭<span>动作</span></button>
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
    const quick = e.target.closest("[data-emote-quick]");
    if (quick) {
      useEmote(quick.dataset.emoteQuick);
      return;
    }
    const btn = e.target.closest("[data-meta-panel]");
    if (!btn) return;
    openMetaPanel(btn.dataset.metaPanel);
  });
  modal.querySelector("#meta-modal-close")?.addEventListener("click", () => modal.classList.add("hidden"));
}

function refreshMetaHud() {
  const el = document.getElementById("meta-coins");
  const tankEl = document.getElementById("meta-tank-coins");
  const vipEl = document.getElementById("meta-vip-level");
  if (el && typeof islandData !== "undefined") el.textContent = islandData.coins || 0;
  if (tankEl && typeof islandData !== "undefined") tankEl.textContent = islandData.tankCoins || 0;
  if (vipEl) vipEl.textContent = "VIP"+(metaVipCache.level||0);
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
  else if (type === "warehouse") renderWarehouse(title, body);
  else if (type === "tasks") renderTasks(title, body);
  else if (type === "social") renderSocial(title, body);
  else if (type === "boxes") renderBoxes(title, body);
  else if (type === "currency") renderCurrencyWallet(title, body);
  else if (type === "vip") renderVip(title, body);
  else if (type === "recharge") renderRecharge(title, body);
  else if (type === "pets") renderPets(title, body);
  else if (type === "skinshop") renderSkinShop(title, body);
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

function renderWarehouse(title, body) {
  title.textContent = "📦 坦克岛仓库";
  islandData.supplies = islandData.supplies || {};
  if (!islandData.selectedSupply) islandData.selectedSupply = "fuel";

  const items = typeof ISLAND_TANK_FOOD !== "undefined" ? ISLAND_TANK_FOOD : [];
  body.innerHTML = `
    <div class="meta-recharge-rate">
      <b>选择局内F键道具技能</b>
      <small>在这里选好后，进入关卡直接按 F 使用。</small>
    </div>
    <div class="meta-warehouse-grid">
      ${items.map(item => {
        const count = islandData.supplies[item.id] || 0;
        const selected = islandData.selectedSupply === item.id;
        return `<button class="meta-warehouse-item ${selected ? "selected" : ""}" data-select-supply="${item.id}">
          <strong>${item.icon}</strong>
          <b>${item.name}</b>
          <small>库存 x${count}</small>
          <small>${item.desc || ""}</small>
          <span>${selected ? "✅ F键已选择" : "设为F键道具"}</span>
        </button>`;
      }).join("")}
    </div>`;

  body.querySelectorAll("[data-select-supply]").forEach(btn => {
    btn.onclick = () => {
      islandData.selectedSupply = btn.dataset.selectSupply;
      saveIslandData();
      if (typeof renderBattleSupplyBar === "function") renderBattleSupplyBar();
      renderWarehouse(title, body);
    };
  });
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

async function renderVip(title, body) {
  title.textContent = "👑 VIP会员";
  body.innerHTML = '<div class="vip-loading">正在同步VIP等级…</div>';
  await syncVipStatus(true);

  let levels=VIP_FALLBACK_LEVELS;
  try{
    if(typeof getVipStatusOnline==="function"&&typeof getCommunityServerUrl==="function"&&getCommunityServerUrl()){
      const result=await getVipStatusOnline();
      if(Array.isArray(result?.levels))levels=result.levels;
      if(result?.vip)saveVipCache(result.vip);
    }
  }catch(_){}

  const vip=metaVipCache;
  const current=levels.find(x=>x.level===vip.level)||levels[0];
  const next=levels.find(x=>x.level===vip.level+1)||null;
  const paid=Number(vip.paidYuan)||0;
  const pct=next?Math.max(0,Math.min(100,((paid-current.threshold)/(next.threshold-current.threshold))*100)):100;

  body.innerHTML = `
    <div class="vip-hero vip-level-${vip.level||0}">
      <div class="vip-crown">👑</div>
      <div><b>VIP${vip.level||0} · ${escapeRechargeHtml(vip.title||current.title)}</b>
      <small>累计充值 ¥${paid.toFixed(0)}</small></div>
    </div>
    <div class="vip-progress-card">
      <div><span>VIP${vip.level||0}</span><b>${next?"距离 VIP"+next.level+" 还差 ¥"+Math.max(0,next.threshold-paid).toFixed(0):"已达到最高VIP"}</b></div>
      <div class="meta-progress"><i style="width:${pct}%"></i></div>
    </div>
    <div class="vip-benefits">
      <div><strong>🪙 ${current.dailyCoins||0}</strong><span>每日金币</span></div>
      <div><strong>🔷 ${current.dailyTankCoins||0}</strong><span>每日坦克币</span></div>
      <div><strong>${current.shopDiscount||0}%</strong><span>商城折扣</span></div>
      <div><strong>${current.boxDiscount||0}%</strong><span>盲盒折扣</span></div>
    </div>
    <button id="vip-daily-claim" class="vip-daily-btn" ${vip.level<=0||vip.dailyClaimed?"disabled":""}>
      ${vip.level<=0?"VIP1起可领取":vip.dailyClaimed?"✅ 今日已领取":"🎁 领取今日VIP奖励"}
    </button>
    <div class="vip-level-list">
      ${levels.slice(1).map(row=>`<div class="${row.level===vip.level?"current":""}">
        <span><b>VIP${row.level} · ${row.title}</b><small>累计充值 ¥${row.threshold}</small></span>
        <em>每日 🪙${row.dailyCoins} ${row.dailyTankCoins?"＋ 🔷"+row.dailyTankCoins:""} · 商城-${row.shopDiscount}% · 盲盒-${row.boxDiscount}%</em>
      </div>`).join("")}
    </div>`;

  body.querySelector("#vip-daily-claim")?.addEventListener("click",async()=>{
    try{
      const result=await claimVipDailyOnline();
      const reward=result?.reward||{};
      if(reward.coins)metaAddCoins(Number(reward.coins)||0);
      if(reward.tankCoins)metaAddTankCoins(Number(reward.tankCoins)||0);
      if(result?.vip)saveVipCache(result.vip);
      metaToast(`👑 VIP每日奖励：🪙${reward.coins||0}${reward.tankCoins?" + 🔷"+reward.tankCoins:""}`);
      renderVip(title,body);
    }catch(err){
      metaToast(err?.message||"VIP奖励领取失败");
    }
  });
}

function renderCurrencyWallet(title, body) {
  title.textContent = "🔷 坦克币兑换";
  const tank = islandData.tankCoins || 0;
  const mid = islandData.midTankCoins || 0;
  const high = islandData.highTankCoins || 0;
  body.innerHTML = `
    <div class="tank-currency-wallet">
      <div><strong>🔷 ${tank.toLocaleString()}</strong><span>坦克币</span></div>
      <div><strong>🟣 ${mid.toLocaleString()}</strong><span>中级坦克币</span></div>
      <div><strong>💎 ${high.toLocaleString()}</strong><span>高级坦克币</span></div>
    </div>
    <div class="tank-currency-exchange">
      <div>
        <span><b>5 🔷 → 1 🟣</b><small>中级坦克币用于抽中级坦克盲盒</small></span>
        <button data-exchange="mid" ${tank<5?"disabled":""}>兑换1个</button>
        <button data-exchange-batch="mid" ${tank<50?"disabled":""}>兑换10个</button>
      </div>
      <div>
        <span><b>10 🔷 → 1 💎</b><small>高级坦克币用于抽高级坦克盲盒</small></span>
        <button data-exchange="high" ${tank<10?"disabled":""}>兑换1个</button>
        <button data-exchange-batch="high" ${tank<100?"disabled":""}>兑换10个</button>
      </div>
    </div>
    <div class="meta-payment-warning">兑换后不可反向换回坦克币。</div>
    <button class="tank-currency-box-link" id="open-special-boxes">🎁 去抽中级 / 高级坦克盲盒</button>`;

  const exchange=(type,count)=>{
    const ratio=type==="high"?10:5;
    const key=type==="high"?"highTankCoins":"midTankCoins";
    const need=ratio*count;
    if((islandData.tankCoins||0)<need){metaToast("坦克币不足");return;}
    islandData.tankCoins-=need;
    islandData[key]=(islandData[key]||0)+count;
    saveIslandData();refreshMetaHud();
    metaToast(type==="high"?`💎 获得高级坦克币 x${count}`:`🟣 获得中级坦克币 x${count}`);
    renderCurrencyWallet(title,body);
  };
  body.querySelectorAll("[data-exchange]").forEach(btn=>btn.onclick=()=>exchange(btn.dataset.exchange,1));
  body.querySelectorAll("[data-exchange-batch]").forEach(btn=>btn.onclick=()=>exchange(btn.dataset.exchangeBatch,10));
  body.querySelector("#open-special-boxes")?.addEventListener("click",()=>renderBoxes(title,body));
}

function skinPoolForBox(box) {
  const all = typeof ISLAND_SKINS !== "undefined" ? ISLAND_SKINS : [];
  const pool = all.filter(s=>box.rarities.includes(s.rarity));
  return pool.length ? pool : all;
}

function drawMetaBlindBox(box) {
  const key=box.currency||"coins";
  const info=CURRENCY_INFO[key]||CURRENCY_INFO.coins;
  const cost=vipDiscountedPrice(box.cost,"box");
  const balance=islandData[key]||0;
  if (balance<cost) {
    metaToast(info.name+"不足");
    return;
  }
  const pool=skinPoolForBox(box);
  if(!pool.length)return;
  islandData[key]-=cost;
  const skin=pool[Math.floor(Math.random()*pool.length)];
  const duplicate=!!islandData.skins?.[skin.id];
  islandData.skins=islandData.skins||{};
  islandData.skins[skin.id]=true;
  islandData.equippedSkin=skin.id;
  if(duplicate)islandData[key]+=Math.floor(cost*0.25);
  saveIslandData();
  metaData.event.skinDraws++;
  metaData.seasonXp+=20;
  saveMetaData();
  refreshMetaHud();
  metaToast(duplicate?`重复【${skin.name}】，返还部分${info.name}`:`获得【${skin.rarity}·${skin.name}】`);
}

function renderBoxes(title, body) {
  title.textContent = "🎁 坦克盲盒中心";
  body.innerHTML = `
    <div class="tank-currency-mini">
      <span>🪙 ${islandData.coins||0}</span>
      <span>🔷 ${islandData.tankCoins||0}</span>
      <span>🟣 ${islandData.midTankCoins||0}</span>
      <span>💎 ${islandData.highTankCoins||0}</span>
      <button id="box-open-exchange">兑换坦克币</button>
    </div>
    <div class="meta-boxes">
      ${BLIND_BOXES.map(box=>{
        const info=CURRENCY_INFO[box.currency||"coins"]||CURRENCY_INFO.coins;
        const cost=vipDiscountedPrice(box.cost,"box");
        return `<div class="meta-box-card ${box.id==="high"?"premium":box.id==="mid"?"mid":""}">
          <div>${box.icon}</div><b>${box.name}</b>
          <small>${box.rarities.join(" / ")}</small>
          <button data-box="${box.id}">${info.icon} ${cost} 抽一次${cost<box.cost?" · VIP折扣":""}</button>
        </div>`;
      }).join("")}
    </div>
    <div class="meta-skin-count">已拥有皮肤：${Object.values(islandData.skins||{}).filter(Boolean).length} / ${typeof ISLAND_SKINS!=="undefined"?ISLAND_SKINS.length:0}</div>`;
  body.querySelectorAll("[data-box]").forEach(btn=>btn.onclick=()=>{
    const box=BLIND_BOXES.find(x=>x.id===btn.dataset.box);
    if(box)drawMetaBlindBox(box);
    renderBoxes(title,body);
  });
  body.querySelector("#box-open-exchange")?.addEventListener("click",()=>renderCurrencyWallet(title,body));
}

function renderPets(title, body) {
  ensurePetData();
  title.textContent = "🐾 宠物";
  body.innerHTML = `
    <div class="meta-recharge-rate">
      <b>选择跟随宠物</b>
      <small>购买后永久拥有，装备后会跟在坦克/人物旁边。</small>
    </div>
    <div class="pet-shop-grid">
      ${ISLAND_PETS.map(p=>{
        const owned=!!islandData.pets[p.id];
        const equipped=islandData.equippedPet===p.id;
        const price=vipDiscountedPrice(p.price,"shop");
        return `<button data-pet="${p.id}" class="${equipped?"selected":""}">
          <strong>${p.icon}</strong><b>${p.name}</b>
          <small>${equipped?"✅ 跟随中":owned?"已拥有":price+"金币"+(price<p.price?" · VIP价":"")}</small>
          <span>${equipped?"已装备":owned?"装备":"购买"}</span>
        </button>`;
      }).join("")}
    </div>`;
  body.querySelectorAll("[data-pet]").forEach(btn=>btn.onclick=()=>{
    const pet=ISLAND_PETS.find(p=>p.id===btn.dataset.pet);
    if(!pet)return;
    if(!islandData.pets[pet.id]){
      const price=vipDiscountedPrice(pet.price,"shop");
      if((islandData.coins||0)<price){metaToast("金币不足");return;}
      islandData.coins-=price;
      islandData.pets[pet.id]=true;
    }
    islandData.equippedPet=pet.id;
    saveIslandData();refreshMetaHud();
    metaToast(`${pet.icon} ${pet.name} 已装备`);
    renderPets(title,body);
  });
}

function renderSkinShop(title, body) {
  title.textContent = "🎨 皮肤商城";
  islandData.skins=islandData.skins||{};
  const skins=typeof ISLAND_SKINS!=="undefined"?ISLAND_SKINS:[];
  body.innerHTML = `
    <div class="meta-recharge-rate">
      <b>坦克皮肤直接购买</b>
      <small>不需要抽盲盒，选中喜欢的皮肤可直接用金币购买并装备。</small>
    </div>
    <div class="skin-direct-grid">
      ${skins.map(s=>{
        const owned=!!islandData.skins[s.id];
        const equipped=islandData.equippedSkin===s.id;
        const price=skinDirectPrice(s);
        return `<button data-direct-skin="${s.id}" class="${equipped?"selected":""}">
          <i style="background:${s.color};box-shadow:inset 0 0 0 3px ${s.accent}"></i>
          <b>${s.name}</b><small>${s.rarity}</small>
          <span>${equipped?"✅ 已装备":owned?"装备":price+"金币购买"}</span>
        </button>`;
      }).join("")}
    </div>`;
  body.querySelectorAll("[data-direct-skin]").forEach(btn=>btn.onclick=()=>{
    const skin=skins.find(s=>s.id===btn.dataset.directSkin);
    if(!skin)return;
    if(!islandData.skins[skin.id]){
      const price=skinDirectPrice(skin);
      if((islandData.coins||0)<price){metaToast("金币不足");return;}
      islandData.coins-=price;
      islandData.skins[skin.id]=true;
    }
    islandData.equippedSkin=skin.id;
    saveIslandData();refreshMetaHud();
    metaToast(`🎨 ${skin.name} 已装备`);
    renderSkinShop(title,body);
  });
}

async function renderRecharge(title, body) {
  title.textContent = "💎 坦克币充值";
  const fallbackPacks=[
    {id:"r1",yuan:1,baseTankCoins:100,bonusTankCoins:0},
    {id:"r6",yuan:6,baseTankCoins:600,bonusTankCoins:0},
    {id:"r18",yuan:18,baseTankCoins:1800,bonusTankCoins:0},
    {id:"r30",yuan:30,baseTankCoins:3000,bonusTankCoins:300},
    {id:"r68",yuan:68,baseTankCoins:6800,bonusTankCoins:1000},
    {id:"r128",yuan:128,baseTankCoins:12800,bonusTankCoins:2500}
  ];
  const serverUrl=typeof getCommunityServerUrl==="function"?getCommunityServerUrl():"";
  let config={packs:fallbackPacks,paymentConfigured:false,firstRechargeDouble:true};
  let orders=[];
  let serverError="";

  if(serverUrl && typeof getRechargeConfigOnline==="function"){
    try{
      config=await getRechargeConfigOnline();
      const history=await getRechargeOrdersOnline();
      orders=Array.isArray(history?.orders)?history.orders:[];
    }catch(err){
      serverError=err?.message||"充值服务器不可用";
    }
  }

  const hasPaidBefore=orders.some(o=>o.status==="paid"||o.status==="claimed");
  const firstDoubleAvailable=!hasPaidBefore;
  const statusText=(order)=>{
    if(order.status==="claimed")return "✅ 已到账";
    if(order.status==="paid")return "💰 已支付 · 待领取";
    return "⏳ 待支付";
  };

  body.innerHTML = `
    <div class="meta-recharge-rate">
      <b>🔷 1元 = 100坦克币</b>
      <small>首次充值：基础坦克币 ×2；30元及以上额外赠送坦克币。普通金币仍通过游戏任务获得。</small>
    </div>

    <div class="recharge-first-banner ${firstDoubleAvailable?"active":"used"}">
      <strong>${firstDoubleAvailable?"🎉 首充双倍可用":"✅ 首充双倍已使用"}</strong>
      <span>${firstDoubleAvailable?"第一次支付成功时，基础坦克币自动翻倍。":"后续充值按基础数量 + 档位赠送计算。"}</span>
    </div>

    <div class="meta-recharge-server ${serverUrl&&!serverError?"ready":""}">
      <span><b>充值服务器</b><small>${serverUrl ? escapeRechargeHtml(serverUrl) : "尚未配置服务器地址"}</small></span>
      <button id="meta-recharge-server-btn">${serverUrl?"更换服务器":"配置服务器"}</button>
    </div>

    ${serverError?`<div class="meta-payment-warning">⚠️ ${escapeRechargeHtml(serverError)}</div>`:""}

    <div class="meta-recharge-grid">
      ${(config.packs||fallbackPacks).map(p=>{
        const base=Number(p.baseTankCoins)||0;
        const bonus=Number(p.bonusTankCoins)||0;
        const preview=base*(firstDoubleAvailable?2:1)+bonus;
        return `
        <div class="meta-recharge-card ${p.yuan>=30?"bonus-pack":""}">
          <b>¥${p.yuan}</b>
          <strong>🔷 ${preview.toLocaleString()}</strong>
          <small>基础 ${base.toLocaleString()}${firstDoubleAvailable?" ×2":""}</small>
          ${bonus>0?`<em>🎁 额外赠送 +${bonus.toLocaleString()}</em>`:"<em>标准充值</em>"}
          <button data-recharge-pack="${p.id}" ${!serverUrl||serverError?"disabled":""}>立即充值</button>
        </div>`;
      }).join("")}
    </div>

    <div class="tank-recharge-rules">
      <span>🟣 5坦克币 = 1中级坦克币</span>
      <span>💎 10坦克币 = 1高级坦克币</span>
      <button id="recharge-open-exchange">充值后去兑换</button>
    </div>

    <div class="meta-recharge-provider ${config.paymentConfigured?"ready":""}">
      ${config.paymentConfigured
        ?"✅ 支付渠道已连接。支付成功后由服务器确认坦克币数量。"
        :"🔒 充值订单系统已完成；支付渠道未配置时不会真实扣款，也不会发放付费坦克币。"}
    </div>

    <div class="meta-recharge-history">
      <div class="meta-recharge-history-head"><b>充值记录</b><button id="meta-recharge-refresh">刷新</button></div>
      <div class="meta-recharge-orders">
        ${orders.length?orders.map(o=>`
          <div class="meta-recharge-order">
            <span>
              <b>¥${o.yuan} · 🔷 ${Number(o.totalTankCoins||o.baseTankCoins||0).toLocaleString()}</b>
              <small>${escapeRechargeHtml(o.id)}${o.firstDouble?" · 首充双倍":""}${o.bonusTankCoins?` · 赠送+${Number(o.bonusTankCoins).toLocaleString()}`:""}</small>
            </span>
            <em class="status-${o.status}">${statusText(o)}</em>
            <div>
              ${o.status==="pending"&&o.checkoutUrl?`<button data-recharge-pay="${escapeRechargeHtml(o.checkoutUrl)}">去支付</button>`:""}
              ${o.status==="paid"?`<button data-recharge-claim="${o.id}">领取坦克币</button>`:""}
            </div>
          </div>`).join("")
          :'<div class="meta-recharge-empty">还没有充值订单</div>'}
      </div>
    </div>`;

  body.querySelector("#meta-recharge-server-btn")?.addEventListener("click",()=>{
    if(typeof openMetaPanel==="function")openMetaPanel("team");
    metaToast("可在在线组队页配置同一个服务器地址");
  });

  body.querySelectorAll("[data-recharge-pack]").forEach(btn=>btn.onclick=async()=>{
    btn.disabled=true;
    try{
      const result=await createRechargeOrderOnline(btn.dataset.rechargePack);
      const order=result?.order;
      if(order?.checkoutUrl){
        window.open(order.checkoutUrl,"_blank","noopener,noreferrer");
        metaToast("💎 订单已创建，正在打开支付页面");
      }else{
        metaToast("订单已创建，但支付渠道尚未配置");
      }
      await renderRecharge(title,body);
    }catch(err){
      metaToast("充值下单失败："+(err?.message||"服务器错误"));
      btn.disabled=false;
    }
  });

  body.querySelectorAll("[data-recharge-pay]").forEach(btn=>btn.onclick=()=>{
    const url=btn.dataset.rechargePay;
    if(url)window.open(url,"_blank","noopener,noreferrer");
  });

  body.querySelectorAll("[data-recharge-claim]").forEach(btn=>btn.onclick=async()=>{
    btn.disabled=true;
    try{
      const result=await claimRechargeOrderOnline(btn.dataset.rechargeClaim);
      const tankCoins=Number(result?.tankCoins)||0;
      if(tankCoins>0)metaAddTankCoins(tankCoins);
      await syncVipStatus(true);
      metaToast(`🔷 充值到账 +${tankCoins.toLocaleString()}坦克币 · VIP已更新`);
      await renderRecharge(title,body);
    }catch(err){
      metaToast("领取失败："+(err?.message||"订单状态异常"));
      btn.disabled=false;
    }
  });

  body.querySelector("#meta-recharge-refresh")?.addEventListener("click",()=>renderRecharge(title,body));
  body.querySelector("#recharge-open-exchange")?.addEventListener("click",()=>renderCurrencyWallet(title,body));
}

function escapeRechargeHtml(value){
  return String(value??"").replace(/[&<>"']/g,ch=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[ch]);
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

function updateMetaHudLocation() {
  const top = document.getElementById("meta-topbar");
  const right = document.getElementById("meta-rightbar");
  const modal = document.getElementById("meta-modal");
  const onIsland = typeof islandWorldActive !== "undefined" && islandWorldActive;
  if (top) top.classList.toggle("island-only-hidden", !onIsland);
  if (right) right.classList.toggle("island-only-hidden", !onIsland);
  if (!onIsland && modal && !modal.classList.contains("hidden")) modal.classList.add("hidden");
}

ensurePetData();
createMetaHud();
refreshMetaHud();
updateMetaHudLocation();
setTimeout(()=>syncVipStatus(true),600);
setInterval(() => {
  refreshMetaHud();
  updateMetaHudLocation();
}, 300);
