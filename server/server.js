import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = process.env.MAPS_FILE || path.join(__dirname,"data","maps.json");
const ORDERS_FILE = process.env.ORDERS_FILE || path.join(__dirname,"data","orders.json");
const VIP_CLAIMS_FILE = process.env.VIP_CLAIMS_FILE || path.join(__dirname,"data","vip-claims.json");
const SERVER_EVENT_FILE = process.env.SERVER_EVENT_FILE || path.join(__dirname,"data","server-event.json");
const PORT = Number(process.env.PORT || 8787);
const PAYMENT_CHECKOUT_URL = String(process.env.PAYMENT_CHECKOUT_URL || "").trim();
const PAYMENT_WEBHOOK_SECRET = String(process.env.PAYMENT_WEBHOOK_SECRET || "").trim();

const RECHARGE_PACKS = [
  {id:"r1", yuan:1, baseTankCoins:2000, bonusTankCoins:0, baseCoins:10000, bonusCoins:0},
  {id:"r6", yuan:6, baseTankCoins:12000, bonusTankCoins:0, baseCoins:60000, bonusCoins:0},
  {id:"r18", yuan:18, baseTankCoins:36000, bonusTankCoins:0, baseCoins:180000, bonusCoins:0},
  {id:"r30", yuan:30, baseTankCoins:60000, bonusTankCoins:6000, baseCoins:300000, bonusCoins:30000},
  {id:"r68", yuan:68, baseTankCoins:136000, bonusTankCoins:20000, baseCoins:680000, bonusCoins:100000},
  {id:"r128", yuan:128, baseTankCoins:256000, bonusTankCoins:50000, baseCoins:1280000, bonusCoins:250000}
];

const VIP_CONFIG = {
  priceYuan:12,
  firstDays:60,
  renewalDays:30,
  dailyTankCoins:1,
  rewardHighTankCoins:12,
  title:"限时VIP",
  shopDiscount:5,
  boxDiscount:0
};
const VIP_DAY_MS = 24*60*60*1000;

const SERVER_EVENT_CONFIG = {
  id:"players-1000-v1",
  targetPlayers:1000,
  reward:{
    allSkins:true,
    tankCoins:100000,
    coins:200000,
    ultimateTankCoins:100000,
    highTankCoins:50000
  }
};

const app = express();
app.use(express.json({limit:"256kb"}));
app.use((req,res,next)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  if(req.method==="OPTIONS")return res.sendStatus(204);
  next();
});

function clamp(n,min,max){return Math.max(min,Math.min(max,Number(n)||0));}
function safeText(v,max=80){return String(v??"").trim().slice(0,max);}

function normalizeMap(raw={}){
  const width=clamp(raw.width||760,520,900);
  const height=clamp(raw.height||440,320,560);
  const walls=Array.isArray(raw.walls)?raw.walls.slice(0,80).map(w=>({
    x:clamp(w.x,0,width),y:clamp(w.y,0,height),
    w:clamp(w.w||18,8,width),h:clamp(w.h||18,8,height)
  })):[];
  const gaps=Array.isArray(raw.gaps)?raw.gaps.slice(0,30).map(g=>({
    x:clamp(g.x,0,width),y:clamp(g.y,0,height),
    w:clamp(g.w||30,12,width),h:clamp(g.h||30,12,height)
  })):[];
  const pickups=Array.isArray(raw.pickups)?raw.pickups.slice(0,16).map(p=>({
    x:clamp(p.x,20,width-20),y:clamp(p.y,20,height-20)
  })):[];
  return {
    id:safeText(raw.id,64)||("map-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7)),
    name:safeText(raw.name,30)||"未命名地图",
    author:safeText(raw.author,24)||"匿名作者",
    icon:safeText(raw.icon,4)||"🧩",
    desc:safeText(raw.desc,120)||"玩家创作地图",
    difficulty:safeText(raw.difficulty,12)||"自定义",
    theme:["sea","steel","neon","party"].includes(raw.theme)?raw.theme:"party",
    width,height,
    spawn:{x:clamp(raw.spawn?.x||45,20,width-20),y:clamp(raw.spawn?.y||height-45,20,height-20)},
    goal:{x:clamp(raw.goal?.x||width-45,20,width-20),y:clamp(raw.goal?.y||45,20,height-20),r:clamp(raw.goal?.r||25,18,40)},
    walls,gaps,pickups,
    plays:Math.max(0,Math.floor(Number(raw.plays)||0)),
    createdAt:safeText(raw.createdAt,40)||new Date().toISOString()
  };
}

let maps=[];
function loadMaps(){
  try{
    const parsed=JSON.parse(fs.readFileSync(DATA_FILE,"utf8"));
    maps=Array.isArray(parsed)?parsed.map(normalizeMap):[];
  }catch(_){maps=[];}
}
function saveMaps(){
  try{
    fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true});
    fs.writeFileSync(DATA_FILE,JSON.stringify(maps,null,2));
  }catch(err){
    console.warn("Map persistence unavailable:",err.message);
  }
}
loadMaps();

