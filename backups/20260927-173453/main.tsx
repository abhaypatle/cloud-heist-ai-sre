import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import "./style.css";

const socket = io(
  import.meta.env.VITE_SERVER_URL || "http://127.0.0.1:4000",
  { autoConnect: false }
);

type Player = {
  id: string;
  name: string;
  score: number;
};

type Incident = {
  id: string;
  title: string;
  severity: string;
  description: string;
  actions: {
    id: string;
    label: string;
    correct: boolean;
  }[];
  round?: number;
  maxRounds?: number;
};

function App() {
  const [name, setName] = useState("Operator");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "[system] Awaiting secure uplink...",
  ]);
  const [joined, setJoined] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [round, setRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(10);
  const [started, setStarted] = useState(false);
  const [solved, setSolved] = useState(false);
  const [finished, setFinished] = useState(false);
  const [winner, setWinner] = useState("");

  useEffect(() => {
    const onRoomUpdate = (data: any) => {
      setRoom(data.code);
      setPlayers(data.players || []);
      setRound(data.round || 0);
      setMaxRounds(data.maxRounds || 10);
      setStarted(Boolean(data.started));
      setSolved(Boolean(data.solved));
      setJoined(true);
    };

    const onIncident = (data: Incident) => {
      setIncident(data);
      setRound(data.round || 0);
      setMaxRounds(data.maxRounds || 10);
      setSolved(false);
      setFinished(false);
      setWinner("");
      setFeedback("");
    };

    const onLogs = (data: string[]) => {
      setLogs(data || []);
    };

    const onFeedback = (message: string) => {
      setFeedback(message);
    };

    const onWinner = (data: any) => {
      setWinner(data.playerName || "Operator");
      setSolved(true);
      setFeedback(
        `${data.playerName || "Operator"} wins Round ${data.round}! +100`
      );
    };

    const onFinished = (data: any) => {
      setFinished(true);
      setStarted(false);
      setSolved(true);
      setPlayers(data.players || []);
      setFeedback("RAID COMPLETE!");
    };

    socket.on("room:update", onRoomUpdate);
    socket.on("game:incident", onIncident);
    socket.on("game:logs", onLogs);
    socket.on("game:feedback", onFeedback);
    socket.on("game:round-winner", onWinner);
    socket.on("game:finished", onFinished);

    return () => {
      socket.off("room:update", onRoomUpdate);
      socket.off("game:incident", onIncident);
      socket.off("game:logs", onLogs);
      socket.off("game:feedback", onFeedback);
      socket.off("game:round-winner", onWinner);
      socket.off("game:finished", onFinished);
    };
  }, []);

  const create = () => {
    socket.connect();

    socket.emit(
      "room:create",
      { name },
      (result: any) => {
        if (result?.error) {
          setFeedback(result.error);
          return;
        }

        setRoom(result.code);
        setJoined(true);
      }
    );
  };

  const join = () => {
    socket.connect();

    socket.emit(
      "room:join",
      { name, code },
      (result: any) => {
        if (result?.error) {
          setFeedback(result.error);
          return;
        }

        setRoom(result.code);
        setJoined(true);
      }
    );
  };

  const startRaid = () => {
    if (started) return;

    setFeedback("");
    socket.emit("game:start", { room });
  };

  const act = (actionId: string) => {
    if (!started || solved || finished) return;

    socket.emit("game:action", {
      room,
      actionId,
    });
  };

  const playAgain = () => {
    setFinished(false);
    setSolved(false);
    setWinner("");
    setFeedback("");
    setIncident(null);
    setRound(0);

    socket.emit("game:start", { room });
  };

  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">
            CLOUD HEIST // DEVOPS SABOTAGE
          </span>

          <h1>Cloud Operations Console</h1>
        </div>

        <span className="live">? LIVE</span>
      </header>

      {!joined ? (
        <section className="panel landing">
          <h2>Establish uplink</h2>

          <p>
            Race another operator to solve cloud incidents.
            First correct answer wins the round.
          </p>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Operator name"
          />

          <button onClick={create}>
            CREATE ROOM
          </button>

          <div className="or">
            OR JOIN EXISTING ROOM
          </div>

          <input
            value={code}
            onChange={(e) =>
              setCode(
                e.target.value
                  .replace(/\D/g, "")
                  .slice(0, 4)
              )
            }
            placeholder="4-digit room code"
          />

          <button
            className="secondary"
            onClick={join}
          >
            JOIN ROOM
          </button>

          {feedback && (
            <p className="error">{feedback}</p>
          )}
        </section>
      ) : (
        <>
          <div className="topline">
            <span>
              ROOM <b>{room}</b>
            </span>

            <span>
              OPERATORS <b>{players.length}</b>
            </span>

            <span>
              ROUND <b>{round}/{maxRounds}</b>
            </span>

            {!started && !finished && (
              <button onClick={startRaid}>
                START RAID
              </button>
            )}
          </div>

          {finished ? (
            <section className="panel finish">
              <div className="tag">RAID COMPLETE</div>

              <h2>?? Cloud Heist Complete</h2>

              <p>
                All {maxRounds} rounds are finished.
              </p>

              {players
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((player, index) => (
                  <div
                    className="player"
                    key={player.id}
                  >
                    <span>
                      {index + 1}. {player.name}
                    </span>

                    <b>{player.score}</b>
                  </div>
                ))}

              <button onClick={playAgain}>
                PLAY AGAIN
              </button>
            </section>
          ) : (
            <section className="grid">
              <div className="panel incident">
                {incident ? (
                  <>
                    <div className="round-info">
                      ROUND {round} / {maxRounds}
                    </div>

                    <div className="tag">
                      {incident.severity}
                    </div>

                    <h2>{incident.title}</h2>

                    <p>{incident.description}</p>

                    <div className="race-help">
                      ? FIRST CORRECT ANSWER WINS
                    </div>

                    <h3>
                      SELECT REMEDIATION
                    </h3>

                    {incident.actions.map(
                      (action) => (
                        <button
                          key={action.id}
                          className="action"
                          disabled={
                            !started ||
                            solved
                          }
                          onClick={() =>
                            act(action.id)
                          }
                        >
                          {action.label}
                        </button>
                      )
                    )}

                    {winner && (
                      <p className="winner">
                        ?? {winner} won this round!
                      </p>
                    )}

                    {feedback && (
                      <p className="feedback">
                        {feedback}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="tag">
                      READY
                    </div>

                    <h2>
                      Prepare for the raid
                    </h2>

                    <p>
                      Wait for the raid to start.
                      You will receive a cloud
                      incident and three possible
                      remediation actions.
                    </p>

                    <div className="race-help">
                      ? First correct answer wins
                      +100 points
                    </div>
                  </>
                )}
              </div>

              <div className="panel">
                <h3>LIVE SCOREBOARD</h3>

                {players
                  .slice()
                  .sort(
                    (a, b) => b.score - a.score
                  )
                  .map((player, index) => (
                    <div
                      className="player"
                      key={player.id}
                    >
                      <span>
                        {index + 1}. {player.name}
                      </span>

                      <b>{player.score}</b>
                    </div>
                  ))}
              </div>

              <div className="panel terminal">
                <h3>EVENT STREAM</h3>

                {logs.map((log, index) => (
                  <div key={index}>
                    {log}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

createRoot(
  document.getElementById("root")!
).render(<App />);
