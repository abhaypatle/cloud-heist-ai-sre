const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server,{cors:{origin:"*"}});

const PORT = process.env.PORT || 4000;
const ROUND_TIME = 20;
const TOTAL_ROUNDS = 10;
const MAX_PLAYERS = 50;

const streams = [
  {id:"cloud",name:"Cloud",icon:"☁",accent:"#35d6ff"},
  {id:"devops",name:"DevOps",icon:"⚙",accent:"#ff9f43"},
  {id:"kubernetes",name:"Kubernetes",icon:"◈",accent:"#6c8cff"},
  {id:"devsecops",name:"DevSecOps",icon:"🛡",accent:"#ff5577"},
  {id:"linux",name:"Linux",icon:"⌁",accent:"#67e8a5"},
  {id:"networking",name:"Networking",icon:"⌁",accent:"#b58cff"},
  {id:"terraform",name:"Terraform",icon:"◆",accent:"#a78bfa"},
  {id:"sre",name:"SRE",icon:"◉",accent:"#ffe066"},
  {id:"databases",name:"Databases",icon:"▣",accent:"#ff72c8"},
  {id:"mixed",name:"Mixed Ops",icon:"✦",accent:"#ffffff"}
];

const roles = ["detector","analyst","responder","commander"];

const incidents = [
 {id:"k8s-crash",stream:"kubernetes",service:"checkout-api",severity:"CRITICAL",difficulty:4,title:"CrashLoopBackOff after deployment",brief:"Checkout pods started restarting immediately after v4.8 reached production.",root:"bad-deployment",base:220,risk:1.35,metrics:{cpu:91,memory:82,latency:4200,errors:18.4,rps:12400,db:76},logs:[
 "deployment checkout-api v4.8 started",
 "readiness probe failed: HTTP 503",
 "container exited with code 137",
 "pod checkout-api-7c9 restarted",
 "error: upstream connection reset"
 ],trace:["gateway 18ms","checkout-api 3910ms","redis 42ms","postgres 61ms"],
 diagnosis:[
  ["bad-deployment","Rollback deployment","The failure began immediately after v4.8."],
  ["database","Database saturation","DB is active but not showing the primary spike."],
  ["network","Network outage","Network symptoms do not explain pod restarts."]
 ],actions:[
  ["rollback","Rollback v4.8","bad-deployment",420],
  ["scale","Scale pods","bad-deployment",180],
  ["restart","Restart service","bad-deployment",100]
 ]},
 {id:"db-pool",stream:"databases",service:"orders-db",severity:"HIGH",difficulty:3,title:"Database connection exhaustion",brief:"Requests are timing out while application connections climb toward the database limit.",root:"db-pool",base:190,risk:1.25,metrics:{cpu:72,memory:88,latency:3100,errors:12.2,rps:8400,db:98},logs:[
 "WARN connection pool utilization 96%",
 "ERROR timeout waiting for database connection",
 "active connections: 498/500",
 "slow query detected on orders",
 "application retry count increasing"
 ],trace:["gateway 21ms","orders-api 44ms","postgres 2890ms","redis 12ms"],
 diagnosis:[
  ["db-pool","Database connection exhaustion","Connection pool and DB saturation are the dominant signals."],
  ["deployment","Bad deployment","No deployment event precedes the incident."],
  ["dns","DNS failure","DNS is healthy."]
 ],actions:[
  ["pool","Tune connection pool","db-pool",390],
  ["failover","Fail over database","db-pool",320],
  ["restart","Restart API","db-pool",120]
 ]},
 {id:"redis-memory",stream:"cloud",service:"session-cache",severity:"HIGH",difficulty:3,title:"Cache memory pressure",brief:"Cache memory is approaching its limit and latency is rising.",root:"cache",base:180,risk:1.2,metrics:{cpu:84,memory:97,latency:1900,errors:7.4,rps:11200,db:51},logs:[
 "redis memory usage 97%",
 "eviction rate increasing",
 "WARN maxmemory threshold reached",
 "checkout sessions taking longer",
 "OOM protection active"
 ],trace:["gateway 14ms","api 67ms","redis 1780ms","postgres 44ms"],
 diagnosis:[
  ["cache","Cache memory pressure","Memory and eviction signals align."],
  ["network","Network congestion","No packet-loss spike is present."],
  ["database","Database outage","Database latency remains normal."]
 ],actions:[
  ["cache","Flush stale cache keys","cache",360],
  ["scale","Scale cache node","cache",330],
  ["restart","Restart cache","cache",210]
 ]},
 {id:"dns",stream:"networking",service:"edge-gateway",severity:"CRITICAL",difficulty:4,title:"Regional DNS resolution failure",brief:"Users in one region cannot reliably resolve the public API hostname.",root:"dns",base:240,risk:1.4,metrics:{cpu:43,memory:48,latency:5200,errors:31.7,rps:9200,db:38},logs:[
 "DNS SERVFAIL rate increased",
 "resolver timeout in ap-south",
 "gateway healthy",
 "TLS handshake unavailable for unresolved hosts",
 "regional resolver health degraded"
 ],trace:["dns 4810ms","gateway 12ms","api 33ms"],
 diagnosis:[
  ["dns","DNS resolver failure","Regional resolver errors match the traffic pattern."],
  ["api","API failure","API nodes remain healthy."],
  ["database","Database failure","DB is not on the affected path."]
 ],actions:[
  ["dns","Fail over DNS resolver","dns",460],
  ["route","Route traffic to healthy region","dns",390],
  ["restart","Restart API gateway","dns",80]
 ]},
 {id:"secret",stream:"devsecops",service:"payments",severity:"CRITICAL",difficulty:5,title:"Production secret exposure",brief:"A credential appears in a recent repository commit and may be active.",root:"secret",base:280,risk:1.5,metrics:{cpu:61,memory:55,latency:620,errors:2.1,rps:6200,db:41},logs:[
 "security scanner: credential pattern detected",
 "commit a91c4d2 pushed to main",
 "AWS-style access token pattern found",
 "credential may have production scope",
 "audit event: unusual API access"
 ],trace:["git scanner 9ms","iam audit 32ms","api 41ms"],
 diagnosis:[
  ["secret","Credential exposure","Security scanner and IAM activity point to a leaked secret."],
  ["deployment","Deployment failure","Deployment health is normal."],
  ["network","Network attack","No network anomaly is required to explain the alert."]
 ],actions:[
  ["rotate","Rotate and revoke credential","secret",520],
  ["disable","Disable affected identity","secret",470],
  ["ignore","Ignore until investigation","secret",-300]
 ]},
 {id:"terraform-drift",stream:"terraform",service:"infra-stack",severity:"MEDIUM",difficulty:2,title:"Infrastructure drift detected",brief:"Production infrastructure differs from the declared Terraform state.",root:"drift",base:140,risk:1.1,metrics:{cpu:58,memory:51,latency:340,errors:1.8,rps:4100,db:35},logs:[
 "terraform plan: 7 resources changed",
 "desired replicas: 3",
 "actual replicas: 1",
 "manual console change detected",
 "state checksum differs"
 ],trace:["terraform 24ms","cluster 18ms","api 31ms"],
 diagnosis:[
  ["drift","Terraform infrastructure drift","Plan output directly identifies drift."],
  ["database","Database issue","Database signals are normal."],
  ["dns","DNS issue","No resolver errors."]
 ],actions:[
  ["plan","Review terraform plan","drift",240],
  ["apply","Apply approved Terraform state","drift",380],
  ["ignore","Ignore drift","drift",-180]
 ]},
 {id:"traffic",stream:"sre",service:"public-api",severity:"HIGH",difficulty:3,title:"Unexpected traffic surge",brief:"Request volume doubled and service saturation is spreading.",root:"traffic",base:200,risk:1.25,metrics:{cpu:96,memory:79,latency:2600,errors:9.8,rps:28600,db:69},logs:[
 "requests/sec above 2x baseline",
 "autoscaler reached maximum replicas",
 "CPU saturation detected",
 "queue depth increasing",
 "customer latency SLO breached"
 ],trace:["cdn 15ms","gateway 38ms","api 2210ms","queue 320ms"],
 diagnosis:[
  ["traffic","Traffic surge","RPS and saturation increased together."],
  ["database","DB outage","DB is stressed but not primary."],
  ["dns","DNS failure","DNS resolution is normal."]
 ],actions:[
  ["scale","Scale service capacity","traffic",410],
  ["rate","Enable rate limiting","traffic",340],
  ["restart","Restart API","traffic",70]
 ]},
 {id:"linux-disk",stream:"linux",service:"worker-node-04",severity:"HIGH",difficulty:3,title:"Disk pressure on worker",brief:"A Linux worker is running out of disk space and workloads are being evicted.",root:"disk",base:170,risk:1.2,metrics:{cpu:49,memory:71,latency:880,errors:6.2,rps:5300,db:43},logs:[
 "disk usage /var: 96%",
 "kubelet: DiskPressure=True",
 "container image cleanup failed",
 "pod eviction threshold reached",
 "filesystem inode usage elevated"
 ],trace:["node 12ms","kubelet 24ms","worker 810ms"],
 diagnosis:[
  ["disk","Node disk pressure","Filesystem and kubelet signals agree."],
  ["cpu","CPU saturation","CPU is not the bottleneck."],
  ["network","Network issue","No network evidence."]
 ],actions:[
  ["cleanup","Clean unused images/logs","disk",360],
  ["drain","Drain and replace worker","disk",390],
  ["restart","Restart node","disk",160]
 ]},
 {id:"pipeline",stream:"devops",service:"release-pipeline",severity:"MEDIUM",difficulty:2,title:"Deployment pipeline regression",brief:"A release pipeline is producing unhealthy artifacts after a dependency update.",root:"pipeline",base:150,risk:1.1,metrics:{cpu:52,memory:59,latency:690,errors:4.4,rps:1900,db:28},logs:[
 "build started",
 "dependency lockfile changed",
 "unit tests passed",
 "integration test failed",
 "artifact checksum differs from baseline"
 ],trace:["build 410ms","tests 210ms","artifact 51ms"],
 diagnosis:[
  ["pipeline","Pipeline dependency regression","The lockfile and integration failure correlate."],
  ["database","Database outage","No DB symptoms."],
  ["network","Network outage","Build networking is healthy."]
 ],actions:[
  ["rollback","Rollback dependency lockfile","pipeline",310],
  ["rebuild","Rebuild artifact","pipeline",250],
  ["deploy","Deploy failed artifact","pipeline",-250]
 ]}
];

