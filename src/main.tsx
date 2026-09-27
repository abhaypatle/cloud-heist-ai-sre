import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {io} from "socket.io-client";
import "./style.css";

const API=import.meta.env.VITE_API_URL||"http://127.0.0.1:4000";
const socket=io(API,{autoConnect:true});
const PLAYER_KEY="cloudHeistPlayerId";
let playerId=localStorage.getItem(PLAYER_KEY);
if(!playerId){playerId=crypto.randomUUID();localStorage.setItem(PLAYER_KEY,playerId)}

const streams=[
 ["cloud","☁️","Cloud"],["devops","⚙️","DevOps"],["kubernetes","☸️","Kubernetes"],
 ["devsecops","🛡️","DevSecOps"],["linux","🐧","Linux"],["networking","🌐","Networking"],
 ["terraform","🏗️","Terraform"],["sre","📈","SRE"],["databases","🗄️","Databases"],["mixed","🧬","Mixed Ops"]
];

function App(){
 const [screen,setScreen]=useState("home");
 const [name,setName]=useState(localStorage.getItem("cloudHeistName")||"Operator");
 const [stream,setStream]=useState("mixed");
 const [mode,setMode]=useState("race");
 const [room,setRoom]=useState(null);
 const [code,setCode]=useState("");
 const [error,setError]=useState("");
 const [connected,setConnected]=useState(socket.connected);

 useEffect(()=>{
   socket.on("connect",()=>setConnected(true));
   socket.on("disconnect",()=>setConnected(false));
   socket.on("player:identified",x=>{if(x.playerId){playerId=x.playerId;localStorage.setItem(PLAYER_KEY,x.playerId)}});
   socket.on("room:update",r=>{setRoom(r);if(r.phase==="results")setScreen("results");else if(r.phase!=="lobby"&&r.started)setScreen("raid");else setScreen("lobby")});
   socket.on("error:game",x=>setError(x.message));
   socket.emit("player:identify",{playerId});
   return()=>{socket.off("connect");socket.off("disconnect");socket.off("room:update");socket.off("error:game")};
 },[]);

 const create=s=>{
   localStorage.setItem("cloudHeistName",name);
   setError("");
   socket.emit("room:create",{playerId,name,stream:s||stream,mode});
 };
 const join=()=>{
   if(!code)return;
   localStorage.setItem("cloudHeistName",name);
   socket.emit("room:join",{playerId,name,code:code.trim()});
 };
 const config=(x)=>socket.emit("room:config",x);

 if(screen==="home")return <Home name={name} setName={setName} stream={stream} setStream={setStream} mode={mode} setMode={setMode} code={code} setCode={setCode} create={create} join={join} error={error} connected={connected}/>;
 if(screen==="lobby")return <Lobby room={room} config={config} start={()=>socket.emit("game:start")} ready={()=>socket.emit("room:ready")} create={create} />;
 if(screen==="raid")return <Raid room={room} />;
 if(screen==="results")return <Results room={room} playAgain={()=>socket.emit("game:play-again")} home={()=>{socket.disconnect();location.reload()}} />;
}

function Shell({children,tag="AI OPS ARENA"}){return <div className="shell"><div className="scan"/><header><div className="brand"><b>CLOUD HEIST</b><span>/{tag}</span></div><div className="live"><i/>LIVE SYSTEM</div></header>{children}</div>}

function Home(p){
 return <Shell><main className="home">
  <section className="hero">
   <div className="orb"><div className="ring r1"/><div className="ring r2"/><div className="ring r3"/><span>OPS</span></div>
   <div><div className="eyebrow">MULTIPLAYER PRODUCTION INCIDENT SIMULATOR</div><h1>Break it.<br/><em>Diagnose it.</em><br/>Save production.</h1><p>Real-time cloud incidents, AI-assisted investigation, team roles, chaos events and competitive operator progression.</p></div>
  </section>
  <section className="control">
   <div className="field"><label>OPERATOR HANDLE</label><input value={p.name} onChange={e=>p.setName(e.target.value)} maxLength={24}/></div>
   <div className="mode"><button className={p.mode==="race"?"sel":""} onClick={()=>p.setMode("race")}>⚡ RACE</button><button className={p.mode==="team"?"sel":""} onClick={()=>p.setMode("team")}>👥 TEAM RAID</button></div>
   <label className="sectionlabel">SELECT BATTLEFIELD</label>
   <div className="streams">{streams.map(s=><button key={s[0]} className={p.stream===s[0]?"stream active":"stream"} onClick={()=>p.setStream(s[0])}><span>{s[1]}</span><b>{s[2]}</b><small>INCIDENTS</small></button>)}</div>
   <div className="actions"><button className="primary" onClick={()=>p.create(p.stream)}>CREATE RAID <span>→</span></button><div className="join"><input placeholder="4-DIGIT CODE" value={p.code} onChange={e=>p.setCode(e.target.value.replace(/\D/g,"").slice(0,4))}/><button onClick={p.join}>JOIN</button></div></div>
   {p.error&&<div className="error">{p.error}</div>}
  </section>
  <div className="featurestrip"><span>🚨 LIVE WAR ROOM</span><span>🤖 AI OPS COPILOT</span><span>🌪️ CHAOS ENGINE</span><span>☁️ DIGITAL TWIN</span><span>🏆 OPERATOR LEAGUE</span></div>
 </main></Shell>
}

