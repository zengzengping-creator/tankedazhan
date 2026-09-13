// 坦克岛派对主城系统：模式 / 赛季 / 景点 / 排位 / 联机 / 背包
const PARTY_HUB_STORAGE_KEY = "tankBattlePartyHub_v1";

function partyHubDefault() {
  return {
    rankPoints: 0,
    rankWins: 0,
    rankedActive: false,
    lastMode: "story",
    teamSize: 1,
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

const PARTY_LOCAL_CHAT_KEY = "tankPartyLocalChat_v1";
const PARTY_CREATION_KEY = "tankPartyCreation_v1";

const PARTY_MODE_INFO = {
  story:["💥","经典闯关"],
  soccer:["⚽","坦克足球"],
  range:["🎯","射击靶场"],
  race:["🏁","坦克竞速"],
  parkour:["🗼","跑酷挑战"],
  treasure:["🗺️","寻宝争夺"],
  capture:["🚩","据点抢占"],
  chaos:["⚡","技能大乱斗"],
  amusement:["🎪","游乐园巡游"],
  giantmaze:["🧩","巨型剧情迷宫"],
};

function escapePartyHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[ch]);
}

function loadPartyLocalChat() {
  try {
    const rows = JSON.parse(localStorage.getItem(PARTY_LOCAL_CHAT_KEY) || "[]");
    return Array.isArray(rows) ? rows.slice(-30) : [];
  } catch (_) { return []; }
}

function savePartyLocalChat(rows) {
  try { localStorage.setItem(PARTY_LOCAL_CHAT_KEY, JSON.stringify(rows.slice(-30))); } catch (_) {}
}

function loadPartyCreation() {
  try {
    return Object.assign({name:"我的坦克地图",theme:"欢乐岛",size:"中型"}, JSON.parse(localStorage.getItem(PARTY_CREATION_KEY) || "null") || {});
  } catch (_) {
    return {name:"我的坦克地图",theme:"欢乐岛",size:"中型"};
  }
}

function partyModeLabel(mode = partyHubData.lastMode) {
  const info = PARTY_MODE_INFO[mode] || PARTY_MODE_INFO.story;
  return `${info[0]} ${info[1]}`;
}

function ensurePartyCommandDock() {
  let dock = document.getElementById("party-command-dock");
  if (dock) return dock;
  dock = document.createElement("div");
  dock.id = "party-command-dock";
  dock.className = "party-command-dock hidden";
  dock.innerHTML = `
    <button data-party-command="chat">💬<span>聊天</span></button>
    <button data-party-command="team">👥<span>组队</span></button>
    <button data-party-command="modes">🎮<span>模式选择</span></button>
    <button data-party-command="start" class="party-command-start">▶<span>开始游戏</span></button>
    <button data-party-command="create">🛠<span>创作</span></button>
    <button data-party-command="map">🗺️<span>地图</span></button>
  `;
  document.getElementById("canvas-wrap")?.appendChild(dock);
  dock.addEventListener("click", e => {
    const btn = e.target.closest("[data-party-command]");
    if (!btn) return;
    const cmd = btn.dataset.partyCommand;
    if (cmd === "start") startSelectedPartyMode();
    else openMetaPanel(cmd);
  });
  return dock;
}

function setPartyDockVisible(visible) {
  const dock = ensurePartyCommandDock();
  dock?.classList.toggle("hidden", !visible);
  const start = dock?.querySelector(".party-command-start span");
  if (start) start.textContent = `开始 · ${partyModeLabel().replace(/^..\s?/u,"")}`;
}

function teleportPartyMap(x, y, label) {
  if (!islandWorldState) return;
  const mover = islandWorldState.mounted ? islandWorldState.player : islandWorldState.human;
  if (!mover) return;
  mover.x = x; mover.y = y; mover.z = 0; mover.vz = 0;
  if (typeof clampPlayerToIsland === "function") clampPlayerToIsland(mover);
  document.getElementById("meta-modal")?.classList.add("hidden");
  metaToast(`🗺️ 已定位：${label}`);
}

function startSelectedPartyMode() {
  const mode = partyHubData.lastMode || "story";
  document.getElementById("meta-modal")?.classList.add("hidden");
  if (mode === "story") return startStoryMode();
  if (mode === "amusement") {
    if (islandWorldState) {
      const mover = islandWorldState.mounted ? islandWorldState.player : islandWorldState.human;
      if (mover) { mover.x=900; mover.y=590; mover.z=0; mover.vz=0; }
    }
    metaToast("🎪 已进入游乐园巡游区");
    return;
  }
  if (mode === "giantmaze") {
    if (islandWorldState) {
      const mover = islandWorldState.mounted ? islandWorldState.player : islandWorldState.human;
      if (mover) { mover.x=1285; mover.y=590; mover.z=0; mover.vz=0; }
    }
    metaToast("🧩 已来到巨型剧情迷宫入口");
    return;
  }
  if (mode === "parkour") {
    if (islandWorldState) {
      const mover = islandWorldState.mounted ? islandWorldState.player : islandWorldState.human;
      const target = ISLAND_WORLD_BUILDINGS.find(b => b.id === "parkour");
      if (mover && target) {
        mover.x = target.x - 70; mover.y = target.y + 20;
        clampPlayerToIsland(mover);
      }
    }
    metaToast("🗼 已来到跑酷塔附近");
    return;
  }
  if (["treasure","capture","chaos"].includes(mode)) {
    if (typeof closeIslandWorld === "function") closeIslandWorld();
    if (typeof openPartySpecialMode === "function") openPartySpecialMode(mode);
    return;
  }
  startPartyMiniMode(mode, false);
}

