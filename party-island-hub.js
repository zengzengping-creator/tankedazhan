// 坦克岛派对主城系统：模式 / 赛季 / 景点 / 排位 / 联机 / 背包
const PARTY_HUB_STORAGE_KEY = "tankBattlePartyHub_v1";

function partyHubDefault() {
  return {
    rankPoints: 0,
    rankWins: 0,
    rankedActive: false,
    lastMode: "story",
  };
}

function loadPartyHubData() {
  try {
    return Object.assign(partyHubDefault(), JSON.parse(localStorage.getItem(PARTY_HUB_STORAGE_KEY) || "null") || {});
  } catch (_) {
    return partyHubDefault();
  }
}

let partyHubData = loadPartyHubData();

function savePartyHubData() {
  try { localStorage.setItem(PARTY_HUB_STORAGE_KEY, JSON.stringify(partyHubData)); } catch (_) {}
}

function partyRankInfo(points = partyHubData.rankPoints) {
  if (points >= 1200) return { name:"坦克王者", icon:"👑", next:null };
  if (points >= 800) return { name:"钻石装甲", icon:"💎", next:1200 };
  if (points >= 500) return { name:"黄金炮手", icon:"🥇", next:800 };
  if (points >= 250) return { name:"白银车长", icon:"🥈", next:500 };
  if (points >= 100) return { name:"青铜先锋", icon:"🥉", next:250 };
  return { name:"新兵", icon:"🎖️", next:100 };
}

function addPartyHubButtons() {
  const top = document.getElementById("meta-topbar");
  const right = document.getElementById("meta-rightbar");
  if (!top || !right || document.getElementById("party-mode-btn")) return;

  const mode = document.createElement("button");
  mode.id = "party-mode-btn";
  mode.dataset.metaPanel = "modes";
  mode.textContent = "🎮 模式";
  top.appendChild(mode);

  [
    ["scenic","📍","景点"],
    ["rank","🏅","排位"],
    ["online","🌐","联机"],
    ["backpack","🎒","背包"],
  ].forEach(([id, icon, label]) => {
    const btn = document.createElement("button");
    btn.dataset.metaPanel = id;
    btn.innerHTML = `${icon}<span>${label}</span>`;
    right.appendChild(btn);
  });
}

function startStoryMode() {
  if (typeof closeIslandWorld === "function") closeIslandWorld();
  level = 1;
  lives = 3;
  score = 0;
  startLevel(level);
  state = "playing";
  overlay.classList.add("hidden");
  partyHubData.lastMode = "story";
  savePartyHubData();
}

function startPartyMiniMode(mode, ranked = false) {
  partyHubData.rankedActive = ranked;
  partyHubData.lastMode = ranked ? `ranked-${mode}` : mode;
  savePartyHubData();
  if (typeof closeIslandWorld === "function") closeIslandWorld();
  if (typeof openIslandGame === "function") openIslandGame(mode);
}

function renderPartyModes(title, body) {
  title.textContent = "🎮 坦克岛模式大厅";
  body.innerHTML = `
    <div class="party-mode-hero">
      <b>选择玩法</b>
      <small>从坦克岛直接进入各种模式。</small>
    </div>
    <div class="party-mode-grid">
      <button data-party-mode="story"><strong>💥</strong><b>经典闯关</b><small>主线坦克战斗</small></button>
      <button data-party-mode="soccer"><strong>⚽</strong><b>坦克足球</b><small>推球进门</small></button>
      <button data-party-mode="range"><strong>🎯</strong><b>射击靶场</b><small>命中10个靶</small></button>
      <button data-party-mode="race"><strong>🏁</strong><b>坦克竞速</b><small>检查点竞速</small></button>
      <button data-party-mode="parkour"><strong>🗼</strong><b>跑酷挑战</b><small>前往跑酷塔</small></button>
      <button data-meta-panel="rank"><strong>🏅</strong><b>排位模式</b><small>赢取排位积分</small></button>
    </div>`;

  body.querySelectorAll("[data-party-mode]").forEach(btn => {
    btn.onclick = () => {
      const mode = btn.dataset.partyMode;
      if (mode === "story") startStoryMode();
      else if (mode === "parkour") {
        document.getElementById("meta-modal")?.classList.add("hidden");
        if (islandWorldState) {
          const mover = islandWorldState.mounted ? islandWorldState.player : islandWorldState.human;
          const target = ISLAND_WORLD_BUILDINGS.find(b => b.id === "parkour");
          if (mover && target) {
            mover.x = target.x - 70;
            mover.y = target.y + 20;
            clampPlayerToIsland(mover);
          }
        }
        metaToast("🗼 已来到跑酷塔附近");
      } else {
        startPartyMiniMode(mode, false);
      }
    };
  });
}