const rooms = new Map();

function id(){return crypto.randomUUID();}
function code(){let x;do{x=Math.floor(1000+Math.random()*9000).toString()}while(rooms.has(x));return x;}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function shuffle(a){return [...a].sort(()=>Math.random()-.5);}
function pickIncident(room){
  let pool=incidents.filter(x=>room.stream==="mixed"||x.stream===room.stream);
  if(!pool.length)pool=incidents;
  const avg=[...room.players.values()].reduce((s,p)=>s+p.accuracy,0)/(room.players.size||1);
  const target=avg>85?4:avg>70?3:2;
  const candidates=pool.filter(x=>Math.abs(x.difficulty-target)<=1&&!room.used.has(x.id));
  return (candidates.length?shuffle(candidates):shuffle(pool))[0];
}
function publicPlayer(p){
 return {id:p.id,name:p.name,score:p.score,correct:p.correct,wrong:p.wrong,accuracy:p.accuracy,streak:p.streak,bestStreak:p.bestStreak,avgTime:p.times.length?p.times.reduce((a,b)=>a+b,0)/p.times.length:0,role:p.role,ready:p.ready,spectator:p.spectator,xp:p.xp};
}
function snapshot(room){
 return {
  code:room.code,stream:room.stream,mode:room.mode,hostId:room.hostId,
  round:room.round,totalRounds:TOTAL_ROUNDS,phase:room.phase,
  incident:room.incident?{id:room.incident.id,title:room.incident.title,service:room.incident.service,severity:room.incident.severity,brief:room.incident.brief,difficulty:room.incident.difficulty,metrics:room.state,logs:room.incident.logs,trace:room.incident.trace}:null,
  players:[...room.players.values()].map(publicPlayer),
  finished:room.finished,chaos:room.chaos||null
 };
}
function emitRoom(room){io.to(room.code).emit("room:update",snapshot(room));}
function logs(room,items){room.logs=[...room.logs,...items].slice(-80);io.to(room.code).emit("game:logs",room.logs);}
function scorePlayer(p,incident,elapsed){
 const speed=clamp((ROUND_TIME-elapsed)/ROUND_TIME,0,1);
 const streak=Math.min(1.6,1+(p.streak*.12));
 const base=incident.base;
 const value=Math.round(base*(.75+speed*.65)*streak*incident.risk);
 p.score+=value;p.xp+=Math.round(value/5);p.correct++;p.streak++;p.bestStreak=Math.max(p.bestStreak,p.streak);
 p.times.push(elapsed);p.accuracy=Math.round(p.correct/(p.correct+p.wrong)*100);
 return value;
}
function wrong(p){
 p.score=Math.max(0,p.score-25);p.wrong++;p.streak=0;p.accuracy=Math.round(p.correct/(p.correct+p.wrong)*100);
}
function startIncident(room){
 room.used.add(room.incident?.id);
 room.incident=pickIncident(room);room.used.add(room.incident.id);
 room.state={...room.incident.metrics};
 room.phase="diagnose";room.phaseStarted=Date.now();room.answered=new Set();room.diagnosed=new Set();
 room.logs=[...room.incident.logs];
 room.chaos=null;
 io.to(room.code).emit("game:incident",{
  incident:{id:room.incident.id,title:room.incident.title,service:room.incident.service,severity:room.incident.severity,brief:room.incident.brief,difficulty:room.incident.difficulty,metrics:room.state,logs:room.incident.logs,trace:room.incident.trace},
  diagnosis:room.incident.diagnosis.map(x=>({id:x[0],label:x[1],hint:x[2]})),
  round:room.round,totalRounds:TOTAL_ROUNDS
 });
 emitRoom(room);
}
function startRound(room){
 if(room.round>=TOTAL_ROUNDS){finish(room);return}
 room.round++;
 io.to(room.code).emit("game:countdown",{seconds:3});
 setTimeout(()=>startIncident(room),3000);
}
function finish(room){
 room.finished=true;room.phase="finished";
 const board=[...room.players.values()].map(publicPlayer).sort((a,b)=>b.score-a.score);
 io.to(room.code).emit("game:finished",{board,profile:board[0]||null});
 emitRoom(room);
}
function maybeChaos(room){
 if(room.round<3||room.chaos||Math.random()>.42)return;
 const choices=[
  ["traffic-spike","⚠ SECONDARY: Traffic surge","RPS suddenly increases across the API.",{rps:room.state.rps*1.8,cpu:clamp(room.state.cpu+18,0,100),latency:room.state.latency*1.45}],
  ["db-pressure","⚠ SECONDARY: DB pressure","Connection pressure is spreading to the database.",{db:clamp(room.state.db+18,0,100),latency:room.state.latency*1.35}],
  ["dependency","⚠ SECONDARY: Dependency degradation","An external dependency is returning elevated latency.",{latency:room.state.latency*1.55,errors:room.state.errors+4}]
 ];
 const c=choices[Math.floor(Math.random()*choices.length)];
 room.chaos={id:c[0],title:c[1],brief:c[2],resolved:false};
 Object.assign(room.state,c[3]);
 io.to(room.code).emit("game:chaos",room.chaos);
 logs(room,[c[1],c[2]]);
}
function tick(room){
 if(room.finished||!room.incident)return;
 const elapsed=(Date.now()-room.phaseStarted)/1000;
 const d=room.incident.difficulty;
 const noise=(Math.random()-.45)*(d*1.4);
 room.state.cpu=clamp(room.state.cpu+noise,0,100);
 room.state.memory=clamp(room.state.memory+noise*.5,0,100);
 room.state.latency=Math.max(30,room.state.latency+noise*18);
 room.state.errors=Math.max(0,room.state.errors+noise*.05);
 room.state.rps=Math.max(100,room.state.rps+noise*180);
 room.state.db=clamp(room.state.db+noise*.25,0,100);
 io.to(room.code).emit("game:telemetry",room.state);
 io.to(room.code).emit("game:timer",{phase:room.phase,remaining:Math.max(0,ROUND_TIME-elapsed)});
 if(Math.floor(elapsed)===7)maybeChaos(room);
 if(elapsed>=ROUND_TIME){
   room.phase="remediate";
   room.phaseStarted=Date.now();
   io.to(room.code).emit("game:phase",{phase:"remediate"});
 }
}
setInterval(()=>rooms.forEach(tick),1000);

