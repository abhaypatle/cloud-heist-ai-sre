import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

type Action = { id: string; label: string };
type Incident = {
  id: string;
  title: string;
  service: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  description: string;
  impact: string;
  actions: Action[];
  correctAction: string;
};

type Player = {
  id: string;
  name: string;
  score: number;
  ready: boolean;
  connected: boolean;
};

type RoundResult = {
  round: number;
  winnerId?: string;
  winnerName?: string;
  incident: string;
};

type Room = {
  code: string;
  hostId: string;
  players: Map<string, Player>;
  started: boolean;
  finished: boolean;
  round: number;
  maxRounds: number;
  incident?: Incident;
  solved: boolean;
  roundResults: RoundResult[];
  logs: string[];
  countdown?: NodeJS.Timeout;
  nextRound?: NodeJS.Timeout;
};

const app = express();
app.use(cors({ origin: true }));
app.get("/health", (_req, res) => res.json({ ok: true, service: "cloud-heist-server" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = new Map<string, Room>();
const socketRoom = new Map<string, string>();
const PORT = Number(process.env.PORT || 4000);

const incidents: Incident[] = [
  {
    id: "INC-001",
    title: "S3 Bucket Public Leak",
    service: "AWS S3",
    severity: "CRITICAL",
    description: "Production customer assets are publicly readable from an object storage bucket.",
    impact: "Potential data exposure and unauthorized downloads.",
    actions: [
      { id: "a", label: "Enable S3 Block Public Access" },
      { id: "b", label: "Restart Lambda functions" },
      { id: "c", label: "Increase RDS storage" }
    ],
    correctAction: "a"
  },
  {
    id: "INC-002",
    title: "Lambda Timeout Storm",
    service: "AWS Lambda",
    severity: "HIGH",
    description: "A payment Lambda is timing out because a downstream dependency has increased latency.",
    impact: "Failed requests and elevated retry traffic.",
    actions: [
      { id: "a", label: "Review downstream latency and adjust timeout" },
      { id: "b", label: "Delete the production database" },
      { id: "c", label: "Disable IAM authentication" }
    ],
    correctAction: "a"
  },
  {
    id: "INC-003",
    title: "RDS Connection Pool Exhausted",
    service: "AWS RDS",
    severity: "HIGH",
    description: "Application instances are consuming database connections faster than they release them.",
    impact: "New requests cannot establish database sessions.",
    actions: [
      { id: "a", label: "Tune connection pooling and reuse connections" },
      { id: "b", label: "Make the database publicly accessible" },
      { id: "c", label: "Remove all database indexes" }
    ],
    correctAction: "a"
  },
  {
    id: "INC-004",
    title: "IAM Permission Misconfiguration",
    service: "AWS IAM",
    severity: "CRITICAL",
    description: "A deployment role has excessive permissions outside its required resources.",
    impact: "Privilege escalation and unnecessary blast radius.",
    actions: [
      { id: "a", label: "Grant minimum required IAM permission" },
      { id: "b", label: "Attach AdministratorAccess everywhere" },
      { id: "c", label: "Disable CloudTrail" }
    ],
    correctAction: "a"
  },
  {
    id: "INC-005",
    title: "CloudFront Origin Failure",
    service: "AWS CloudFront",
    severity: "HIGH",
    description: "Edge requests are returning origin errors after a configuration change.",
    impact: "Users receive intermittent 5xx responses.",
    actions: [
      { id: "a", label: "Validate origin health and CloudFront origin configuration" },
      { id: "b", label: "Delete all DNS records" },
      { id: "c", label: "Disable HTTPS" }
    ],
    correctAction: "a"
  },
  {
    id: "INC-006",
    title: "ECS CPU Saturation",
    service: "AWS ECS",
    severity: "HIGH",
    description: "Service CPU utilization remains above capacity during normal traffic.",
    impact: "Request latency is increasing across the service.",
    actions: [
      { id: "a", label: "Scale service capacity and inspect CPU-heavy workloads" },
      { id: "b", label: "Remove health checks" },
      { id: "c", label: "Expose the container directly to the internet" }
    ],
    correctAction: "a"
  },
  {
    id: "INC-007",
    title: "Redis Cache Eviction Spike",
    service: "Redis",
    severity: "MEDIUM",
    description: "Cache eviction has increased sharply and hit rate has dropped.",
    impact: "More requests are reaching the primary datastore.",
    actions: [
      { id: "a", label: "Inspect memory pressure and tune cache capacity/TTL" },
      { id: "b", label: "Delete production records" },
      { id: "c", label: "Disable application authentication" }
    ],
    correctAction: "a"
  },
  {
    id: "INC-008",
    title: "Deployment Health Check Failure",
    service: "CI/CD",
    severity: "HIGH",
    description: "The newest deployment is failing health checks during rollout.",
    impact: "Traffic cannot safely shift to the new version.",
    actions: [
      { id: "a", label: "Inspect failed health checks and roll back if required" },
      { id: "b", label: "Ignore failed health checks" },
      { id: "c", label: "Delete the deployment pipeline" }
    ],
    correctAction: "a"
  },
  {
    id: "INC-009",
    title: "API Rate Limit Breach",
    service: "API Gateway",
    severity: "MEDIUM",
    description: "A client is generating abnormal request volume against a production API.",
    impact: "Legitimate clients may experience throttling.",
    actions: [
      { id: "a", label: "Identify the client and enforce appropriate throttling" },
      { id: "b", label: "Remove all API authentication" },
      { id: "c", label: "Increase database deletion permissions" }
    ],
    correctAction: "a"
  },
  {
    id: "INC-010",
    title: "Secrets Exposure in CI Logs",
    service: "CI/CD",
    severity: "CRITICAL",
    description: "A build log contains a credential that should never have been printed.",
    impact: "A leaked secret could be reused by an attacker.",
    actions: [
      { id: "a", label: "Rotate the secret and remove sensitive output from CI logs" },
      { id: "b", label: "Commit the secret to the repository" },
      { id: "c", label: "Disable all audit logging" }
    ],
    correctAction: "a"
  }
];

function safePlayers(room: Room) {
  return [...room.players.values()].map(({ id, name, score, ready, connected }) => ({
    id, name, score, ready, connected
  }));
}

function emitRoom(room: Room) {
  io.to(room.code).emit("room:update", {
    code: room.code,
    hostId: room.hostId,
    players: safePlayers(room),
    started: room.started,
    finished: room.finished,
    round: room.round,
    maxRounds: room.maxRounds,
    solved: room.solved
  });
}

function emitLogs(room: Room) {
  io.to(room.code).emit("game:logs", room.logs.slice(-40));
}

function log(room: Room, message: string) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  room.logs.push(line);
  emitLogs(room);
}

function clearTimers(room: Room) {
  if (room.countdown) clearTimeout(room.countdown);
  if (room.nextRound) clearTimeout(room.nextRound);
  room.countdown = undefined;
  room.nextRound = undefined;
}

function chooseIncident(room: Room) {
  const available = incidents.filter(x => !room.roundResults.some(r => r.incident === x.id));
  return available[Math.floor(Math.random() * available.length)] || incidents[Math.floor(Math.random() * incidents.length)];
}

function startRound(room: Room) {
  if (!room.started || room.finished) return;

  room.round += 1;
  room.solved = false;
  room.incident = chooseIncident(room);
  room.logs = [];

  io.to(room.code).emit("game:countdown", { seconds: 3, round: room.round });
  log(room, `ROUND ${room.round}/${room.maxRounds} initialized`);
  log(room, `INCIDENT DETECTED // ${room.incident.service}`);

  emitRoom(room);

  room.countdown = setTimeout(() => {
    if (!room.started || room.finished || !room.incident) return;

    io.to(room.code).emit("game:incident", {
      round: room.round,
      maxRounds: room.maxRounds,
      incident: room.incident
    });

    log(room, `ALERT // ${room.incident.title}`);
    log(room, `OBJECTIVE // ${room.incident.description}`);
  }, 3000);
}

function finishGame(room: Room) {
  room.finished = true;
  room.started = false;
  clearTimers(room);

  const ranking = safePlayers(room).sort((a, b) => b.score - a.score);
  const winner = ranking[0];

  log(room, "RAID COMPLETE // incident queue cleared");
  if (winner) log(room, `TOP OPERATOR // ${winner.name} // ${winner.score} PTS`);

  io.to(room.code).emit("game:finished", {
    players: ranking,
    roundResults: room.roundResults
  });

  emitRoom(room);
}

function startGame(room: Room) {
  if (room.started) return;
  if (room.players.size < 2) return;
  if (![...room.players.values()].every(p => p.ready)) return;

  room.started = true;
  room.finished = false;
  room.round = 0;
  room.solved = false;
  room.roundResults = [];
  room.logs = [];

  for (const p of room.players.values()) p.score = 0;

  log(room, "SECURE RAID STARTED");
  log(room, `OPERATORS ONLINE // ${room.players.size}`);
  startRound(room);
}

io.on("connection", socket => {
  socket.on("room:create", ({ name, playerId }: { name: string; playerId?: string }, cb) => {
    const code = String(Math.floor(1000 + Math.random() * 9000));

    if (rooms.has(code)) {
      cb?.({ error: "ROOM COLLISION. TRY AGAIN." });
      return;
    }

    const id = playerId || socket.id;
    const room: Room = {
      code,
      hostId: id,
      players: new Map(),
      started: false,
      finished: false,
      round: 0,
      maxRounds: 10,
      solved: false,
      roundResults: [],
      logs: ["[SYSTEM] Secure uplink established."]
    };

    room.players.set(id, {
      id,
      name: String(name || "Operator").slice(0, 18),
      score: 0,
      ready: true,
      connected: true
    });

    rooms.set(code, room);
    socketRoom.set(socket.id, code);
    socket.join(code);

    cb?.({ ok: true, code, playerId: id });
    emitRoom(room);
    emitLogs(room);
  });

  socket.on("room:join", ({ name, code, playerId }: { name: string; code: string; playerId?: string }, cb) => {
    const room = rooms.get(String(code || "").trim());

    if (!room) {
      cb?.({ error: "ROOM NOT FOUND." });
      return;
    }

    if (room.started) {
      cb?.({ error: "RAID ALREADY STARTED." });
      return;
    }

    if (room.players.size >= 8) {
      cb?.({ error: "ROOM FULL." });
      return;
    }

    const id = playerId || socket.id;

    room.players.set(id, {
      id,
      name: String(name || "Operator").slice(0, 18),
      score: 0,
      ready: false,
      connected: true
    });

    socketRoom.set(socket.id, code);
    socket.join(code);

    cb?.({ ok: true, code, playerId: id });
    log(room, `${name || "Operator"} joined the raid.`);
    emitRoom(room);
  });

  socket.on("player:ready", ({ room: code, playerId, ready }: { room: string; playerId: string; ready: boolean }) => {
    const room = rooms.get(code);
    if (!room || room.started) return;

    const player = room.players.get(playerId);
    if (!player) return;

    player.ready = Boolean(ready);
    log(room, `${player.name} is ${player.ready ? "READY" : "NOT READY"}.`);
    emitRoom(room);
  });

  socket.on("game:start", ({ room: code }: { room: string }) => {
    const room = rooms.get(code);
    if (!room) return;

    if (room.players.size < 2) {
      io.to(socket.id).emit("game:feedback", "Need at least 2 operators.");
      return;
    }

    if (room.hostId !== [...room.players.values()].find(p => p.connected && socketRoom.get(socket.id) === code)?.id) {
      io.to(socket.id).emit("game:feedback", "Only the host can launch the raid.");
      return;
    }

    if (![...room.players.values()].every(p => p.ready)) {
      io.to(socket.id).emit("game:feedback", "All operators must be READY.");
      return;
    }

    startGame(room);
  });

  socket.on("game:action", ({ room: code, playerId, actionId }: { room: string; playerId: string; actionId: string }) => {
    const room = rooms.get(code);
    if (!room || !room.started || room.finished || room.solved || !room.incident) return;

    const player = room.players.get(playerId);
    if (!player || !player.connected) return;

    const action = room.incident.actions.find(a => a.id === actionId);
    if (!action) return;

    if (actionId !== room.incident.correctAction) {
      player.score -= 15;
      io.to(socket.id).emit("game:feedback", "INCORRECT // -15 points");
      log(room, `${player.name} selected an incorrect remediation.`);
      emitRoom(room);
      return;
    }

    room.solved = true;
    player.score += 100;

    room.roundResults.push({
      round: room.round,
      winnerId: player.id,
      winnerName: player.name,
      incident: room.incident.id
    });

    log(room, `${player.name} solved the incident FIRST // +100`);
    io.to(room.code).emit("game:round-winner", {
      round: room.round,
      playerId: player.id,
      playerName: player.name,
      points: 100
    });

    emitRoom(room);

    room.nextRound = setTimeout(() => {
      if (room.round >= room.maxRounds) {
        finishGame(room);
      } else {
        startRound(room);
      }
    }, 1800);
  });

  socket.on("game:play-again", ({ room: code }: { room: string }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (room.hostId !== socketRoom.get(socket.id)) return;

    clearTimers(room);
    room.started = false;
    room.finished = false;
    room.round = 0;
    room.solved = false;
    room.incident = undefined;
    room.roundResults = [];
    room.logs = ["[SYSTEM] New raid prepared. Awaiting operators."];

    for (const p of room.players.values()) {
      p.score = 0;
      p.ready = p.id === room.hostId;
    }

    emitRoom(room);
    emitLogs(room);
  });

  socket.on("disconnect", () => {
    const code = socketRoom.get(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    const player = [...room.players.values()].find(p => p.id === socket.id);
    if (player) {
      player.connected = false;
      log(room, `${player.name} connection lost.`);
      emitRoom(room);
    }

    socketRoom.delete(socket.id);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Cloud Heist server running on http://127.0.0.1:${PORT}`);
});