function renderPartyChat(title, body) {
  title.textContent = "💬 坦克岛聊天";
  const rows = loadPartyLocalChat();
  body.innerHTML = `
    <div class="party-chat-note">当前是本机大厅聊天记录；接入多人服务器后可升级为真实世界/队伍频道。</div>
    <div id="party-chat-log" class="party-chat-log">
      ${rows.length ? rows.map(row => `<div><b>${escapePartyHtml(row.name || "我")}</b><span>${escapePartyHtml(row.text)}</span><small>${escapePartyHtml(row.time || "")}</small></div>`).join("") : '<p>还没有消息，先说句话吧。</p>'}
    </div>
    <div class="party-chat-compose">
      <input id="party-chat-input" maxlength="80" placeholder="输入消息…">
      <button id="party-chat-send">发送</button>
    </div>`;
  const input = body.querySelector("#party-chat-input");
  const send = () => {
    const text = input?.value.trim();
    if (!text) return;
    const next = loadPartyLocalChat();
    next.push({name:"我",text,time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})});
    savePartyLocalChat(next);
    renderPartyChat(title, body);
  };
  body.querySelector("#party-chat-send")?.addEventListener("click", send);
  input?.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
}

function renderPartyTeam(title, body) {
  title.textContent = "👥 组队";
  const size = Math.max(1, Math.min(4, Number(partyHubData.teamSize) || 1));
  body.innerHTML = `
    <div class="party-team-summary"><b>本地队伍预设 · ${size}/4</b><small>真实好友邀请和房间同步需要多人服务器；这里先完成组队框和队伍预设。</small></div>
    <div class="party-team-slots">
      ${Array.from({length:4},(_,i)=>`<div class="${i<size?"filled":""}"><strong>${i===0?"🪖":"🤖"}</strong><b>${i===0?"我":i<size?"预设队友 "+i:"空位"}</b><small>${i===0?"队长":i<size?"本地预设":"等待加入"}</small></div>`).join("")}
    </div>
    <div class="party-team-actions">
      <button data-team-change="add" ${size>=4?"disabled":""}>＋ 添加队友位</button>
      <button data-team-change="remove" ${size<=1?"disabled":""}>－ 减少队友位</button>
      <button disabled>邀请好友 · 待服务器</button>
    </div>`;
  body.querySelectorAll("[data-team-change]").forEach(btn => btn.onclick = () => {
    partyHubData.teamSize = btn.dataset.teamChange === "add" ? Math.min(4,size+1) : Math.max(1,size-1);
    savePartyHubData();
    renderPartyTeam(title, body);
  });
}

function renderPartyCreate(title, body) {
  title.textContent = "🛠 创作";
  const draft = loadPartyCreation();
  body.innerHTML = `
    <div class="party-create-card">
      <b>地图创作草稿</b>
      <label>地图名称<input id="party-create-name" maxlength="24" value="${escapePartyHtml(draft.name)}"></label>
      <label>主题<select id="party-create-theme">
        ${["欢乐岛","钢铁基地","海上迷宫","霓虹城市"].map(v=>`<option ${v===draft.theme?"selected":""}>${v}</option>`).join("")}
      </select></label>
      <label>地图大小<select id="party-create-size">
        ${["小型","中型","大型","超大型"].map(v=>`<option ${v===draft.size?"selected":""}>${v}</option>`).join("")}
      </select></label>
      <button id="party-create-save">保存创作草稿</button>
      <small>当前先保存创作参数；后续可继续接可视化墙体、出生点、跳台和任务编辑器。</small>
    </div>`;
  body.querySelector("#party-create-save")?.addEventListener("click", () => {
    const next = {
      name: body.querySelector("#party-create-name")?.value.trim() || "我的坦克地图",
      theme: body.querySelector("#party-create-theme")?.value || "欢乐岛",
      size: body.querySelector("#party-create-size")?.value || "中型",
    };
    localStorage.setItem(PARTY_CREATION_KEY, JSON.stringify(next));
    metaToast("🛠 创作草稿已保存");
  });
}

