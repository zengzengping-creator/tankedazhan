import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = process.env.MAPS_FILE || path.join(__dirname,"data","maps.json");
const ORDERS_FILE = process.env.ORDERS_FILE || path.join(__dirname,"data","orders.json");
const PORT = Number(process.env.PORT || 8787);
const PAYMENT_CHECKOUT_URL = String(process.env.PAYMENT_CHECKOUT_URL || "").trim();
const PAYMENT_WEBHOOK_SECRET = String(process.env.PAYMENT_WEBHOOK_SECRET || "").trim();

const RECHARGE_PACKS = [
  {id:"r1", yuan:1, baseTankCoins:100, bonusTankCoins:0},
  {id:"r6", yuan:6, baseTankCoins:600, bonusTankCoins:0},
  {id:"r18", yuan:18, baseTankCoins:1800, bonusTankCoins:0},
  {id:"r30", yuan:30, baseTankCoins:3000, bonusTankCoins:300},
  {id:"r68", yuan:68, baseTankCoins:6800, bonusTankCoins:1000},
  {id:"r128", yuan:128, baseTankCoins:12800, bonusTankCoins:2500}
];

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
  const baseTankCoins=Number(order.baseTankCoins ?? order.coins ?? 0);
  const bonusTankCoins=Number(order.bonusTankCoins ?? 0);
  const totalTankCoins=Number(order.totalTankCoins ?? (baseTankCoins+bonusTankCoins));
  return {
    id:order.id,playerId:order.playerId,playerName:order.playerName,
    packId:order.packId,yuan:order.yuan,
    baseTankCoins,bonusTankCoins,totalTankCoins,
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

app.get("/api/health",(req,res)=>res.json({ok:true,maps:maps.length,teams:teams.size,now:new Date().toISOString()}));

app.get("/api/recharge/config",(req,res)=>{
  res.json({
    rate:"1元=100坦克币",
    exchange:{mid:"5坦克币=1中级坦克币",high:"10坦克币=1高级坦克币"},
    firstRechargeDouble:true,
    paymentConfigured:!!(PAYMENT_CHECKOUT_URL&&PAYMENT_WEBHOOK_SECRET),
    packs:RECHARGE_PACKS
  });
});

app.post("/api/recharge/orders",(req,res)=>{
  const playerId=safeText(req.body?.playerId,100);
  const playerName=safeText(req.body?.playerName,24)||"车长";
  const pack=RECHARGE_PACKS.find(p=>p.id===safeText(req.body?.packId,20));
  if(!playerId)return res.status(400).json({error:"缺少玩家ID"});
  if(!pack)return res.status(400).json({error:"充值套餐不存在"});

  const order={
    id:"ord-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9),
    playerId,playerName,packId:pack.id,yuan:pack.yuan,
    baseTankCoins:pack.baseTankCoins,
    bonusTankCoins:pack.bonusTankCoins,
    totalTankCoins:pack.baseTankCoins+pack.bonusTankCoins,
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
    .filter(o=>o.playerId===playerId)
    .slice(-30).reverse().map(publicRechargeOrder);
  res.json({orders});
});

app.get("/api/recharge/orders/:id",(req,res)=>{
  const playerId=safeText(req.query.playerId,100);
  const order=rechargeOrders.find(o=>o.id===req.params.id&&o.playerId===playerId);
  if(!order)return res.status(404).json({error:"订单不存在"});
  res.json({order:publicRechargeOrder(order)});
});

app.post("/api/recharge/orders/:id/claim",(req,res)=>{
  const playerId=safeText(req.body?.playerId,100);
  const order=rechargeOrders.find(o=>o.id===req.params.id&&o.playerId===playerId);
  if(!order)return res.status(404).json({error:"订单不存在"});
  if(order.status==="claimed")return res.status(409).json({error:"该订单已经领取"});
  if(order.status!=="paid")return res.status(409).json({error:"订单尚未支付"});
  order.status="claimed";
  order.claimedAt=new Date().toISOString();
  saveRechargeOrders();
  res.json({ok:true,tankCoins:Number(order.totalTankCoins||0),order:publicRechargeOrder(order)});
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
    const hadEarlierPaid=rechargeOrders.some(o=>
      o!==order && o.playerId===order.playerId && (o.status==="paid"||o.status==="claimed")
    );
    const base=Number(order.baseTankCoins ?? order.coins ?? 0);
    const bonus=Number(order.bonusTankCoins ?? 0);
    order.firstDouble=!hadEarlierPaid;
    order.totalTankCoins=base*(order.firstDouble?2:1)+bonus;
    order.status="paid";
    order.paidAt=new Date().toISOString();
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