let rechargeOrders=[];
function loadRechargeOrders(){
  try{
    const parsed=JSON.parse(fs.readFileSync(ORDERS_FILE,"utf8"));
    rechargeOrders=Array.isArray(parsed)?parsed:[];
  }catch(_){rechargeOrders=[];}
}
function saveRechargeOrders(){
  try{
    fs.mkdirSync(path.dirname(ORDERS_FILE),{recursive:true});
    fs.writeFileSync(ORDERS_FILE,JSON.stringify(rechargeOrders.slice(-3000),null,2));
  }catch(err){
    console.warn("Order persistence unavailable:",err.message);
  }
}
function publicRechargeOrder(order){
  const baseTankCoins=Number(order.baseTankCoins ?? 0);
  const bonusTankCoins=Number(order.bonusTankCoins ?? 0);
  const totalTankCoins=Number(order.totalTankCoins ?? (baseTankCoins+bonusTankCoins));
  const baseCoins=Number(order.baseCoins ?? 0);
  const bonusCoins=Number(order.bonusCoins ?? 0);
  const totalCoins=Number(order.totalCoins ?? (baseCoins+bonusCoins));
  return {
    id:order.id,playerId:order.playerId,playerName:order.playerName,
    kind:order.kind||"recharge",packId:order.packId,yuan:order.yuan,
    rewardType:order.rewardType||"tankCoins",
    baseTankCoins,bonusTankCoins,totalTankCoins,
    baseCoins,bonusCoins,totalCoins,
    highTankCoins:Number(order.highTankCoins||0),
    durationDays:Number(order.durationDays||0),
    expiresAt:order.expiresAt||"",
    firstDouble:!!order.firstDouble,
    status:order.status,
    createdAt:order.createdAt,paidAt:order.paidAt||"",claimedAt:order.claimedAt||"",
    checkoutUrl:order.checkoutUrl||""
  };
}
function makeCheckoutUrl(order){
  if(!PAYMENT_CHECKOUT_URL)return "";
  try{
    const u=new URL(PAYMENT_CHECKOUT_URL);
    u.searchParams.set("orderId",order.id);
    u.searchParams.set("amountFen",String(order.yuan*100));
    u.searchParams.set("playerId",order.playerId);
    return u.toString();
  }catch(_){return "";}
}
loadRechargeOrders();

let vipClaims=[];
function loadVipClaims(){
  try{
    const rows=JSON.parse(fs.readFileSync(VIP_CLAIMS_FILE,"utf8"));
    vipClaims=Array.isArray(rows)?rows:[];
  }catch(_){vipClaims=[];}
}
function saveVipClaims(){
  try{
    fs.mkdirSync(path.dirname(VIP_CLAIMS_FILE),{recursive:true});
    fs.writeFileSync(VIP_CLAIMS_FILE,JSON.stringify(vipClaims.slice(-10000),null,2));
  }catch(err){console.warn("VIP daily storage unavailable:",err.message);}
}
loadVipClaims();

