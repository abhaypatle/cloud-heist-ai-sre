import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {io} from "socket.io-client";
import "./style.css";

const API="http://127.0.0.1:4000";
const socket=io(API,{autoConnect:true});
const streams=[
 ["cloud","☁","CLOUD"],["devops","⚙","DEVOPS"],["kubernetes","◈","KUBERNETES"],["devsecops","🛡","DEVSECOPS"],
 ["linux","⌁","LINUX"],["networking","⌁","NETWORKING"],["terraform","◆","TERRAFORM"],["sre","◉","SRE"],["databases","▣","DATABASES"],["mixed","✦","MIXED OPS"]
];
const pid=localStorage.getItem("cloud-heist-player")||crypto.randomUUID();
localStorage.setItem("cloud-heist-player",pid);

function App(){
 const [screen,setScreen]=useState("home"),[name,setName]=useState("Operator"),[code,setCode]=useState(""),[stream,setStream]=useState("mixed"),[mode,setMode]=useState("race");
 const [room,setRoom]=useState(null),[incident,setIncident]=useState(null),[phase,setPhase]=useState("lobby"),[time,setTime]=useState(20);
 const [feedback,setFeedback]=useState(null),[logs,setLogs]=useState([]),[telemetry,setTelemetry]=useState(null),[chaos,setChaos]=useState(null),[board,setBoard]=useState([]);
 const [message,setMessage]=useState("SYSTEM READY"),[ai,setAi]=useState("Analyzing telemetry...");
 const me=room?.players?.find(p=>p.id===pid);
 useEffect(()=>{
  socket.on("room:created",x=>{setCode(x.code);setScreen("lobby")});
  socket.on("room:joined",x=>{setCode(x.code);setScreen("lobby")});
  socket.on("room:update",x=>{setRoom(x);setPhase(x.phase||"lobby");if(x.finished)setScreen("results")});
  socket.on("game:incident",x=>{setIncident(x);setTelemetry(x.incident.metrics);setLogs(x.incident.logs);setFeedback(null);setChaos(null);setPhase("diagnose");setScreen("raid")});
  socket.on("game:telemetry",x=>{setTelemetry(x);const r=x.errors>10?"Critical error pressure":x.latency>2000?"Latency spike":x.cpu>90?"CPU saturation":"Telemetry stable";setAi(`AI OPS: ${r}. Cross-check logs before acting.`)});
  socket.on("game:timer",x=>setTime(Math.ceil(x.remaining)));
  socket.on("game:phase",x=>setPhase(x.phase));
  socket.on("game:feedback",x=>{setFeedback(x);setMessage(x.text)});
  socket.on("game:logs",x=>setLogs(x));
  socket.on("game:chaos",x=>setChaos(x));
  socket.on("game:winner",x=>setMessage(`${x.name} resolved incident: ${x.action}`));
  socket.on("game:finished",x=>{setBoard(x.board||[]);setScreen("results")});
  socket.on("error:message",x=>setMessage(x));
  return()=>socket.removeAllListeners();
 },[]);
 const create=(s=stream)=>{socket.emit("room:create",{name,stream:s,playerId:pid,mode});setMessage("CREATING RAID...")};
 const join=()=>{socket.emit("room:join",{name,code,playerId:pid});setMessage("CONNECTING...")};
 const start=()=>socket.emit("room:start");
 const diagnosis=incident?.diagnosis||[];
 const actions=incident?.actions||[];
 const rank=useMemo(()=>[...(room?.players||[])].sort((a,b)=>b.score-a.score),[room]);
 if(screen==="home")return <Home name={name} setName={setName} code={code} setCode={setCode} stream={stream} setStream={setStream} mode={mode} setMode={setMode} create={create} join={join} message={message}/>;
 if(screen==="lobby")return <Lobby room={room} me={me} stream={stream} setStream={x=>{setStream(x);socket.emit("room:stream",x)}} mode={mode} setMode={x=>{setMode(x);socket.emit("room:mode",x)}} start={start} message={message} setScreen={setScreen}/>;
 if(screen==="raid")return <Raid room={room} me={me} incident={incident} telemetry={telemetry} logs={logs} time={time} phase={phase} feedback={feedback} chaos={chaos} ai={ai} rank={rank} setScreen={setScreen}/>;
 return <Results board={board.length?board:rank} play={()=>{socket.emit("room:play-again");setScreen("lobby");setFeedback(null)}}/>;
}