app.get("/health",(req,res)=>res.json({ok:true,service:"cloud-heist",rooms:rooms.size,time:new Date().toISOString()}));
app.get("/api/streams",(req,res)=>res.json(streams));
app.get("/api/incidents",(req,res)=>res.json(incidents.map(x=>({id:x.id,stream:x.stream,title:x.title,difficulty:x.difficulty}))));

io.on("connection",socket=>{
 socket.on("room:create",({name,stream="mixed",playerId,mode="race"})=>{
   if(!name)return;
   const room={code:code(),stream,mode,hostId:socket.id,players:new Map(),round:0,phase:"lobby",finished:false,used:new Set(),logs:[],incident:null};
   room.players.set(socket.id,{id:playerId||id(),socketId:socket.id,name:String(name).slice(0,20),score:0,correct:0,wrong:0,accuracy:0,streak:0,bestStreak:0,times:[],ready:false,role:mode==="team"?roles[0]:"operator",spectator:false,xp:0});
   rooms.set(room.code,room);socket.join(room.code);socket.data.room=room.code;
   socket.emit("room:created",{code:room.code,playerId:[...room.players.values()][0].id});emitRoom(room);
 });
 socket.on("room:join",({code:raw,name,playerId})=>{
   const room=rooms.get(String(raw).trim());
   if(!room||room.finished){socket.emit("error:message","Room unavailable");return}
   if(room.players.size>=MAX_PLAYERS){socket.emit("error:message","Room full");return}
   const existing=[...room.players.values()].find(p=>p.id===playerId);
   if(existing){existing.socketId=socket.id;socket.join(room.code);socket.data.room=room.code;socket.emit("room:joined",{code:room.code,playerId:existing.id});emitRoom(room);return}
   const p={id:playerId||id(),socketId:socket.id,name:String(name||"Operator").slice(0,20),score:0,correct:0,wrong:0,accuracy:0,streak:0,bestStreak:0,times:[],ready:false,role:room.mode==="team"?roles[room.players.size%roles.length]:"operator",spectator:false,xp:0};
   room.players.set(socket.id,p);socket.join(room.code);socket.data.room=room.code;socket.emit("room:joined",{code:room.code,playerId:p.id});emitRoom(room);
 });
 socket.on("room:stream",stream=>{
   const room=rooms.get(socket.data.room);if(!room||room.hostId!==socket.id||room.phase!=="lobby")return;
   room.stream=streams.some(x=>x.id===stream)?stream:"mixed";emitRoom(room);
 });
 socket.on("room:mode",mode=>{
   const room=rooms.get(socket.data.room);if(!room||room.hostId!==socket.id||room.phase!=="lobby")return;
   room.mode=mode==="team"?"team":"race";
   [...room.players.values()].forEach((p,i)=>p.role=room.mode==="team"?roles[i%roles.length]:"operator");
   emitRoom(room);
 });
 socket.on("room:ready",v=>{
   const room=rooms.get(socket.data.room);const p=room?.players.get(socket.id);if(!p)return;p.ready=!!v;emitRoom(room);
 });
 socket.on("room:start",()=>{
   const room=rooms.get(socket.data.room);if(!room||room.hostId!==socket.id||room.phase!=="lobby")return;
   if(room.players.size<2){socket.emit("error:message","At least 2 operators are required");return}
   if(room.mode==="team"&&room.players.size<2){return}
   room.phase="countdown";emitRoom(room);startRound(room);
 });
 socket.on("game:diagnose",answer=>{
   const room=rooms.get(socket.data.room);const p=room?.players.get(socket.id);if(!room||!p||room.phase!=="diagnose"||room.answered.has(p.id))return;
   room.answered.add(p.id);
   const correct=answer===room.incident.root;
   if(correct){
     room.diagnosed.add(p.id);
     p.streak++;
     io.to(socket.id).emit("game:feedback",{ok:true,text:"ROOT CAUSE CONFIRMED — remediation unlocked"});
   }else{
     wrong(p);io.to(socket.id).emit("game:feedback",{ok:false,text:"Incorrect hypothesis — evidence says otherwise"});
   }
   emitRoom(room);
   if(room.diagnosed.size>0){
     room.phase="remediate";room.phaseStarted=Date.now();io.to(room.code).emit("game:phase",{phase:"remediate"});
   }
 });
 socket.on("game:action",action=>{
   const room=rooms.get(socket.data.room);const p=room?.players.get(socket.id);if(!room||!p||room.phase!=="remediate"||room.answered.has("a"+p.id))return;
   room.answered.add("a"+p.id);
   const chosen=room.incident.actions.find(x=>x[0]===action);
   if(!chosen)return;
   const elapsed=(Date.now()-room.phaseStarted)/1000;
   const correct=chosen[2]===room.incident.root&&chosen[3]>0;
   if(correct){
     const gained=scorePlayer(p,room.incident,elapsed);
     Object.assign(room.state,{errors:Math.max(0,room.state.errors*.28),latency:Math.max(60,room.state.latency*.35),cpu:Math.max(20,room.state.cpu*.65)});
     room.phase="resolved";
     io.to(socket.id).emit("game:feedback",{ok:true,text:`INCIDENT RESOLVED +${gained} XP +${gained}`});
     io.to(room.code).emit("game:winner",{name:p.name,score:gained,action:chosen[1]});
     logs(room,[`${p.name} executed ${chosen[1]}`,`SYSTEM RECOVERY: error rate falling`,`INCIDENT RESOLVED`]);
     emitRoom(room);
     setTimeout(()=>startRound(room),1800);
   }else{
     wrong(p);
     io.to(socket.id).emit("game:feedback",{ok:false,text:"Unsafe remediation — system degradation increased"});
     room.state.errors=Math.min(100,room.state.errors+4);
     room.state.latency*=1.25;
     emitRoom(room);
   }
 });
 socket.on("game:chaos-action",action=>{
   const room=rooms.get(socket.data.room);if(!room||!room.chaos)return;
   if(action==="resolve"){room.chaos.resolved=true;room.state.errors*=.7;room.state.latency*=.7;io.to(room.code).emit("game:feedback",{ok:true,text:"Secondary incident contained"});emitRoom(room)}
 });
 socket.on("room:play-again",()=>{
   const room=rooms.get(socket.data.room);if(!room||room.hostId!==socket.id)return;
   room.round=0;room.finished=false;room.phase="lobby";room.used=new Set();room.incident=null;
   room.players.forEach(p=>{p.score=0;p.correct=0;p.wrong=0;p.accuracy=0;p.streak=0;p.bestStreak=0;p.times=[];p.ready=false;p.xp=0});
   emitRoom(room);
 });
 socket.on("disconnect",()=>{
   const room=rooms.get(socket.data.room);if(!room)return;
   const p=room.players.get(socket.id);
   if(p)p.socketId=null;
   room.players.delete(socket.id);
   if(room.hostId===socket.id){const next=[...room.players.values()][0];room.hostId=next?.socketId||room.hostId}
   if(room.players.size===0){setTimeout(()=>{if(rooms.get(room.code)?.players.size===0)rooms.delete(room.code)},30000)}
   else emitRoom(room);
 });
});

server.listen(PORT,"127.0.0.1",()=>console.log(`Cloud Heist server running on http://127.0.0.1:${PORT}`));