function vipDayKey(date=new Date()){
  const p=new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(date);
  const get=(type)=>p.find(v=>v.type===type)?.value||"00";
  return get("year")+"-"+get("month")+"-"+get("day");
}
function paidVipOrders(playerId){
  return rechargeOrders
    .filter(o=>o.playerId===playerId&&o.kind==="vip"&&(o.status==="paid"||o.status==="claimed"))
    .sort((a,b)=>Date.parse(a.paidAt||a.createdAt||0)-Date.parse(b.paidAt||b.createdAt||0));
}
// 历史永久VIP订单迁移：第一张从原支付日计算60天。新续费叠加30天。
function ensureVipTimeline(playerId){
  const orders=paidVipOrders(playerId);
  let previousEnd=0,changed=false;
  orders.forEach((order,i)=>{
    const paidTime=Date.parse(order.paidAt||order.createdAt||"")||Date.now();
    const days=i===0?VIP_CONFIG.firstDays:VIP_CONFIG.renewalDays;
    let expiry=Date.parse(order.expiresAt||"");
    if(!Number.isFinite(expiry)){
      expiry=Math.max(paidTime,previousEnd)+days*VIP_DAY_MS;
      order.expiresAt=new Date(expiry).toISOString();
      changed=true;
    }
    if(order.durationDays!==days){order.durationDays=days;changed=true;}
    previousEnd=Math.max(previousEnd,expiry);
  });
  if(changed)saveRechargeOrders();
  return orders;
}
function vipInfoForPlayer(playerId){
  const orders=ensureVipTimeline(playerId);
  const last=orders[orders.length-1];
  const expiresAt=last?.expiresAt||"";
  const active=!!last&&Date.parse(expiresAt)>Date.now();
  return {
    active,
    everPurchased:orders.length>0,
    title:active?"VIP会员":"普通车长",
    priceYuan:VIP_CONFIG.priceYuan,
    firstDays:VIP_CONFIG.firstDays,
    renewalDays:VIP_CONFIG.renewalDays,
    dailyTankCoins:VIP_CONFIG.dailyTankCoins,
    rewardHighTankCoins:VIP_CONFIG.rewardHighTankCoins,
    shopDiscount:active?VIP_CONFIG.shopDiscount:0,
    boxDiscount:active?VIP_CONFIG.boxDiscount:0,
    expiresAt,
    remainingDays:active?Math.ceil((Date.parse(expiresAt)-Date.now())/VIP_DAY_MS):0,
    dailyClaimed:vipClaims.some(x=>x.playerId===playerId&&x.date===vipDayKey()),
    unclaimedOrderIds:orders.filter(o=>o.status==="paid").map(o=>o.id)
  };
}


let serverEventState={entrants:[],claims:[]};
function loadServerEventState(){
  try{
    const parsed=JSON.parse(fs.readFileSync(SERVER_EVENT_FILE,"utf8"));
    serverEventState={
      entrants:Array.isArray(parsed?.entrants)?parsed.entrants:[],
      claims:Array.isArray(parsed?.claims)?parsed.claims:[]
    };
  }catch(_){serverEventState={entrants:[],claims:[]};}
}
function saveServerEventState(){
  try{
    fs.mkdirSync(path.dirname(SERVER_EVENT_FILE),{recursive:true});
    fs.writeFileSync(SERVER_EVENT_FILE,JSON.stringify(serverEventState,null,2));
  }catch(err){console.warn("Server event persistence unavailable:",err.message);}
}
function serverEventStatus(playerId=""){
  const count=serverEventState.entrants.length;
  return {
    id:SERVER_EVENT_CONFIG.id,
    targetPlayers:SERVER_EVENT_CONFIG.targetPlayers,
    entrants:count,
    unlocked:count>=SERVER_EVENT_CONFIG.targetPlayers,
    claimed:!!playerId&&serverEventState.claims.some(x=>x.playerId===playerId),
    reward:SERVER_EVENT_CONFIG.reward
  };
}
loadServerEventState();