function renderPartyRank(title, body) {
  title.textContent = "🏅 坦克排位";
  const rank = partyRankInfo();
  const prevFloor = partyHubData.rankPoints >= 800 ? 800 :
    partyHubData.rankPoints >= 500 ? 500 :
    partyHubData.rankPoints >= 250 ? 250 :
    partyHubData.rankPoints >= 100 ? 100 : 0;
  const span = rank.next ? rank.next - prevFloor : 1;
  const pct = rank.next ? Math.min(100, ((partyHubData.rankPoints - prevFloor) / span) * 100) : 100;

  body.innerHTML = `
    <div class="party-rank-card">
      <div class="party-rank-icon">${rank.icon}</div>
      <b>${rank.name}</b>
      <strong>${partyHubData.rankPoints} 排位分</strong>
      <small>排位胜场：${partyHubData.rankWins}</small>
      <div class="meta-progress"><i style="width:${pct}%"></i></div>
      <small>${rank.next ? "距离下一段位还差 " + Math.max(0, rank.next-partyHubData.rankPoints) + " 分" : "已达到当前最高段位"}</small>
    </div>
    <div class="party-ranked-grid">
      <button data-ranked-mode="soccer">⚽ 排位足球<small>胜利 +25分</small></button>
      <button data-ranked-mode="range">🎯 排位靶场<small>完成 +25分</small></button>
      <button data-ranked-mode="race">🏁 排位竞速<small>完成 +25分</small></button>
    </div>
    <div class="party-info-note">当前排位为单人积分制。以后接入多人服务器后，可以升级成实时PVP匹配。</div>`;

  body.querySelectorAll("[data-ranked-mode]").forEach(btn => {
    btn.onclick = () => startPartyMiniMode(btn.dataset.rankedMode, true);
  });
}

function renderPartyScenic(title, body) {
  title.textContent = "📍 坦克岛景点";
  const scenic = [
    ["🎡","摩天轮","岛屿全景地标"],
    ["🏛️","坦克博物馆","收藏与历史展示"],
    ["☕","海景咖啡馆","休闲社交区域"],
    ["🌳","中央草坪","下车散步与动作"],
    ["⛲","主岛广场","大型主岛中心"],
    ["🗼","跑酷塔","登顶获得金币"],
    ["⚽","足球场","坦克足球玩法"],
    ["🎯","射击靶场","射击挑战"],
  ];
  body.innerHTML = `
    <div class="party-scenic-grid">
      ${scenic.map(([icon,name,desc]) => `<div><strong>${icon}</strong><b>${name}</b><small>${desc}</small></div>`).join("")}
    </div>
    <div class="party-info-note">景点都是真实布置在3D坦克岛上的区域，可以直接开坦克或下车走过去。</div>`;
}

function renderPartyOnline(title, body) {
  title.textContent = "🌐 联机大厅";
  body.innerHTML = `
    <div class="party-online-card">
      <div class="party-online-icon">🌐</div>
      <b>多人联机中心</b>
      <small>计划支持：好友房间、房间码、组队、实时PVP、多人坦克岛。</small>
      <button disabled>创建房间 · 待服务器接入</button>
      <button disabled>加入房间 · 待服务器接入</button>
    </div>
    <div class="party-info-note">
      当前项目运行在 GitHub Pages 纯前端，尚没有实时房间服务器。这里不会伪装成已联网；接入 WebSocket / 后端房间服务后即可启用。
    </div>`;
}

