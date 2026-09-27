import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import "./style.css";

const SERVER = import.meta.env.VITE_SERVER_URL || "http://127.0.0.1:4000";
const socket = io(SERVER, { autoConnect: false });

type Player = {
  id: string;
  name: string;
  score: number;
  ready: boolean;
  connected: boolean;
};

type Action = { id: string; label: string };

type Incident = {
  id: string;
  title: string;
  service: string;
  severity: string;
  description: string;
  impact: string;
  actions: Action[];
};

type RoundResult = {
  round: number;
  winnerName?: string;
  incident: string;
};

const getPlayerId = () => {
  let id = localStorage.getItem("cloud-heist-player");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("cloud-heist-player", id);
  }
  return id;
};

const playerId = getPlayerId();

function App() {
  const [name, setName] = useState(localStorage.getItem("cloud-heist-name") || "");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [hostId, setHostId] = useState("");
  const [joined, setJoined] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [ready, setReady] = useState(false);
  const [round, setRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(10);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [logs, setLogs] = useState<string[]>(["[SYSTEM] Awaiting secure uplink..."]);
  const [feedback, setFeedback] = useState("");
  const [winner, setWinner] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");

  const me = players.find(p => p.id === playerId);
  const isHost = hostId === playerId;

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => b.score - a.score),
    [players]
  );

  useEffect(() => {
    const onRoom = (x: any) => {
      setRoom(x.code);
      setHostId(x.hostId);
      setPlayers(x.players || []);
      setStarted(Boolean(x.started));
      setFinished(Boolean(x.finished));
      setRound(x.round || 0);
      setMaxRounds(x.maxRounds || 10);
      setJoined(true);

      const myself = (x.players || []).find((p: Player) => p.id === playerId);
      if (myself) setReady(myself.ready);
    };

    const onIncident = (x: any) => {
      setRound(x.round);
      setMaxRounds(x.maxRounds);
      setIncident(x.incident);
      setSelected("");
      setFeedback("");
      setWinner("");
      setCountdown(null);
      setStarted(true);
    };

    const onLogs = (x: string[]) => setLogs(x);

    const onFeedback = (x: string) => {
      setFeedback(x);
      setTimeout(() => setFeedback(""), 2200);
    };

    const onCountdown = (x: { seconds: number; round: number }) => {
      setCountdown(x.seconds);
      setRound(x.round);

      let n = x.seconds;
      const timer = window.setInterval(() => {
        n -= 1;
        if (n <= 0) {
          clearInterval(timer);
          setCountdown(null);
        } else {
          setCountdown(n);
        }
      }, 1000);
    };

    const onWinner = (x: any) => {
      setWinner(`${x.playerName} +${x.points}`);
      setSelected(x.playerId === playerId ? "correct" : "");
    };

    const onFinished = (x: any) => {
      setFinished(true);
      setStarted(false);
      setRoundResults(x.roundResults || []);
      setPlayers(x.players || []);
      setIncident(null);
    };

    socket.on("room:update", onRoom);
    socket.on("game:incident", onIncident);
    socket.on("game:logs", onLogs);
    socket.on("game:feedback", onFeedback);
    socket.on("game:countdown", onCountdown);
    socket.on("game:round-winner", onWinner);
    socket.on("game:finished", onFinished);

    return () => {
      socket.off("room:update", onRoom);
      socket.off("game:incident", onIncident);
      socket.off("game:logs", onLogs);
      socket.off("game:feedback", onFeedback);
      socket.off("game:countdown", onCountdown);
      socket.off("game:round-winner", onWinner);
      socket.off("game:finished", onFinished);
    };
  }, []);

  const connect = () => {
    if (!name.trim()) {
      setError("Enter an operator name first.");
      return false;
    }

    localStorage.setItem("cloud-heist-name", name.trim());

    if (!socket.connected) socket.connect();
    setError("");
    return true;
  };

  const createRoom = () => {
    if (!connect()) return;

    socket.emit("room:create", { name: name.trim(), playerId }, (x: any) => {
      if (x?.error) setError(x.error);
    });
  };

  const joinRoom = () => {
    if (!connect()) return;

    socket.emit(
      "room:join",
      { name: name.trim(), code, playerId },
      (x: any) => {
        if (x?.error) setError(x.error);
      }
    );
  };

  const toggleReady = () => {
    const next = !ready;
    setReady(next);
    socket.emit("player:ready", { room, playerId, ready: next });
  };

  const startRaid = () => {
    socket.emit("game:start", { room });
  };

  const choose = (id: string) => {
    if (!incident || selected || winner || countdown !== null) return;
    setSelected(id);
    socket.emit("game:action", { room, playerId, actionId: id });
  };

  const playAgain = () => {
    setFinished(false);
    setWinner("");
    setIncident(null);
    setRoundResults([]);
    socket.emit("game:play-again", { room });
  };

  if (!joined) {
    return (
      <main className="shell">
        <div className="noise" />
        <header className="brand">
          <div>
            <div className="eyebrow">CLOUD HEIST // DEVOPS SABOTAGE</div>
            <h1>Cloud Heist</h1>
            <p>REAL-TIME CLOUD INCIDENT RACE</p>
          </div>
          <div className="status"><i /> SYSTEM ONLINE</div>
        </header>

        <section className="landing">
          <div className="hero-card">
            <div className="hero-kicker">MISSION CONTROL</div>
            <h2>Race your team.<br /><span>Fix production first.</span></h2>
            <p>
              Ten cloud incidents. One correct remediation. The first operator
              to solve each incident captures the points.
            </p>

            <div className="feature-row">
              <span>10 ROUNDS</span>
              <span>2–8 PLAYERS</span>
              <span>SERVER AUTH</span>
            </div>
          </div>

          <div className="panel access">
            <div className="panel-title">ESTABLISH SECURE UPLINK</div>
            <label>OPERATOR NAME</label>
            <input
              value={name}
              maxLength={18}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. DevOps-01"
            />

            <button className="primary" onClick={createRoom}>
              CREATE RAID ROOM
            </button>

            <div className="divider"><span>OR</span></div>

            <label>4-DIGIT ROOM CODE</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="3726"
            />

            <button className="secondary" onClick={joinRoom}>
              JOIN EXISTING ROOM
            </button>

            {error && <div className="error-box">{error}</div>}
          </div>
        </section>

        <footer>BUILD 1.0 // SOCKET.IO REALTIME // CLOUD OPERATIONS SIMULATION</footer>
      </main>
    );
  }

  if (finished) {
    return (
      <main className="shell">
        <header className="topbar">
          <div>
            <div className="eyebrow">CLOUD HEIST // RAID COMPLETE</div>
            <h1>Mission Results</h1>
          </div>
          <div className="room-chip">ROOM <b>{room}</b></div>
        </header>

        <section className="results">
          <div className="result-hero">
            <div className="result-icon">✓</div>
            <div>
              <div className="eyebrow">ALL INCIDENTS RESOLVED</div>
              <h2>RAID COMPLETE</h2>
              <p>Production stability restored. Operator rankings locked.</p>
            </div>
          </div>

          <div className="result-grid">
            <div className="panel leaderboard">
              <div className="panel-title">FINAL LEADERBOARD</div>
              {sortedPlayers.map((p, i) => (
                <div className={`rank ${i === 0 ? "top" : ""}`} key={p.id}>
                  <span className="rank-number">{String(i + 1).padStart(2, "0")}</span>
                  <span className="rank-name">{p.name}{p.id === playerId ? " // YOU" : ""}</span>
                  <strong>{p.score}</strong>
                </div>
              ))}
            </div>

            <div className="panel history">
              <div className="panel-title">ROUND HISTORY</div>
              {roundResults.map(r => (
                <div className="history-row" key={r.round}>
                  <span>R{String(r.round).padStart(2, "0")}</span>
                  <span>{r.winnerName || "—"}</span>
                  <b>+100</b>
                </div>
              ))}
            </div>
          </div>

          {isHost && (
            <button className="primary big" onClick={playAgain}>
              LAUNCH NEW RAID
            </button>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">CLOUD HEIST // DEVOPS SABOTAGE</div>
          <h1>Operations Console</h1>
        </div>
        <div className="top-actions">
          <div className="room-chip">ROOM <b>{room}</b></div>
          <div className="live"><i /> LIVE</div>
        </div>
      </header>

      {!started ? (
        <section className="lobby">
          <div className="panel lobby-main">
            <div className="lobby-heading">
              <div>
                <div className="eyebrow">PRE-RAID LOBBY</div>
                <h2>Assemble the operators</h2>
              </div>
              <div className="code-display">{room}</div>
            </div>

            <div className="instruction">
              <span>MISSION</span>
              <p>
                Each round presents a production incident. Select the correct
                remediation before another operator does.
              </p>
            </div>

            <div className="player-list">
              {players.map(p => (
                <div className="lobby-player" key={p.id}>
                  <div className="avatar">{p.name.slice(0, 1).toUpperCase()}</div>
                  <div className="player-info">
                    <strong>{p.name}</strong>
                    <small>{p.id === hostId ? "HOST" : "OPERATOR"}</small>
                  </div>
                  <span className={`ready-state ${p.ready ? "ready" : ""}`}>
                    {p.ready ? "READY" : "WAITING"}
                  </span>
                </div>
              ))}
            </div>

            <div className="lobby-actions">
              <button className={`secondary ${ready ? "ready-button" : ""}`} onClick={toggleReady}>
                {ready ? "✓ READY" : "MARK READY"}
              </button>

              {isHost && (
                <button
                  className="primary"
                  onClick={startRaid}
                  disabled={players.length < 2 || !players.every(p => p.ready)}
                >
                  START RAID
                </button>
              )}
            </div>

            {feedback && <div className="feedback">{feedback}</div>}
          </div>

          <div className="panel howto">
            <div className="panel-title">HOW TO PLAY</div>
            <div className="step"><b>01</b><span>Join the raid with your operator name.</span></div>
            <div className="step"><b>02</b><span>Everyone marks READY.</span></div>
            <div className="step"><b>03</b><span>Read the incident and choose a remediation.</span></div>
            <div className="step"><b>04</b><span>First correct answer gets +100.</span></div>
            <div className="step"><b>05</b><span>Wrong answers cost -15.</span></div>
            <div className="step"><b>06</b><span>Highest score after 10 rounds wins.</span></div>
          </div>
        </section>
      ) : (
        <>
          <div className="matchbar">
            <div className="round">
              ROUND <b>{round}</b> / {maxRounds}
            </div>
            <div className="match-message">
              {countdown !== null ? `NEXT INCIDENT IN ${countdown}` :
               winner ? winner :
               "FIRST CORRECT ANSWER WINS"}
            </div>
            <div className="my-score">
              YOUR SCORE <b>{me?.score ?? 0}</b>
            </div>
          </div>

          <section className="game-grid">
            <div className="panel incident-panel">
              {countdown !== null ? (
                <div className="countdown">
                  <span>{countdown}</span>
                  <small>PREPARE FOR INCIDENT</small>
                </div>
              ) : incident ? (
                <>
                  <div className="incident-meta">
                    <span className={`severity ${incident.severity.toLowerCase()}`}>
                      {incident.severity}
                    </span>
                    <span>{incident.service}</span>
                    <span>{incident.id}</span>
                  </div>

                  <h2>{incident.title}</h2>
                  <p className="incident-description">{incident.description}</p>

                  <div className="impact">
                    <span>IMPACT</span>
                    {incident.impact}
                  </div>

                  <div className="panel-title choice-title">SELECT REMEDIATION</div>

                  <div className="choices">
                    {incident.actions.map((a, i) => (
                      <button
                        key={a.id}
                        className={`choice ${selected === a.id ? "selected" : ""} ${winner && selected === a.id ? "winner" : ""}`}
                        disabled={Boolean(selected || winner)}
                        onClick={() => choose(a.id)}
                      >
                        <span className="choice-key">{String.fromCharCode(65 + i)}</span>
                        <span>{a.label}</span>
                      </button>
                    ))}
                  </div>

                  {feedback && <div className="feedback">{feedback}</div>}
                  {winner && <div className="winner-banner">⚡ {winner}</div>}
                </>
              ) : (
                <div className="waiting">Synchronizing incident feed...</div>
              )}
            </div>

            <div className="panel scoreboard">
              <div className="panel-title">LIVE SCOREBOARD</div>
              {sortedPlayers.map((p, i) => (
                <div className="score-row" key={p.id}>
                  <span className="position">{i + 1}</span>
                  <span className="score-name">
                    {p.name}
                    {p.id === playerId && <em> YOU</em>}
                  </span>
                  <strong>{p.score}</strong>
                </div>
              ))}
            </div>

            <div className="panel terminal">
              <div className="terminal-head">
                <span>EVENT STREAM</span>
                <span className="terminal-live">● STREAMING</span>
              </div>
              <div className="terminal-body">
                {logs.map((line, i) => (
                  <div key={i} className={line.includes("ALERT") ? "alert-line" : line.includes("solved") ? "success-line" : ""}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