app.get("/api/event/server-milestone",(req,res)=>{
  const playerId=safeText(req.query.playerId,100);
  res.json({event:serverEventStatus(playerId)});
});

app.post("/api/event/server-milestone/enter",(req,res)=>{
  const playerId=safeText(req.body?.playerId,100);
  const playerName=safeText(req.body?.playerName,24)||"车长";
  if(!playerId)return res.status(400).json({error:"缺少玩家ID"});
  if(!serverEventState.entrants.some(x=>x.playerId===playerId)){
    serverEventState.entrants.push({playerId,playerName,firstSeenAt:new Date().toISOString()});
    saveServerEventState();
  }
  res.json({ok:true,event:serverEventStatus(playerId)});
});

app.post("/api/event/server-milestone/claim",(req,res)=>{
  const playerId=safeText(req.body?.playerId,100);
  if(!playerId)return res.status(400).json({error:"缺少玩家ID"});
  const status=serverEventStatus(playerId);
  if(!status.unlocked)return res.status(403).json({error:"全服人数还没有达到1000人"});
  if(status.claimed)return res.status(409).json({error:"该活动奖励已经领取"});
  if(!serverEventState.entrants.some(x=>x.playerId===playerId)){
    return res.status(403).json({error:"请先进入游戏登记活动资格"});
  }
  serverEventState.claims.push({playerId,claimedAt:new Date().toISOString()});
  saveServerEventState();
  res.json({ok:true,reward:SERVER_EVENT_CONFIG.reward,event:serverEventStatus(playerId)});
});

app.get("/api/health",(req,res)=>res.json({
  ok:true,maps:maps.length,teams:teams.size,now:new Date().toISOString(),
  features:{teams:true,maps:true,recharge:true,vip:true,event:true,paymentConfigured:!!(PAYMENT_CHECKOUT_URL&&PAYMENT_WEBHOOK_SECRET)}
}));

app.get("/api/vip",(req,res)=>{
  const playerId=safeText(req.query.playerId,100);
  if(!playerId)return res.status(400).json({error:"缺少玩家ID"});
  res.json({vip:vipInfoForPlayer(playerId),config:VIP_CONFIG});
});

app.post("/api/vip/order",(req,res)=>{
  const playerId=safeText(req.body?.playerId,100);
  const playerName=safeText(req.body?.playerName,24)||"车长";
  if(!playerId)return res.status(400).json({error:"缺少玩家ID"});
  const existing=rechargeOrders.find(o=>o.playerId===playerId&&o.kind==="vip"&&o.status==="pending");
  if(existing)return res.json({order:publicRechargeOrder(existing),paymentConfigured:!!existing.checkoutUrl,alreadyExists:true});

  const history=ensureVipTimeline(playerId);
  const durationDays=history.length?VIP_CONFIG.renewalDays:VIP_CONFIG.firstDays;
  const order={
    id:"vip-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9),
    kind:"vip",playerId,playerName,packId:"vip12",yuan:VIP_CONFIG.priceYuan,
    baseTankCoins:0,bonusTankCoins:0,totalTankCoins:0,
    highTankCoins:VIP_CONFIG.rewardHighTankCoins,durationDays,
    firstDouble:false,status:"pending",createdAt:new Date().toISOString()
  };
  order.checkoutUrl=makeCheckoutUrl(order);
  rechargeOrders.push(order);saveRechargeOrders();
  res.status(201).json({order:publicRechargeOrder(order),paymentConfigured:!!order.checkoutUrl});
});

