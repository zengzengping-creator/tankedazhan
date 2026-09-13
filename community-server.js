// 坦克派对在线社区 / 组队客户端。
// GitHub Pages 只负责前端；服务器地址可在组队或模组面板中配置。

const TANK_PARTY_SERVER_URL_KEY = "tankPartyServerUrl_v1";
const TANK_PARTY_PLAYER_KEY = "tankPartyPlayer_v1";

let teamSocket = null;
let teamConnected = false;
let teamState = null;
let teamListeners = [];
let teamPendingHello = false;

function getCommunityServerUrl(){
  return String(globalThis.TANK_PARTY_SERVER_URL || localStorage.getItem(TANK_PARTY_SERVER_URL_KEY) || "").trim().replace(/\/$/,"");
}

function setCommunityServerUrl(url){
  const value=String(url||"").trim().replace(/\/$/,"");
  if(value)localStorage.setItem(TANK_PARTY_SERVER_URL_KEY,value);
  else localStorage.removeItem(TANK_PARTY_SERVER_URL_KEY);
  return value;
}

function getCommunityPlayer(){
  let data=null;
  try{data=JSON.parse(localStorage.getItem(TANK_PARTY_PLAYER_KEY)||"null");}catch(_){}
  if(!data||!data.id){
    data={
      id:globalThis.crypto?.randomUUID?.() || ("p-"+Date.now()+"-"+Math.random().toString(36).slice(2,8)),
      name:"车长"+Math.floor(1000+Math.random()*9000)
    };
    localStorage.setItem(TANK_PARTY_PLAYER_KEY,JSON.stringify(data));
  }
  return data;
}

function setCommunityPlayerName(name){
  const p=getCommunityPlayer();
  p.name=String(name||"").trim().slice(0,18)||p.name;
  localStorage.setItem(TANK_PARTY_PLAYER_KEY,JSON.stringify(p));
  return p;
}

async function communityFetch(path,options={}){
  const base=getCommunityServerUrl();
  if(!base)throw new Error("服务器地址未配置");
  const res=await fetch(base+path,{
    ...options,
    headers:{"Content-Type":"application/json",...(options.headers||{})}
  });
  let data=null;
  try{data=await res.json();}catch(_){}
  if(!res.ok)throw new Error(data?.error||("服务器错误 "+res.status));
  return data;
}

async function searchCommunityMapsOnline(name){
  const q=encodeURIComponent(String(name||"").trim());
  const data=await communityFetch("/api/maps?name="+q);
  return Array.isArray(data?.maps)?data.maps:[];
}

async function publishCommunityMapOnline(map,author){
  const data=await communityFetch("/api/maps",{
    method:"POST",
    body:JSON.stringify({map,author:String(author||getCommunityPlayer().name).slice(0,18)})
  });
  return data?.map||null;
}

async function checkCommunityServer(){
  try{
    const data=await communityFetch("/api/health");
    return {ok:true,data};
  }catch(error){
    return {ok:false,error:error.message};
  }
}

function teamWebSocketUrl(){
  const base=getCommunityServerUrl();
  if(!base)return "";
  return base.replace(/^https:/,"wss:").replace(/^http:/,"ws:")+"/ws";
}

function emitTeamEvent(event){
  for(const fn of [...teamListeners]){
    try{fn(event);}catch(_){}
  }
}

function onTeamServerEvent(fn){
  if(typeof fn!=="function")return ()=>{};
  teamListeners.push(fn);
  return ()=>{teamListeners=teamListeners.filter(x=>x!==fn);};
}

function sendTeamMessage(payload){
  if(!teamSocket||teamSocket.readyState!==WebSocket.OPEN)throw new Error("组队服务器未连接");
  teamSocket.send(JSON.stringify(payload));
}

function ensureTeamConnection(){
  if(teamSocket&&teamSocket.readyState===WebSocket.OPEN)return Promise.resolve(true);
  if(teamSocket&&teamSocket.readyState===WebSocket.CONNECTING){
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error("服务器连接超时")),7000);
      const off=onTeamServerEvent(ev=>{
        if(ev.type==="connected"){clearTimeout(timeout);off();resolve(true);}
        if(ev.type==="socket_error"){clearTimeout(timeout);off();reject(new Error(ev.message||"服务器连接失败"));}
      });
    });
  }
  const url=teamWebSocketUrl();
  if(!url)return Promise.reject(new Error("服务器地址未配置"));

  return new Promise((resolve,reject)=>{
    let settled=false;
    try{teamSocket=new WebSocket(url);}catch(error){reject(error);return;}
    const timer=setTimeout(()=>{
      if(settled)return;
      settled=true;
      try{teamSocket.close();}catch(_){}
      reject(new Error("服务器连接超时"));
    },7000);

    teamSocket.onopen=()=>{
      teamConnected=true;
      const p=getCommunityPlayer();
      teamPendingHello=true;
      sendTeamMessage({type:"hello",playerId:p.id,name:p.name});
      clearTimeout(timer);
      if(!settled){settled=true;resolve(true);}
      emitTeamEvent({type:"connected"});
    };
    teamSocket.onmessage=(event)=>{
      let msg=null;
      try{msg=JSON.parse(event.data);}catch(_){return;}
      if(msg.type==="team_state")teamState=msg.team||null;
      if(msg.type==="left_team")teamState=null;
      if(msg.type==="hello_ack")teamPendingHello=false;
      emitTeamEvent(msg);
    };
    teamSocket.onerror=()=>{
      emitTeamEvent({type:"socket_error",message:"WebSocket连接失败"});
      if(!settled){
        clearTimeout(timer);settled=true;reject(new Error("服务器连接失败"));
      }
    };
    teamSocket.onclose=()=>{
      teamConnected=false;teamSocket=null;
      emitTeamEvent({type:"disconnected"});
    };
  });
}

async function createOnlineTeam(){
  await ensureTeamConnection();
  sendTeamMessage({type:"create_team"});
}
async function joinOnlineTeam(code){
  await ensureTeamConnection();
  sendTeamMessage({type:"join_team",code:String(code||"").trim().toUpperCase()});
}
function leaveOnlineTeam(){
  if(teamSocket?.readyState===WebSocket.OPEN)sendTeamMessage({type:"leave_team"});
}
function setOnlineTeamReady(ready){
  sendTeamMessage({type:"ready",ready:!!ready});
}
function startOnlineTeamGame(mode){
  sendTeamMessage({type:"start_game",mode:String(mode||"story")});
}
function getOnlineTeamState(){return teamState;}
function isTeamServerConnected(){return teamConnected;}

Object.assign(globalThis,{
  getCommunityServerUrl,setCommunityServerUrl,getCommunityPlayer,setCommunityPlayerName,
  searchCommunityMapsOnline,publishCommunityMapOnline,checkCommunityServer,
  ensureTeamConnection,onTeamServerEvent,createOnlineTeam,joinOnlineTeam,leaveOnlineTeam,
  setOnlineTeamReady,startOnlineTeamGame,getOnlineTeamState,isTeamServerConnected
});
