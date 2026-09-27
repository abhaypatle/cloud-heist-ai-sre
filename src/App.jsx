import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import "./style.css";

const socket = io("http://localhost:4000");

// Web Audio API Synthesizer
let audioCtx = null;
const playCriticalSiren = () => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(480, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(720, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch(e) {}
};

const playChime = () => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15);
    osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.55);
  } catch(e) {}
};

const BATTLEFIELDS = [
  { id: "cloud", name: "Cloud", icon: "☁️", desc: "INCIDENTS" },
  { id: "devops", name: "DevOps", icon: "⚙️", desc: "INCIDENTS" },
  { id: "k8s", name: "Kubernetes", icon: "☸️", desc: "INCIDENTS" },
  { id: "devsecops", name: "DevSecOps", icon: "🛡️", desc: "INCIDENTS" },
  { id: "linux", name: "Linux", icon: "🐧", desc: "INCIDENTS" },
  { id: "networking", name: "Networking", icon: "🌐", desc: "INCIDENTS" },
  { id: "terraform", name: "Terraform", icon: "🏗️", desc: "INCIDENTS" },
  { id: "sre", name: "SRE", icon: "📈", desc: "INCIDENTS" },
  { id: "databases", name: "Databases", icon: "🗄️", desc: "INCIDENTS" },
  { id: "mixed", name: "Mixed Ops", icon: "🧬", desc: "INCIDENTS" }
];

const LIFECYCLE_STEPS = [
  { step: 1, name: "Preparation", icon: "📋" },
  { step: 2, name: "Detection", icon: "🚨" },
  { step: 3, name: "Triage", icon: "📑" },
  { step: 4, name: "Containment", icon: "🚧" },
  { step: 5, name: "Resolution", icon: "🧩" },
  { step: 6, name: "Recovery", icon: "🔄" },
  { step: 7, name: "Postmortem", icon: "♻️" }
];