app.post("/api/vip/claim",(req,res)=>{
  const playerId=safeText(req.body?.playerId,100);
  const orderId=safeText(req.body?.orderId,100);
  if(!playerId)return res.status(400).json({error:"缺少玩家ID"});
  const eligible=ensureVipTimeline(playerId).filter(o=>o.status==="paid");
  const order=orderId?eligible.find(o=>o.id===orderId):eligible[0];
  if(!order)return res.status(409).json({error:"没有待领取的VIP返还奖励"});
  order.status="claimed";order.claimedAt=new Date().toISOString();saveRechargeOrders();
  res.json({
    ok:true,highTankCoins:Number(order.highTankCoins||VIP_CONFIG.rewardHighTankCoins),
    vip:vipInfoForPlayer(playerId),order:publicRechargeOrder(order)
  });
});

app.post("/api/vip/daily-claim",(req,res)=>{
  const playerId=safeText(req.body?.playerId,100);
  if(!playerId)return res.status(400).json({error:"缺少玩家ID"});
  const vip=vipInfoForPlayer(playerId);
  if(!vip.active)return res.status(403).json({error:"VIP未开通或已到期"});
  if(vip.dailyClaimed)return res.status(409).json({error:"今天已经领取过VIP坦克币"});
  vipClaims.push({playerId,date:vipDayKey(),claimedAt:new Date().toISOString()});
  saveVipClaims();
  res.json({ok:true,tankCoins:VIP_CONFIG.dailyTankCoins,vip:vipInfoForPlayer(playerId)});
});

app.get("/api/recharge/config",(req,res)=>{
  res.json({
    rate:"1元=2000坦克币 或 10000金币",
    exchange:{
      coins:"1坦克币=5金币，双向等值兑换",
      basicBox:"1坦克币=1次普通坦克盲盒",
      crewBox:"1坦克币=1次乘员盲盒",
      midBox:"1中级坦克币=1次中级盲盒",
      highBox:"1高级坦克币=1次高级盲盒",
      midHigh:"2中级坦克币=1高级坦克币，1高级坦克币=2中级坦克币"
    },
    firstRechargeDouble:true,
    paymentConfigured:!!(PAYMENT_CHECKOUT_URL&&PAYMENT_WEBHOOK_SECRET),
    packs:RECHARGE_PACKS
  });
});

app.post("/api/recharge/orders",(req,res)=>{
  const playerId=safeText(req.body?.playerId,100);
  const playerName=safeText(req.body?.playerName,24)||"车长";
  const pack=RECHARGE_PACKS.find(p=>p.id===safeText(req.body?.packId,20));
  const rewardType=safeText(req.body?.rewardType,20)==="coins"?"coins":"tankCoins";
  if(!playerId)return res.status(400).json({error:"缺少玩家ID"});
  if(!pack)return res.status(400).json({error:"充值套餐不存在"});

  const order={
    id:"ord-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9),
    kind:"recharge",playerId,playerName,packId:pack.id,yuan:pack.yuan,rewardType,
    baseTankCoins:pack.baseTankCoins,
    bonusTankCoins:pack.bonusTankCoins,
    totalTankCoins:pack.baseTankCoins+pack.bonusTankCoins,
    baseCoins:pack.baseCoins,
    bonusCoins:pack.bonusCoins,
    totalCoins:pack.baseCoins+pack.bonusCoins,
    firstDouble:false,
    status:"pending",createdAt:new Date().toISOString()
  };
  order.checkoutUrl=makeCheckoutUrl(order);
  rechargeOrders.push(order);
  saveRechargeOrders();
  res.status(201).json({
    order:publicRechargeOrder(order),
    paymentConfigured:!!order.checkoutUrl
  });
});

app.get("/api/recharge/orders",(req,res)=>{
  const playerId=safeText(req.query.playerId,100);
  if(!playerId)return res.status(400).json({error:"缺少玩家ID"});
  const orders=rechargeOrders
    .filter(o=>o.playerId===playerId&&(o.kind||"recharge")==="recharge")
    .slice(-30).reverse().map(publicRechargeOrder);
  res.json({orders});
});