function Lobby({room,config,start,ready}){
 if(!room)return null;
 const me=room.players.find(p=>p.playerId===playerId);
 return <Shell tag="RAID LOBBY"><main className="lobby">
  <div className="lobbyTop"><div><span className="eyebrow">SECURE WAR ROOM</span><h2>RAID <strong>{room.code}</strong></h2></div><div className="status">{room.players.length}/50 OPERATORS<br/><small>{room.mode==="team"?"TEAM RAID":"RACE MODE"}</small></div></div>
  <div className="lobbyGrid">
   <section className="panel"><h3>RAID CONFIGURATION</h3><div className="configBtns">{["race","team"].map(x=><button className={room.mode===x?"sel":""} onClick={()=>config({mode:x})}>{x==="race"?"⚡ RACE":"👥 TEAM"}</button>)}</div><div className="streamLine"><b>Battlefield</b><span>{streams.find(x=>x[0]===room.stream)?.[1]} {streams.find(x=>x[0]===room.stream)?.[2]}</span></div><p className="muted">10 incidents · adaptive difficulty · live telemetry · chaos events</p></section>
   <section className="panel"><h3>OPERATORS</h3><div className="players">{room.players.map(p=><div className="player"><span className="avatar">{p.name.slice(0,1).toUpperCase()}</span><div><b>{p.name}{p.id===room.hostId?" 👑":""}</b><small>{room.mode==="team"?p.role:"operator"} · {p.division}</small></div><i className={p.ready?"ready":""}/></div>)}</div></section>
  </div>
  <section className="rules panel"><h3>MISSION RULES</h3><div className="rulegrid"><span>01 <b>INVESTIGATE</b><small>Use metrics, logs & traces.</small></span><span>02 <b>DIAGNOSE</b><small>Evidence beats guessing.</small></span><span>03 <b>REMEDIATE</b><small>Actions carry different risk.</small></span><span>04 <b>RECOVER</b><small>Fast + safe earns more XP.</small></span></div></section>
  <div className="lobbyActions"><button onClick={ready} className="secondary">{me?.ready?"READY ✓":"MARK READY"}</button>{room.hostId===me?.id&&<button onClick={start} className="primary">LAUNCH RAID →</button>}</div>
 </main></Shell>
}