function Shell({children}){return <div className="app"><div className="grid"/><div className="scan"/>{children}</div>}
function Home(p){return <Shell><main className="home"><section className="hero"><div className="orb"><div className="core">CH</div><i/><i/><i/></div><div><div className="eyebrow">MULTIPLAYER CLOUD OPERATIONS ARENA</div><h1>CLOUD<br/><span>HEIST</span></h1><p>AI-assisted production incidents. Real-time telemetry. Multiplayer operations under pressure.</p><div className="chips"><b>LIVE WAR ROOM</b><b>AI OPS</b><b>CHAOS ENGINE</b><b>2–50 PLAYERS</b></div></div></section><section className="control"><div><label>OPERATOR</label><input value={p.name} onChange={e=>p.setName(e.target.value)} maxLength={20}/></div><div><label>RAID MODE</label><select value={p.mode} onChange={e=>p.setMode(e.target.value)}><option value="race">RACE — EVERY OPERATOR</option><option value="team">TEAM RAID — ROLES</option></select></div><button onClick={()=>p.create(p.stream)}>CREATE RAID →</button><span className="or">OR</span><input className="roomInput" placeholder="ROOM CODE" value={p.code} onChange={e=>p.setCode(e.target.value.toUpperCase())}/><button className="secondary" onClick={p.join}>JOIN</button></section><section><div className="sectionTitle">SELECT OPERATIONS DOMAIN</div><div className="streams">{streams.map(s=><button key={s[0]} className={p.stream===s[0]?"stream active":"stream"} onClick={()=>{p.setStream(s[0]);p.create(s[0])}}><span>{s[1]}</span><strong>{s[2]}</strong><small>LIVE INCIDENTS</small></button>)}</div></section><div className="status">● {p.message}</div></main></Shell>}

function Lobby({room,me,stream,setStream,mode,setMode,start,message}){return <Shell><main className="page"><header><div><span className="eyebrow">RAID LOBBY</span><h2>ROOM <em>{room?.code}</em></h2></div><div className="live">● SOCKET LINK ACTIVE</div></header><div className="lobbyGrid"><section className="panel big"><div className="panelHead">OPERATIONS CONFIG</div><div className="modeRow"><button className={mode==="race"?"selected":""} onClick={()=>setMode("race")}>⚔ RACE</button><button className={mode==="team"?"selected":""} onClick={()=>setMode("team")}>👥 TEAM RAID</button></div><div className="streamSelect">{streams.map(s=><button key={s[0]} className={stream===s[0]?"selected":""} onClick={()=>setStream(s[0])}>{s[1]} {s[2]}</button>)}</div><div className="rule"><b>HOW TO PLAY</b><span>Investigate telemetry → identify root cause → execute remediation. Faster and safer decisions score higher.</span></div><button className="launch" onClick={start}>LAUNCH RAID <span>▶</span></button></section><section className="panel"><div className="panelHead">OPERATORS / {room?.players?.length||0}</div>{room?.players?.map((p,i)=><div className="player" key={p.id}><span className="rank">{String(i+1).padStart(2,"0")}</span><b>{p.name}</b><span>{p.role}</span><i className={p.ready?"ready":""}>●</i></div>)}</section></div><div className="status">● {message}</div></main></Shell>}