app.get("/api/recharge/orders/:id",(req,res)=>{
  const playerId=safeText(req.query.playerId,100);
  const order=rechargeOrders.find(o=>o.id===req.params.id&&o.playerId===playerId&&(o.kind||"recharge")==="recharge");
  if(!order)return res.status(404).json({error:"订单不存在"});
  res.json({order:publicRechargeOrder(order)});
});

app.post("/api/recharge/orders/:id/claim",(req,res)=>{
  const playerId=safeText(req.body?.playerId,100);
  const order=rechargeOrders.find(o=>o.id===req.params.id&&o.playerId===playerId&&(o.kind||"recharge")==="recharge");
  if(!order)return res.status(404).json({error:"订单不存在"});
  if(order.status==="claimed")return res.status(409).json({error:"该订单已经领取"});
  if(order.status!=="paid")return res.status(409).json({error:"订单尚未支付"});
  order.status="claimed";
  order.claimedAt=new Date().toISOString();
  saveRechargeOrders();
  const rewardType=order.rewardType||"tankCoins";
  res.json({
    ok:true,
    rewardType,
    tankCoins:rewardType==="tankCoins"?Number(order.totalTankCoins||0):0,
    coins:rewardType==="coins"?Number(order.totalCoins||0):0,
    order:publicRechargeOrder(order)
  });
});

app.post("/api/recharge/webhook",(req,res)=>{
  const secret=String(req.headers["x-payment-secret"]||"");
  if(!PAYMENT_WEBHOOK_SECRET||secret!==PAYMENT_WEBHOOK_SECRET){
    return res.status(401).json({error:"支付回调验证失败"});
  }
  const orderId=safeText(req.body?.orderId,100);
  const paid=!!req.body?.paid;
  const order=rechargeOrders.find(o=>o.id===orderId);
  if(!order)return res.status(404).json({error:"订单不存在"});
  if(!paid)return res.status(400).json({error:"支付状态不是成功"});
  if(order.status==="pending"){
    if((order.kind||"recharge")==="vip"){
      order.status="paid";
      order.paidAt=new Date().toISOString();
      // 结算时固定有效期；续费从现有到期时间后再延长30天。
      ensureVipTimeline(order.playerId);
    }else{
      const hadEarlierPaid=rechargeOrders.some(o=>
        o!==order && o.playerId===order.playerId && (o.kind||"recharge")==="recharge" &&
        (o.status==="paid"||o.status==="claimed")
      );
      const baseTank=Number(order.baseTankCoins||0);
      const bonusTank=Number(order.bonusTankCoins||0);
      const baseGold=Number(order.baseCoins||0);
      const bonusGold=Number(order.bonusCoins||0);
      order.firstDouble=!hadEarlierPaid;
      order.totalTankCoins=baseTank*(order.firstDouble?2:1)+bonusTank;
      order.totalCoins=baseGold*(order.firstDouble?2:1)+bonusGold;
      order.status="paid";
      order.paidAt=new Date().toISOString();
    }
    saveRechargeOrders();
  }
  res.json({ok:true,order:publicRechargeOrder(order)});
});

app.get("/api/maps",(req,res)=>{
  const q=safeText(req.query.name,50).toLowerCase();
  let out=maps;
  if(q)out=out.filter(m=>m.name.toLowerCase().includes(q)||m.author.toLowerCase().includes(q));
  out=[...out].sort((a,b)=>(b.plays||0)-(a.plays||0)||String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,40);
  res.json({maps:out});
});

app.get("/api/maps/:id",(req,res)=>{
  const map=maps.find(m=>m.id===req.params.id);
  if(!map)return res.status(404).json({error:"地图不存在"});
  map.plays=(map.plays||0)+1;saveMaps();
  res.json({map});
});