function Raid({room}){
 const [metrics,setMetrics]=useState(room.metrics||room.incident?.metrics||{});
 const [feedback,setFeedback]=useState(null);
 const [ai,setAi]=useState(null);
 const [logs,setLogs]=useState(room.incident?.logs||[]);
 const [trace,setTrace]=useState(room.incident?.trace||[]);
 const [phase,setPhase]=useState(room.phase);
 const [remaining,setRemaining]=useState(35000);
 const [selected,setSelected]=useState("");
 const [question,setQuestion]=useState("What should I investigate next?");
 const [chaos,setChaos]=useState(null);

 useEffect(()=>{
   const a=x=>{setMetrics(x.metrics);setRemaining(x.remaining||0)};
   const b=x=>{setFeedback(x);setPhase(x.phase||phase)};
   const c=x=>{setAi(x)};
   const d=x=>{setChaos(x);setMetrics(x.metrics)};
   socket.on("game:telemetry",a);socket.on("game:feedback",b);socket.on("ai:response",c);socket.on("game:chaos",d);
   return()=>{socket.off("game:telemetry",a);socket.off("game:feedback",b);socket.off("ai:response",c);socket.off("game:chaos",d)}
 },[phase]);

 useEffect(()=>{setPhase(room.phase);if(room.incident){setLogs(room.incident.logs||[]);setTrace(room.incident.trace||[])}},[room.phase,room.incident?.id]);
 const inc=room.incident;
 const timer=Math.max(0,Math.ceil(remaining/1000));
 if(!inc)return <Shell><main className="raid"><div className="waiting">INITIALIZING INCIDENT ENGINE...</div></main></Shell>;

 const diagnose=()=>{socket.emit("game:diagnose",{answer:selected});setSelected("")};
 const remediate=()=>{socket.emit("game:action",{action:selected});setSelected("")};
 const ask=()=>socket.emit("ai:copilot",{question});

 return <Shell tag="LIVE WAR ROOM"><main className="raid">
  <div className="incidentHeader"><div><span className={"severity "+inc.severity}>● {inc.severity.toUpperCase()}</span><h2>🚨 {inc.title}</h2><p>{inc.brief}</p></div><div className="timer"><small>TIME REMAINING</small><b>{timer}s</b></div></div>
  {chaos&&<div className="chaos">🌪️ <b>CHAOS EVENT: {chaos.title}</b><span>{chaos.text}</span></div>}
  <section className="metricgrid">{[["CPU","cpu","%"],["MEMORY","memory","%"],["LATENCY","latency","ms"],["ERROR RATE","errors","%"],["REQUESTS","rps","rps"],["DB LOAD","db","%"]].map(m=><div className="metric"><small>{m[0]}</small><b>{typeof metrics[m[1]]==="number"?Math.round(metrics[m[1]]):"--"}<i>{m[2]}</i></b><div className="meter"><span style={{width:`${Math.min(100,m[1]==="latency"?metrics[m[1]]/12: m[1]==="rps"?metrics[m[1]]/120:metrics[m[1]])}%`}}/></div></div>)}</section>
  <div className="wargrid">
   <section className="panel twin"><div className="panelHead"><h3>☁️ DIGITAL TWIN</h3><span>LIVE TOPOLOGY</span></div><div className="topology"><div className="node internet">INTERNET</div><div className="line"/><div className="nodes"><div className="node">CDN</div><div className="node hot">LOAD BALANCER</div></div><div className="line"/><div className="nodes"><div className="node">API-1</div><div className="node">API-2</div><div className="node hot">CACHE</div></div><div className="line"/><div className="nodes"><div className="node">QUEUE</div><div className="node danger">DATABASE</div></div></div></section>
   <section className="panel ai"><div className="panelHead"><h3>🤖 AI OPS COPILOT</h3><span>HUMAN DECISION REQUIRED</span></div><div className="aiBox">{ai?<><b>HYPOTHESIS · {ai.confidence}%</b><p>{ai.hypothesis}</p><small>{(ai.evidence||[]).join(" · ")}</small></>:<p>AI will provide evidence-based hypotheses, never the final answer.</p>}</div><div className="ask"><input value={question} onChange={e=>setQuestion(e.target.value)}/><button onClick={ask}>ASK</button></div></section>
   <section className="panel terminal"><div className="panelHead"><h3>▣ LIVE LOG STREAM</h3><span>TAIL -f</span></div><div className="logs">{logs.map((x,i)=><div key={i}><time>{new Date().toLocaleTimeString()}</time><span>{x}</span></div>)}</div></section>
   <section className="panel trace"><div className="panelHead"><h3>⌁ TRACE WATERFALL</h3><span>REQUEST PATH</span></div>{trace.map((x,i)=><div className="traceRow"><b>{i+1}</b><span>{x}</span><em style={{width:`${35+i*13}%`}}/></div>)}</section>
  </div>
  <section className="decision panel"><div className="decisionTop"><div><span className="eyebrow">{phase==="diagnose"?"INVESTIGATION PHASE":"REMEDIATION PHASE"}</span><h3>{phase==="diagnose"?"What is the most likely root cause?":"Which remediation should you execute?"}</h3></div><span className="risk">RISK-AWARE SCORING</span></div><div className="choices">{(phase==="diagnose"?(inc.diagnosis||[]):(inc.actions||[])).map((x,i)=><button className={selected===x[0]?"choice selected":"choice"} onClick={()=>setSelected(x[0])}><span>{String.fromCharCode(65+i)}</span><b>{x[1]}</b><small>{phase==="diagnose"?x[2]+" confidence":"success probability "+Math.round(x[2]*100)+"%"}</small></button>)}</div><button disabled={!selected} className="execute" onClick={phase==="diagnose"?diagnose:remediate}>{phase==="diagnose"?"SUBMIT DIAGNOSIS →":"EXECUTE REMEDIATION →"}</button>{feedback&&<div className={feedback.ok?"feedback good":"feedback bad"}>{feedback.ok?"✓ ":"⚠ "}{feedback.message}</div>}</section>
 </main></Shell>
}

function Results({room,playAgain,home}){
 const board=room?.players||[];
 const sorted=[...board].sort((a,b)=>b.score-a.score);
 return <Shell tag="POSTMORTEM"><main className="results"><div className="resultHero"><span className="eyebrow">INCIDENT SERIES COMPLETE</span><h1>OPERATOR <em>REPORT</em></h1><p>Review the raid timeline, performance and progression.</p></div><div className="podium">{sorted.slice(0,3).map((p,i)=><div className={"pod p"+i}><span>#{i+1}</span><b>{p.name}</b><strong>{p.score}</strong><small>{p.correct} solved · {p.division}</small></div>)}</div><section className="panel"><div className="panelHead"><h3>LIVE LEADERBOARD</h3><span>FINAL SCORE</span></div><div className="leader">{sorted.map((p,i)=><div><b>#{i+1}</b><strong>{p.name}</strong><span>{p.division}</span><span>{p.correct} correct</span><span>{p.streak} streak</span><strong>{p.score}</strong></div>)}</div></section><div className="resultActions"><button className="primary" onClick={playAgain}>RUN ANOTHER RAID →</button><button className="secondary" onClick={home}>EXIT</button></div></main></Shell>
}

createRoot(document.getElementById("root")!).render(<App/>);