function Metric({label,value,unit,hot}){return <div className={"metric "+(hot?"hot":"")}><small>{label}</small><strong>{typeof value==="number"?Math.round(value):value}<sup>{unit}</sup></strong><div className="bar"><i style={{width:`${Math.min(100,Math.max(4,typeof value==="number"?value:30))}%`}}/></div></div>}
function Raid({room,me,incident,telemetry,logs,time,phase,feedback,chaos,ai,rank}){const diagnose=incident?.diagnosis||[];const actions=incident?.actions||[];return <Shell><main className="page raid"><header><div><span className="eyebrow">WAR ROOM // {incident?.severity}</span><h2>{incident?.title||"Incident"}</h2><p>{incident?.service} · ROUND {room?.round}/{room?.totalRounds}</p></div><div className="timer">{time}<small>SEC</small></div></header><div className="incidentBanner"><span>🚨</span><div><b>{incident?.brief}</b><small>DIFFICULTY {incident?.difficulty}/5 · RISK MULTIPLIER ACTIVE</small></div><div className="phase">{phase.toUpperCase()}</div></div><section className="metrics">{<Metric label="CPU" value={telemetry?.cpu||0} unit="%" hot={(telemetry?.cpu||0)>85}/>}<Metric label="MEMORY" value={telemetry?.memory||0} unit="%" hot={(telemetry?.memory||0)>90}/><Metric label="LATENCY" value={telemetry?.latency||0} unit="ms" hot={(telemetry?.latency||0)>2000}/><Metric label="ERROR RATE" value={telemetry?.errors||0} unit="%" hot={(telemetry?.errors||0)>10}/><Metric label="REQUESTS" value={telemetry?.rps||0} unit="/s"/><Metric label="DB LOAD" value={telemetry?.db||0} unit="%" hot={(telemetry?.db||0)>90}/></section><div className="warGrid"><section className="panel telemetry"><div className="panelHead">LIVE TELEMETRY // DIGITAL TWIN</div><div className="cloudMap"><div>EDGE<br/><b>GATEWAY</b></div><span>→</span><div className={telemetry?.cpu>85?"danger":""}>K8S<br/><b>{incident?.service}</b></div><span>→</span><div className={telemetry?.db>90?"danger":""}>DATA<br/><b>STORE</b></div></div><div className="ai"><b>🤖 AEGIS AI OPS</b><p>{ai}</p></div><div className="trace"><div className="panelHead">TRACE WATERFALL</div>{incident?.trace?.map((x,i)=><div key={i} className="traceRow"><span>{x.split(" ")[0]}</span><i style={{width:`${30+i*17}%`}}/></div>)}</div></section><section className="panel logs"><div className="panelHead">LIVE LOG STREAM</div><div className="terminal">{logs?.slice(-12).map((x,i)=><div key={i}><span>{String(i+1).padStart(2,"0")}</span>{x}</div>)}</div><div className="panelHead">OPERATOR ACTION</div>{phase==="diagnose"?<div className="choices">{diagnose.map(x=><button key={x[0]} onClick={()=>socket.emit("game:diagnose",x[0])}><b>{x[1]}</b><small>{x[2]}</small></button>)}</div>:phase==="remediate"?<div className="choices">{actions.map(x=><button key={x[0]} onClick={()=>socket.emit("game:action",x[0])}><b>{x[1]}</b><small>EXECUTE REMEDIATION</small></button>)}</div>:<div className="waiting">SYSTEM RECOVERING...</div>}{feedback&&<div className={feedback.ok?"feedback good":"feedback bad"}>{feedback.ok?"✓ ":"✕ "}{feedback.text}</div>}{chaos&&<div className="chaos"><b>{chaos.title}</b><span>{chaos.brief}</span><button onClick={()=>socket.emit("game:chaos-action","resolve")}>CONTAIN SECONDARY INCIDENT</button></div>}</section></div><section className="scorebar"><div><small>YOU</small><b>{me?.name}</b><span>{me?.score||0} PTS · 🔥 {me?.streak||0}</span></div>{rank?.slice(0,5).map((p,i)=><div key={p.id}><small>#{i+1}</small><b>{p.name}</b><span>{p.score}</span></div>)}</section></main></Shell>}

function Results({board,play}){const top=board?.[0];return <Shell><main className="page results"><div className="eyebrow">MISSION COMPLETE // INCIDENT REPLAY GENERATED</div><h1>OPERATOR<br/><span>REPORT</span></h1><div className="winner"><div className="medal">✦</div><div><small>TOP OPERATOR</small><h2>{top?.name||"—"}</h2><b>{top?.score||0} POINTS</b></div></div><div className="reportGrid">{[["ACCURACY",`${top?.accuracy||0}%`],["BEST STREAK",top?.bestStreak||0],["AVG RESPONSE",`${(top?.avgTime||0).toFixed(1)}s`],["XP EARNED",top?.xp||0]].map(x=><div className="reportCard" key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong></div>)}</div><section className="panel"><div className="panelHead">FINAL LEADERBOARD</div>{board?.map((p,i)=><div className="leader" key={p.id}><b>#{i+1}</b><strong>{p.name}</strong><span>{p.correct} correct · {p.accuracy}% accuracy</span><em>{p.score}</em></div>)}</section><button className="launch" onClick={play}>NEW RAID ↻</button></main></Shell>}

createRoot(document.getElementById("root")!).render(<App/>);