app.post("/api/maps",(req,res)=>{
  try{
    const author=safeText(req.body?.author,24)||"匿名作者";
    const map=normalizeMap({...req.body?.map,author,id:"community-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7)});
    maps.unshift(map);
    maps=maps.slice(0,1000);
    saveMaps();
    res.status(201).json({map});
  }catch(err){
    res.status(400).json({error:"地图数据无效"});
  }
});

const server=http.createServer(app);
const wss=new WebSocketServer({server,path:"/ws"});

const teams=new Map();
const clients=new Map();

function teamCode(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code="";
  do{
    code=Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
  }while(teams.has(code));
  return code;
}

function send(ws,obj){
  if(ws.readyState===1)ws.send(JSON.stringify(obj));
}
function publicTeam(team){
  return {
    code:team.code,
    hostId:team.hostId,
    mode:team.mode,
    members:[...team.members.values()].map(m=>({id:m.id,name:m.name,ready:m.ready,host:m.id===team.hostId}))
  };
}
function broadcastTeam(team){
  const payload={type:"team_state",team:publicTeam(team)};
  for(const member of team.members.values())send(member.ws,payload);
}
function leaveTeam(client){
  if(!client?.teamCode)return;
  const team=teams.get(client.teamCode);
  client.teamCode="";
  if(!team)return;
  team.members.delete(client.id);
  if(!team.members.size){
    teams.delete(team.code);return;
  }
  if(team.hostId===client.id)team.hostId=team.members.keys().next().value;
  broadcastTeam(team);
}
function requireTeam(client,ws){
  const team=client?.teamCode?teams.get(client.teamCode):null;
  if(!team)send(ws,{type:"error",message:"你还没有加入队伍"});
  return team;
}

wss.on("connection",(ws)=>{
  const client={id:"",name:"车长",teamCode:"",ws};
  ws.on("message",(buf)=>{
    let msg=null;
    try{msg=JSON.parse(String(buf));}catch(_){return;}
    if(msg.type==="hello"){
      client.id=safeText(msg.playerId,80)||("p-"+Math.random().toString(36).slice(2));
      client.name=safeText(msg.name,18)||"车长";
      clients.set(client.id,client);
      send(ws,{type:"hello_ack",playerId:client.id});
      return;
    }
    if(!client.id){
      send(ws,{type:"error",message:"请先完成玩家连接"});
      return;
    }
    if(msg.type==="create_team"){
      leaveTeam(client);
      const code=teamCode();
      const team={code,hostId:client.id,mode:"story",members:new Map()};
      team.members.set(client.id,{id:client.id,name:client.name,ready:true,ws});
      teams.set(code,team);client.teamCode=code;broadcastTeam(team);return;
    }
    if(msg.type==="join_team"){
      const code=safeText(msg.code,8).toUpperCase();
      const team=teams.get(code);
      if(!team)return send(ws,{type:"error",message:"没有找到这个队伍"});
      if(team.members.size>=4)return send(ws,{type:"error",message:"队伍已经满员"});
      leaveTeam(client);
      team.members.set(client.id,{id:client.id,name:client.name,ready:false,ws});
      client.teamCode=code;broadcastTeam(team);return;
    }
    if(msg.type==="leave_team"){
      leaveTeam(client);send(ws,{type:"left_team"});return;
    }
    if(msg.type==="ready"){
      const team=requireTeam(client,ws);if(!team)return;
      const member=team.members.get(client.id);if(member)member.ready=!!msg.ready;
      broadcastTeam(team);return;
    }
    if(msg.type==="start_game"){
      const team=requireTeam(client,ws);if(!team)return;
      if(team.hostId!==client.id)return send(ws,{type:"error",message:"只有房主可以开始"});
      const notReady=[...team.members.values()].filter(m=>m.id!==team.hostId&&!m.ready);
      if(notReady.length)return send(ws,{type:"error",message:"还有队员没有准备"});
      team.mode=safeText(msg.mode,30)||"story";
      for(const member of team.members.values())send(member.ws,{type:"game_start",mode:team.mode,team:publicTeam(team)});
      return;
    }
  });
  ws.on("close",()=>{
    leaveTeam(client);
    if(client.id)clients.delete(client.id);
  });
});

server.listen(PORT,()=>console.log("Tank Party server listening on",PORT));