function renderPartyBackpack(title, body) {
  title.textContent = "🎒 我的背包";
  islandData.supplies = islandData.supplies || {};
  islandData.skins = islandData.skins || {};
  islandData.clothes = islandData.clothes || {};

  const supplies = typeof ISLAND_TANK_FOOD !== "undefined" ? ISLAND_TANK_FOOD : [];
  const skins = typeof ISLAND_SKINS !== "undefined" ? ISLAND_SKINS : [];
  const clothes = typeof ISLAND_CLOTHES !== "undefined" ? ISLAND_CLOTHES : [];

  body.innerHTML = `
    <div class="party-tabs">
      <button data-bag-tab="props">📦 道具</button>
      <button data-bag-tab="skins">🎨 坦克皮肤</button>
      <button data-bag-tab="clothes">👕 衣服</button>
    </div>
    <div id="party-bag-content"></div>`;

  function drawTab(tab) {
    const area = body.querySelector("#party-bag-content");
    if (tab === "skins") {
      area.innerHTML = `<div class="party-bag-grid">${skins.map(s => {
        const owned = !!islandData.skins[s.id];
        const equipped = islandData.equippedSkin === s.id;
        return `<button data-bag-skin="${s.id}" ${owned ? "" : "disabled"}><i style="background:${s.color}"></i><b>${owned ? s.name : "未获得"}</b><small>${equipped ? "✅ 已装备" : s.rarity}</small></button>`;
      }).join("")}</div>`;
      area.querySelectorAll("[data-bag-skin]").forEach(btn => btn.onclick = () => {
        if (!islandData.skins[btn.dataset.bagSkin]) return;
        islandData.equippedSkin = btn.dataset.bagSkin;
        saveIslandData();
        drawTab("skins");
      });
    } else if (tab === "clothes") {
      area.innerHTML = `<div class="party-bag-grid">${clothes.map(item => {
        const owned=!!islandData.clothes[item.id];
        const equipped=islandData.equippedClothes===item.id;
        return `<button data-bag-clothes="${item.id}" ${owned ? "" : "disabled"}><i style="background:${item.color}"></i><b>${owned ? item.name : "未拥有"}</b><small>${equipped ? "✅ 已穿着" : ""}</small></button>`;
      }).join("")}</div>`;
      area.querySelectorAll("[data-bag-clothes]").forEach(btn => btn.onclick = () => {
        if (!islandData.clothes[btn.dataset.bagClothes]) return;
        islandData.equippedClothes = btn.dataset.bagClothes;
        saveIslandData();
        drawTab("clothes");
      });
    } else {
      area.innerHTML = `<div class="party-bag-grid">${supplies.map(item => {
        const count=islandData.supplies[item.id]||0;
        const selected=islandData.selectedSupply===item.id;
        return `<button data-bag-prop="${item.id}" class="${selected ? "selected":""}"><strong>${item.icon}</strong><b>${item.name}</b><small>x${count}</small><small>${selected ? "F键当前道具" : item.desc || ""}</small></button>`;
      }).join("")}</div>`;
      area.querySelectorAll("[data-bag-prop]").forEach(btn => btn.onclick = () => {
        islandData.selectedSupply = btn.dataset.bagProp;
        saveIslandData();
        if (typeof renderBattleSupplyBar === "function") renderBattleSupplyBar();
        drawTab("props");
      });
    }
  }

  body.querySelectorAll("[data-bag-tab]").forEach(btn => btn.onclick = () => drawTab(btn.dataset.bagTab));
  drawTab("props");
}

// 扩展原大厅面板路由。
const openMetaPanelPartyBase = openMetaPanel;
openMetaPanel = function(type) {
  if (["modes","rank","scenic","online","backpack"].includes(type)) {
    const modal=document.getElementById("meta-modal");
    const title=document.getElementById("meta-modal-title");
    const body=document.getElementById("meta-modal-body");
    if(!modal||!title||!body)return;
    modal.classList.remove("hidden");
    if(type==="modes")renderPartyModes(title,body);
    else if(type==="rank")renderPartyRank(title,body);
    else if(type==="scenic")renderPartyScenic(title,body);
    else if(type==="online")renderPartyOnline(title,body);
    else renderPartyBackpack(title,body);
    return;
  }
  return openMetaPanelPartyBase(type);
};

// 排位小游戏完成后增加积分。
if (typeof finishIslandGame === "function") {
  const finishIslandGamePartyBase = finishIslandGame;
  finishIslandGame = function(reward, text) {
    const ranked = !!partyHubData.rankedActive;
    const result = finishIslandGamePartyBase(reward, text);
    if (ranked) {
      partyHubData.rankPoints += 25;
      partyHubData.rankWins += 1;
      partyHubData.rankedActive = false;
      savePartyHubData();
      if (typeof metaToast === "function") metaToast("🏅 排位胜利 +25分");
    }
    return result;
  };
}

if (typeof closeIslandGame === "function") {
  const closeIslandGamePartyBase = closeIslandGame;
  closeIslandGame = function() {
    partyHubData.rankedActive = false;
    savePartyHubData();
    return closeIslandGamePartyBase();
  };
}

addPartyHubButtons();