export default function App() {
  const [view, setView] = useState("warroom"); // "arena" | "warroom"
  const [data, setData] = useState(null);
  const [causalMode, setCausalMode] = useState(false);
  const [activeTab, setActiveTab] = useState("slack"); // "slack" | "debate" | "ebpf" | "mcp"
  const [scrubberSec, setScrubberSec] = useState(0);
  const [chatIn, setChatIn] = useState("");
  const [showBoard, setShowBoard] = useState(false);
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [operator, setOperator] = useState("Operator");
  const [selectedField, setSelectedField] = useState("mixed");
  const canvasRef = useRef(null);

  useEffect(() => {
    socket.on("titaniumMasterSync", (st) => {
      setData(st);
      if (!st.isResolved && Math.random() > 0.65) playCriticalSiren();
    });
    return () => socket.off("titaniumMasterSync");
  }, []);

  const historyPoint = data?.history?.find(h => h.offsetSec === scrubberSec) || {
    p99Ms: data?.isResolved ? 22 : 4850,
    dbPool: data?.isResolved ? 14 : 100,
    blastRadius: data?.isResolved ? 0.0 : 36.4,
    failing: !data?.isResolved
  };

  // 60FPS Reactive 3D Canvas Mesh
  useEffect(() => {
    if (!canvasRef.current || !data || view !== "warroom") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animId;
    let packetT = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      packetT = (packetT + 0.018) % 1;
      const isFailing = historyPoint.failing;
      const nodes = data.nodes;

      const links = causalMode
        ? [[4, 2], [5, 2], [2, 1], [1, 0]]
        : [[0, 1], [1, 2], [1, 3], [2, 4], [2, 5], [3, 5], [2, 6]];

      links.forEach(([a, b]) => {
        const from = nodes[a];
        const to = nodes[b];
        const linkFailing = isFailing && (to.id === "postgres" || to.id === "redis" || from.id === "postgres");

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = linkFailing ? "rgba(244, 63, 94, 0.6)" : "rgba(56, 225, 244, 0.4)";
        ctx.lineWidth = causalMode ? 3 : 1.5;
        ctx.stroke();

        const px = from.x + (to.x - from.x) * packetT;
        const py = from.y + (to.y - from.y) * packetT;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = linkFailing ? "#f43f5e" : "#38e1f4";
        ctx.shadowBlur = 12;
        ctx.shadowColor = linkFailing ? "#f43f5e" : "#38e1f4";
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      nodes.forEach(n => {
        const broken = isFailing && (n.id === "postgres" || n.id === "redis");
        ctx.beginPath();
        ctx.arc(n.x, n.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = broken ? "#f43f5e" : "#38e1f4";
        ctx.shadowBlur = 14;
        ctx.shadowColor = broken ? "#f43f5e" : "#38e1f4";
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(n.name, n.x, n.y + 24);

        if (causalMode) {
          ctx.fillStyle = broken ? "#fca5a5" : "#658f9e";
          ctx.font = "8px monospace";
          ctx.fillText(n.causalRole, n.x, n.y + 34);
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [data, scrubberSec, historyPoint, causalMode, view]);

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatIn.trim()) return;
    socket.emit("sendSlackMsg", { text: chatIn });
    setChatIn("");
  };

  const switchCloudRegion = (key) => {
    socket.emit("switchCloud", { key });
  };

  const handleMitigationRequest = () => {
    socket.emit("requestMitigationHandshake");
  };

  const handleAuthorize = () => {
    socket.emit("authorizeHandshake");
  };

  const handleOneClickHeal = () => {
    playChime();
    socket.emit("solveIncident");
  };

  const handleReset = () => {
    socket.emit("resetIncident");
  };

  if (!data) return <div className="waiting">Booting Titanium Sovereign Master Platform...</div>;

  const isResolved = data.isResolved;

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", padding: "10px 18px", color: "#eef8fc", boxSizing: "border-box" }}>
      
      {/* GLOBAL HEADER BAR */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(56, 225, 244, 0.3)", paddingBottom: "6px", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "15px", fontWeight: "900", letterSpacing: "1.5px", color: "#38e1f4" }}>CLOUD HEIST</span>
          <span style={{ fontSize: "10px", color: "#618999", letterSpacing: "2px" }}>/ TITANIUM SOVEREIGN</span>
          
          <div style={{ display: "flex", gap: "6px", marginLeft: "10px" }}>
            <button
              onClick={() => setView("arena")}
              style={{
                background: view === "arena" ? "#38e1f4" : "#081a24",
                color: view === "arena" ? "#020a10" : "#6ca0b2",
                border: "1px solid rgba(56, 225, 244, 0.3)",
                padding: "3px 8px",
                borderRadius: "3px",
                fontSize: "9px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              ARENA LOBBY
            </button>
            <button
              onClick={() => setView("warroom")}
              style={{
                background: view === "warroom" ? "#38e1f4" : "#081a24",
                color: view === "warroom" ? "#020a10" : "#6ca0b2",
                border: "1px solid rgba(56, 225, 244, 0.3)",
                padding: "3px 8px",
                borderRadius: "3px",
                fontSize: "9px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              WAR ROOM
            </button>
          </div>

          {/* MULTI-CLOUD SELECTOR */}
          <div style={{ display: "flex", gap: "4px", marginLeft: "6px" }}>
            {["aws", "gcp", "azure"].map(c => (
              <button
                key={c}
                onClick={() => switchCloudRegion(c)}
                style={{
                  background: data.activeCloudKey === c ? "#38e1f4" : "#081a24",
                  color: data.activeCloudKey === c ? "#020a10" : "#6ca0b2",
                  border: "1px solid rgba(56, 225, 244, 0.3)",
                  padding: "2px 6px",
                  borderRadius: "3px",
                  fontSize: "9px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  textTransform: "uppercase"
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* FINOPS LOSS COUNTER & PODIUM */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ background: isResolved ? "#0a3a29" : "#450a12", border: `1px solid ${isResolved ? "#10b981" : "#f43f5e"}`, padding: "2px 8px", borderRadius: "4px", fontSize: "10px", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ color: isResolved ? "#34d399" : "#fca5a5" }}>FINOPS LOSS:</span>
            <b style={{ color: isResolved ? "#34d399" : "#f43f5e", fontSize: "12px" }}>${data.dollarLoss.toLocaleString()}</b>
            <span style={{ fontSize: "8px", color: "#a5d0dc" }}>({isResolved ? "CAPPED" : "-$" + data.activeCloud.costPerSec + "/s"})</span>
          </div>

          <span style={{ fontSize: "11px", color: "#38e1f4" }}>SCORE: <b style={{ color: "#ffffff" }}>{data.score}</b></span>
          <button onClick={() => setShowBoard(true)} style={{ background: "#0c2435", border: "1px solid #38e1f4", color: "#38e1f4", padding: "3px 10px", borderRadius: "3px", fontWeight: "bold", fontSize: "9px", cursor: "pointer" }}>
            PODIUM
          </button>
          {isResolved && (
            <button onClick={() => setShowRcaModal(true)} className="glow-btn-4d" style={{ padding: "3px 10px", fontSize: "9px" }}>
              POSTMORTEM
            </button>
          )}
        </div>
      </header>

      {/* VIEW 1: ARENA LOBBY */}
      {view === "arena" && (
        <main style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "40px", alignItems: "center", marginBottom: "24px" }}>
            <div className="orbit-box" style={{ width: "260px", height: "260px" }}>
              <div className="ring ring-1" />
              <div className="ring ring-2" />
              <div className="ring ring-3" />
              <div className="ops-pill">OPS</div>
            </div>

            <div>
              <span style={{ fontSize: "11px", letterSpacing: "2px", fontWeight: 800, color: "#38e1f4" }}>MULTIPLAYER PRODUCTION SIMULATOR</span>
              <h1 style={{ fontSize: "52px", fontWeight: 900, lineHeight: 1.05, margin: "10px 0 14px" }}>
                Break it.<br />
                <em style={{ color: "#38e1f4", fontStyle: "normal" }}>Diagnose it.</em><br />
                Save production.
              </h1>
              <p style={{ fontSize: "14px", color: "#7a9fab", maxWidth: "580px" }}>
                Multi-agent incident reasoning swarm, kernel eBPF probes, real-time Time-Travel bisect and competitive operator progression.
              </p>
            </div>
          </div>

          <div className="cyber-panel-4d" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: "10px", color: "#618999", fontWeight: 800 }}>OPERATOR HANDLE</span>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  style={{ background: "#02070c", border: "1px solid #163c4c", color: "#ffffff", padding: "6px 12px", borderRadius: "4px", fontSize: "12px", width: "200px", outline: "none" }}
                />
              </div>

              <button onClick={() => setView("warroom")} className="glow-btn-4d" style={{ padding: "8px 20px", fontSize: "11px" }}>
                ENTER WAR ROOM COCKPIT →
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
              {BATTLEFIELDS.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedField(b.id)}
                  className={`battle-card-4d ${selectedField === b.id ? "active" : ""}`}
                  style={{ padding: "10px" }}
                >
                  <div style={{ fontSize: "18px" }}>{b.icon}</div>
                  <b style={{ display: "block", fontSize: "11px", color: "#ffffff", marginTop: "4px" }}>{b.name}</b>
                  <small style={{ fontSize: "8px", color: "#5a8292" }}>{b.desc}</small>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* VIEW 2: WAR ROOM COCKPIT */}
      {view === "warroom" && (
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          
          {/* 7-STEP LIFECYCLE MINI TRACKER */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px", marginBottom: "6px" }}>
            {LIFECYCLE_STEPS.map((st) => {
              const isDone = data.currentStep >= st.step || isResolved;
              const isCur = data.currentStep === st.step && !isResolved;
              return (
                <div
                  key={st.step}
                  style={{
                    background: isCur ? "rgba(244, 63, 94, 0.25)" : isDone ? "rgba(16, 185, 129, 0.2)" : "rgba(14, 38, 56, 0.6)",
                    border: `1px solid ${isCur ? "#f43f5e" : isDone ? "#10b981" : "rgba(56, 225, 244, 0.3)"}`,
                    borderRadius: "4px",
                    padding: "4px 6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "9px"
                  }}
                >
                  <span>{st.icon}</span>
                  <b style={{ color: isCur ? "#ff9aa4" : isDone ? "#34d399" : "#658f9e" }}>Step {st.step}: {st.name}</b>
                </div>
              );
            })}
          </div>

          {/* TELEMETRY METRIC TILES */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", marginBottom: "6px" }}>
            <div className="cyber-panel-4d" style={{ padding: "6px 10px" }}>
              <small style={{ color: "#658f9e", fontSize: "9px", fontWeight: 700 }}>P99 LATENCY (SCRUBBED)</small>
              <div style={{ fontSize: "17px", fontWeight: 900, color: historyPoint.failing ? "#f43f5e" : "#34d399" }}>
                {historyPoint.p99Ms} <span style={{ fontSize: "9px" }}>ms</span>
              </div>
            </div>
            <div className="cyber-panel-4d" style={{ padding: "6px 10px" }}>
              <small style={{ color: "#658f9e", fontSize: "9px", fontWeight: 700 }}>ACTIVE DB POOL</small>
              <div style={{ fontSize: "17px", fontWeight: 900, color: historyPoint.failing ? "#f43f5e" : "#34d399" }}>
                {historyPoint.dbPool} / 100
              </div>
            </div>
            <div className="cyber-panel-4d" style={{ padding: "6px 10px" }}>
              <small style={{ color: "#658f9e", fontSize: "9px", fontWeight: 700 }}>BLAST RADIUS</small>
              <div style={{ fontSize: "17px", fontWeight: 900, color: historyPoint.failing ? "#f43f5e" : "#34d399" }}>
                {historyPoint.blastRadius}%
              </div>
            </div>
            <div className="cyber-panel-4d" style={{ padding: "6px 10px" }}>
              <small style={{ color: "#658f9e", fontSize: "9px", fontWeight: 700 }}>SOVEREIGN REGION</small>
              <div style={{ fontSize: "12px", fontWeight: 900, color: "#38e1f4", marginTop: "2px" }}>
                {data.activeCloud.name}
              </div>
            </div>
          </div>

          {/* DUAL WORKBENCH: CANVAS + SLACK/EBPF/SWARM */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "6px", flex: 1, minHeight: 0, marginBottom: "6px" }}>
            
            {/* CANVAS */}
            <div className="cyber-panel-4d" style={{ padding: "8px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, color: "#658f9e" }}>
                  {causalMode ? "CAUSAL DEPENDENCY KNOWLEDGE GRAPH (A -> B -> C)" : `TOPOLOGY (${scrubberSec === 0 ? "LIVE" : `${scrubberSec}s`})`}
                </span>
                <button
                  onClick={() => setCausalMode(!causalMode)}
                  style={{
                    background: causalMode ? "#f59e0b" : "#092230",
                    color: causalMode ? "#000" : "#38e1f4",
                    border: "1px solid #38e1f4",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontSize: "8px",
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  {causalMode ? "✓ CAUSAL GRAPH" : "ENABLE CAUSAL"}
                </button>
              </div>
              <div style={{ background: "#05111a", border: "1px solid rgba(56, 225, 244, 0.25)", borderRadius: "4px", flex: 1, position: "relative", overflow: "hidden" }}>
                <canvas ref={canvasRef} width={800} height={230} style={{ width: "100%", height: "100%" }} />
              </div>
            </div>

            {/* TAB WORKBENCH */}
            <div className="cyber-panel-4d" style={{ padding: "8px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, color: "#658f9e" }}>OPERATIONS CONSOLE</span>
                <div style={{ display: "flex", gap: "3px" }}>
                  {["slack", "debate", "ebpf", "mcp"].map(t => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      style={{
                        background: activeTab === t ? "#38e1f4" : "transparent",
                        color: activeTab === t ? "#031018" : "#80a9b8",
                        border: "none",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        fontSize: "8px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        textTransform: "uppercase"
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* TAB 1: SLACK & PAGERDUTY WAR ROOM */}
              {activeTab === "slack" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                  <div style={{ flex: 1, overflowY: "auto", background: "#02070c", border: "1px solid rgba(56, 225, 244, 0.2)", borderRadius: "3px", padding: "6px 8px", fontSize: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {data.slackMessages.map((msg, i) => (
                      <div key={i} style={{ color: msg.type === "alert" ? "#fca5a5" : msg.type === "success" ? "#34d399" : "#a5d0dc" }}>
                        <span style={{ color: "#618999" }}>[{msg.time}]</span> <b>{msg.sender}:</b> {msg.text}
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendChat} style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                    <input
                      type="text"
                      value={chatIn}
                      onChange={(e) => setChatIn(e.target.value)}
                      placeholder="Type '/heal' to auto-mitigate..."
                      style={{ flex: 1, background: "#061824", border: "1px solid rgba(56, 225, 244, 0.4)", color: "#ffffff", padding: "4px 8px", borderRadius: "3px", fontSize: "10px", outline: "none" }}
                    />
                    <button type="submit" className="glow-btn-4d" style={{ padding: "4px 10px", fontSize: "9px" }}>Post</button>
                  </form>
                </div>
              )}

              {/* TAB 2: COURTROOM DEBATE */}
              {activeTab === "debate" && (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {data.debateLog.map((arg, i) => (
                    <div key={i} style={{ background: "#02070c", borderLeft: `3px solid ${arg.color}`, padding: "4px 8px", borderRadius: "3px", fontSize: "9px" }}>
                      <b style={{ color: arg.color }}>{arg.agent}:</b>
                      <p style={{ margin: "2px 0 0", color: "#b9e2ed" }}>{arg.stance}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: eBPF SYSCALL PROBES */}
              {activeTab === "ebpf" && (
                <div style={{ flex: 1, overflowY: "auto", background: "#01060a", border: "1px solid rgba(56, 225, 244, 0.2)", borderRadius: "3px", padding: "4px 6px", fontFamily: "monospace", fontSize: "9px" }}>
                  {data.ebpfStream.map((p, idx) => (
                    <div key={idx} style={{ margin: "2px 0", color: p.event.includes("FUTEX") ? "#f43f5e" : "#38e1f4" }}>
                      <span style={{ color: "#618999" }}>[{p.ts}]</span> <b>{p.probe}</b> ({p.comm}:{p.pid}) {" -> "} {p.event}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: MCP CONNECTOR HUB */}
              {activeTab === "mcp" && (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {data.mcpServers.map((mcp) => (
                    <div key={mcp.id} style={{ background: "#02070c", border: "1px solid rgba(56, 225, 244, 0.25)", padding: "4px 8px", borderRadius: "3px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <b style={{ color: "#ffffff", fontSize: "9px" }}>{mcp.name}</b>
                        <small style={{ display: "block", color: "#618999", fontSize: "7px" }}>{mcp.tools} Tools Active</small>
                      </div>
                      <span style={{ background: "#092e22", color: "#34d399", border: "1px solid #10b981", padding: "1px 5px", borderRadius: "2px", fontSize: "8px", fontWeight: "bold" }}>
                        {mcp.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

          {/* TIME-TRAVEL & ACTION FOOTER */}
          <div className="cyber-panel-4d" style={{ padding: "6px 12px", height: "50px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <span style={{ fontSize: "9px", fontWeight: 800, color: "#38e1f4", whiteSpace: "nowrap" }}>
                ⏱️ TIME-TRAVEL: {scrubberSec === 0 ? "LIVE" : `T${scrubberSec}s`}
              </span>
              <input
                type="range"
                min="-120"
                max="0"
                step="10"
                value={scrubberSec}
                onChange={(e) => setScrubberSec(parseInt(e.target.value, 10))}
                style={{ flex: 1, accentColor: "#38e1f4", cursor: "pointer" }}
              />
              <button onClick={() => setScrubberSec(0)} style={{ background: "#091c26", border: "1px solid #38e1f4", color: "#38e1f4", padding: "2px 6px", borderRadius: "3px", fontSize: "8px", cursor: "pointer" }}>
                SNAP LIVE
              </button>
            </div>

            {/* ACTION TRIGGERS */}
            <div style={{ display: "flex", gap: "6px" }}>
              {!isResolved && !data.approvalPending && (
                <button onClick={handleMitigationRequest} className="glow-btn-4d" style={{ padding: "5px 10px", fontSize: "9px" }}>
                  🔒 REQUEST 2FA MITIGATION
                </button>
              )}

              {data.approvalPending && (
                <button onClick={handleAuthorize} style={{ background: "#f59e0b", color: "#000", border: "none", padding: "5px 10px", borderRadius: "3px", fontWeight: "bold", fontSize: "9px", cursor: "pointer", animation: "pulseCore 1s infinite" }}>
                  🔑 2FA APPROVE
                </button>
              )}

              {!isResolved ? (
                <button onClick={handleOneClickHeal} style={{ background: "#0f3747", border: "1px solid #38e1f4", color: "#38e1f4", padding: "5px 10px", borderRadius: "3px", fontSize: "9px", fontWeight: "bold", cursor: "pointer" }}>
                  ⚡ ONE-CLICK HEAL
                </button>
              ) : (
                <button onClick={handleReset} style={{ background: "#4a1218", border: "1px solid #f43f5e", color: "#fca5a5", padding: "5px 10px", borderRadius: "3px", fontSize: "9px", fontWeight: "bold", cursor: "pointer" }}>
                  🔥 INJECT CHAOS
                </button>
              )}
            </div>
          </div>

        </main>
      )}

      {/* MODAL 1: SRE RCA POSTMORTEM */}
      {showRcaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="cyber-panel-4d" style={{ width: "740px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <h2 style={{ fontSize: "16px", color: "#38e1f4", margin: 0 }}>Incident Postmortem Report & Git-Ops Diff</h2>
              <button onClick={() => setShowRcaModal(false)} style={{ background: "transparent", border: "none", color: "#ffffff", fontSize: "14px", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ background: "#01060a", border: "1px solid rgba(56, 225, 244, 0.2)", padding: "10px", borderRadius: "4px", fontFamily: "monospace", fontSize: "10px", color: "#a5d0dc", marginBottom: "8px" }}>
              <b style={{ color: "#34d399" }}>POSTMORTEM RCA:</b>
              <p style={{ margin: "4px 0 0" }}>
                Incident {data.incidentId} mitigated in {data.mitigationTime}s. Root-cause process PID 8140 terminated. Blast radius dropped to 0.00%. FinOps loss capped at ${data.dollarLoss.toLocaleString()}.
              </p>
            </div>
            <div style={{ background: "#01060a", border: "1px solid rgba(56, 225, 244, 0.2)", padding: "10px", borderRadius: "4px", fontFamily: "monospace", fontSize: "10px", color: "#34d399" }}>
              <b>AUTOMATED GITHUB PR (helm/values.yaml):</b>
              <pre style={{ margin: "4px 0 0", color: "#6fe9f7" }}>
{`--- a/helm/production/values.yaml
+++ b/helm/production/values.yaml
@@ -12,4 +12,6 @@ postgres:
-  max_connections: 100
+  max_connections: 300
+  idle_in_transaction_session_timeout: 5000ms`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PODIUM LEADERBOARD */}
      {showBoard && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="cyber-panel-4d" style={{ width: "700px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
              <h2 style={{ fontSize: "16px", color: "#38e1f4", margin: 0 }}>🏆 Global Operator League Podium</h2>
              <button onClick={() => setShowBoard(false)} style={{ background: "transparent", border: "none", color: "#ffffff", fontSize: "14px", cursor: "pointer" }}>✕</button>
            </div>
            
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", fontFamily: "monospace" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(56, 225, 244, 0.3)", color: "#658f9e", textAlign: "left" }}>
                  <th style={{ padding: "6px" }}>RANK</th>
                  <th style={{ padding: "6px" }}>OPERATOR</th>
                  <th style={{ padding: "6px" }}>MTTR</th>
                  <th style={{ padding: "6px" }}>TIER BADGE</th>
                  <th style={{ padding: "6px", textAlign: "right" }}>XP SCORE</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((u) => (
                  <tr key={u.rank} style={{ borderBottom: "1px solid rgba(56, 225, 244, 0.1)", color: u.handle.includes("Operator") ? "#38e1f4" : "#ffffff", background: u.handle.includes("Operator") ? "rgba(56, 225, 244, 0.1)" : "transparent" }}>
                    <td style={{ padding: "8px 6px", fontWeight: "bold" }}>#{u.rank}</td>
                    <td style={{ padding: "8px 6px" }}>{u.handle}</td>
                    <td style={{ padding: "8px 6px" }}>{u.mttr}</td>
                    <td style={{ padding: "8px 6px", color: "#34d399" }}>{u.badge}</td>
                    <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: "bold" }}>{u.xp.toLocaleString()} XP</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}