function renderPartyMap(title, body) {
  title.textContent = "🗺️ 坦克岛地图";
  const places = [
    ["🌳","原始坦克岛中心",250,300],
    ["🏢","坦克大楼",250,190],
    ["🛍️","原始岛商城",120,170],
    ["🎪","游乐园游乐区",900,590],
    ["🧩","巨型剧情迷宫入口",1285,590],
    ["🗼","跑酷塔",390,285],
    ["🎯","射击靶场",350,350],
  ];
  body.innerHTML = `
    <div class="party-map-board">
      <div class="party-map-mini"><span>原始岛</span><i>游乐园</i><em>巨型迷宫</em></div>
      <small>选择地点可快速定位；巨型迷宫会把你送到入口跳台前，不会直接跳过挑战。</small>
    </div>
    <div class="party-map-grid">
      ${places.map(([icon,name,x,y])=>`<button data-map-x="${x}" data-map-y="${y}" data-map-name="${name}"><strong>${icon}</strong><b>${name}</b></button>`).join("")}
    </div>`;
  body.querySelectorAll("[data-map-x]").forEach(btn => btn.onclick = () =>
    teleportPartyMap(Number(btn.dataset.mapX), Number(btn.dataset.mapY), btn.dataset.mapName)
  );
}

function addPartyHubButtons() {
  // 主功能已经统一放到底部快捷栏；顶部只保留宠物/皮肤商城，右侧只保留表情动作。
  ensurePartyCommandDock();
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
      <small>从坦克岛直接进入各种模式 · 每个任务首通500金币，重复通关300金币。</small>
    </div>
    <div class="party-mode-grid">
      <button data-party-mode="story"><strong>💥</strong><b>经典闯关</b><small>主线坦克战斗</small></button>
      <button data-party-mode="soccer"><strong>⚽</strong><b>坦克足球</b><small>推球进门</small></button>
      <button data-party-mode="range"><strong>🎯</strong><b>射击靶场</b><small>命中10个靶</small></button>
      <button data-party-mode="race"><strong>🏁</strong><b>坦克竞速</b><small>检查点竞速</small></button>
      <button data-party-mode="parkour"><strong>🗼</strong><b>跑酷挑战</b><small>前往跑酷塔</small></button>
      <button data-party-mode="treasure"><strong>🗺️</strong><b>寻宝争夺</b><small>抢夺地图宝箱</small></button>
      <button data-party-mode="capture"><strong>🚩</strong><b>据点抢占</b><small>占领中央据点</small></button>
      <button data-party-mode="chaos"><strong>⚡</strong><b>技能大乱斗</b><small>随机技能混战</small></button>
      <button data-party-mode="amusement"><strong>🎪</strong><b>游乐园巡游</b><small>7项坦克游乐设施</small></button>
      <button data-party-mode="giantmaze"><strong>🧩</strong><b>巨型剧情迷宫</b><small>跳跃、剧情节点、找出口</small></button>
      <button data-meta-panel="rank"><strong>🏅</strong><b>排位模式</b><small>排位足球 / 靶场 / 竞速</small></button>
    </div>`;

  body.querySelectorAll("[data-party-mode]").forEach(btn => {
    const mode = btn.dataset.partyMode;
    btn.classList.toggle("selected", mode === partyHubData.lastMode);
    btn.onclick = () => {
      partyHubData.lastMode = mode;
      savePartyHubData();
      renderPartyModes(title, body);
      setPartyDockVisible(!!islandWorldActive);
      metaToast(`🎮 已选择：${partyModeLabel(mode)}`);
    };
  });
  const start = document.createElement("button");
  start.className = "party-mode-start";
  start.textContent = `▶ 开始游戏 · ${partyModeLabel()}`;
  start.onclick = startSelectedPartyMode;
  body.appendChild(start);
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
    ["🎡","摩天轮","原始坦克岛全景地标"],
    ["🏛️","坦克博物馆","收藏与历史展示"],
    ["☕","海景咖啡馆","休闲区域"],
    ["🌳","中央草坪","下车散步与动作"],
    ["🗼","跑酷塔","跑酷挑战"],
    ["⚽","足球场","坦克足球"],
    ["🎯","射击靶场","射击挑战"],
    ["🎪","游乐园游乐区","独立玩法区，从模式选择进入"],
    ["🧩","巨型剧情迷宫","独立剧情迷宫，从模式选择进入"],
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
  if (["modes","rank","scenic","online","backpack","chat","team","create","map"].includes(type)) {
    const modal=document.getElementById("meta-modal");
    const title=document.getElementById("meta-modal-title");
    const body=document.getElementById("meta-modal-body");
    if(!modal||!title||!body)return;
    modal.classList.remove("hidden");
    if(type==="modes")renderPartyModes(title,body);
    else if(type==="rank")renderPartyRank(title,body);
    else if(type==="scenic")renderPartyScenic(title,body);
    else if(type==="online")renderPartyOnline(title,body);
    else if(type==="backpack")renderPartyBackpack(title,body);
    else if(type==="chat")renderPartyChat(title,body);
    else if(type==="team")renderPartyTeam(title,body);
    else if(type==="create")renderPartyCreate(title,body);
    else renderPartyMap(title,body);
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

const startIslandWorldPartyDockBase = startIslandWorld;
startIslandWorld = function() {
  const result = startIslandWorldPartyDockBase();
  setPartyDockVisible(true);
  return result;
};

const closeIslandWorldPartyDockBase = closeIslandWorld;
closeIslandWorld = function() {
  setPartyDockVisible(false);
  return closeIslandWorldPartyDockBase();
};

addPartyHubButtons();
ensurePartyCommandDock();
setPartyDockVisible(!!islandWorldActive);
