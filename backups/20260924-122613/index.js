
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"] }
});

const PORT = 4000;
const ROUND_TIME = 15;
const COUNTDOWN = 3;
const NEXT_ROUND_DELAY = 1800;

const incidents = [
  {
    id:"INC-001", service:"AWS S3", severity:"CRITICAL",
    title:"S3 Bucket Public Leak",
    description:"A production bucket containing customer exports is publicly readable.",
    impact:"Sensitive data may be exposed to unauthenticated internet users.",
    options:[
      "Enable S3 Block Public Access",
      "Increase the bucket storage class",
      "Restart the S3 service"
    ], correct:0
  },
  {
    id:"INC-002", service:"AWS LAMBDA", severity:"HIGH",
    title:"Lambda Timeout Storm",
    description:"Lambda executions are repeatedly timing out under normal traffic.",
    impact:"Requests are failing and downstream workloads are backing up.",
    options:[
      "Review downstream latency and adjust timeout",
      "Delete all Lambda functions",
      "Disable CloudWatch"
    ], correct:0
  },
  {
    id:"INC-003", service:"AWS RDS", severity:"CRITICAL",
    title:"RDS Connection Pool Exhausted",
    description:"Application instances are exhausting available database connections.",
    impact:"New requests cannot obtain a database connection.",
    options:[
      "Tune connection pooling and reuse connections",
      "Delete the database",
      "Disable database authentication"
    ], correct:0
  },
  {
    id:"INC-004", service:"AWS IAM", severity:"CRITICAL",
    title:"IAM Permission Misconfiguration",
    description:"A workload has permissions broader than required for its task.",
    impact:"A compromised workload could access unrelated cloud resources.",
    options:[
      "Grant minimum required IAM permission",
      "Attach AdministratorAccess",
      "Make the policy public"
    ], correct:0
  },
  {
    id:"INC-005", service:"AWS CLOUDFRONT", severity:"HIGH",
    title:"CloudFront Origin Failure",
    description:"The CDN cannot successfully reach the configured application origin.",
    impact:"Users are receiving origin errors from the edge.",
    options:[
      "Validate origin health and CloudFront origin configuration",
      "Disable HTTPS",
      "Delete the distribution"
    ], correct:0
  },
  {
    id:"INC-006", service:"AWS ECS", severity:"HIGH",
    title:"ECS CPU Saturation",
    description:"Service CPU utilization is pinned near 100 percent.",
    impact:"Latency is increasing and requests are beginning to fail.",
    options:[
      "Scale service capacity and inspect CPU-heavy workloads",
      "Reduce task count to zero",
      "Disable monitoring"
    ], correct:0
  },
  {
    id:"INC-007", service:"AWS ELASTICACHE", severity:"HIGH",
    title:"Redis Cache Eviction Spike",
    description:"Redis is aggressively evicting keys because memory pressure is high.",
    impact:"Cache hit rate is collapsing and database load is rising.",
    options:[
      "Inspect memory pressure and tune cache capacity/TTL",
      "Delete Redis immediately",
      "Disable all cache reads"
    ], correct:0
  },
  {
    id:"INC-008", service:"AWS ECS", severity:"CRITICAL",
    title:"Deployment Health Check Failure",
    description:"The newest deployment is failing its service health checks.",
    impact:"Unhealthy tasks are entering production traffic.",
    options:[
      "Inspect failed health checks and roll back if required",
      "Increase DNS TTL",
      "Disable the health checks"
    ], correct:0
  },
  {
    id:"INC-009", service:"API GATEWAY", severity:"HIGH",
    title:"API Rate Limit Breach",
    description:"A client is generating traffic beyond the expected request rate.",
    impact:"Other customers are experiencing degraded API availability.",
    options:[
      "Identify client and enforce appropriate throttling",
      "Remove every API limit",
      "Restart all client devices"
    ], correct:0
  },
  {
    id:"INC-010", service:"CI/CD", severity:"CRITICAL",
    title:"Secrets Exposure in CI Logs",
    description:"A CI pipeline has printed a credential into build logs.",
    impact:"Anyone with log access may obtain a valid secret.",
    options:[
      "Rotate secret and remove sensitive output from CI logs",
      "Ignore the log",
      "Grant the pipeline more permissions"
    ], correct:0
  }
];

const rooms = new Map();

function cleanName(name, fallback) {
  const n = String(name || "").trim().replace(/\s+/g," ").slice(0,24);
  return n || fallback;
}

function makeCode() {
  for (;;) {
    const code = String(Math.floor(1000 + Math.random()*9000));
    if (!rooms.has(code)) return code;
  }
}

function log(room, message) {
  const entry = {
    id: Date.now() + Math.random(),
    at: new Date().toISOString(),
    message
  };
  room.logs.push(entry);
  if (room.logs.length > 80) room.logs.shift();
  io.to(room.code).emit("game:logs", entry);
}

function roomView(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    finished: room.finished,
    round: room.round,
    maxRounds: room.maxRounds,
    incident: room.incident,
    solved: room.solved,
    timer: room.timer,
    players: [...room.players.values()].map(p => ({
      id:p.id,
      name:p.name,
      score:p.score,
      ready:p.ready,
      connected:p.connected,
      correct:p.correct,
      wrong:p.wrong,
      timeouts:p.timeouts
    }))
  };
}

function emitRoom(room) {
  io.to(room.code).emit("room:update", roomView(room));
}

function sendFeedback(room, player, delta, message, type) {
  const sockets = io.sockets.sockets;
  for (const socket of sockets.values()) {
    if (socket.data.playerId === player.id && socket.data.roomCode === room.code) {
      socket.emit("game:feedback", {
        type,
        delta,
        message,
        score:player.score
      });
    }
  }
}

function clearRoundTimer(room) {
  if (room.timerHandle) {
    clearInterval(room.timerHandle);
    room.timerHandle = null;
  }
}

function finishGame(room) {
  clearRoundTimer(room);
  room.started = false;
  room.finished = true;
  room.solved = true;
  room.timer = 0;

  const leaderboard = [...room.players.values()]
    .sort((a,b) => b.score-a.score)
    .map((p,i) => ({
      rank:i+1,
      id:p.id,
      name:p.name,
      score:p.score,
      correct:p.correct,
      wrong:p.wrong,
      timeouts:p.timeouts
    }));

  io.to(room.code).emit("game:finished", {
    leaderboard,
    rounds:room.roundResults
  });

  emitRoom(room);
}

function startRound(room) {
  clearRoundTimer(room);

  if (room.round > room.maxRounds) {
    finishGame(room);
    return;
  }

  room.solved = false;
  room.timer = ROUND_TIME;
  room.attempted = new Set();
  room.incident = incidents[room.round-1];

  const publicIncident = {
    id:room.incident.id,
    service:room.incident.service,
    severity:room.incident.severity,
    title:room.incident.title,
    description:room.incident.description,
    impact:room.incident.impact,
    options:room.incident.options
  };

  io.to(room.code).emit("game:countdown", { seconds:COUNTDOWN });
  log(room, "ROUND " + room.round + "/" + room.maxRounds + " initialized");
  log(room, "INCIDENT DETECTED // " + room.incident.service);

  setTimeout(() => {
    if (!room.started || room.finished) return;

    io.to(room.code).emit("game:incident", {
      round:room.round,
      incident:publicIncident,
      seconds:ROUND_TIME
    });

    log(room, "ALERT // " + room.incident.title);
    log(room, "OBJECTIVE // FIRST CORRECT ANSWER WINS");

    io.to(room.code).emit("game:timer", { seconds:room.timer });
    
    room.timerHandle = setInterval(() => {
      if (!room.started || room.finished || room.solved) {
        clearRoundTimer(room);
        return;
      }

      room.timer -= 1;
      io.to(room.code).emit("game:timer", { seconds:Math.max(0,room.timer) });

      if (room.timer <= 0) {
        clearRoundTimer(room);
        room.solved = true;

        for (const player of room.players.values()) {
          if (player.connected) player.timeouts += 1;
        }

        room.roundResults.push({
          round:room.round,
          incidentId:room.incident.id,
          winnerId:null,
          winnerName:null,
          result:"TIMEOUT"
        });

        log(room, "TIMEOUT // INCIDENT ESCAPED RESPONSE WINDOW");
        io.to(room.code).emit("game:timeout", {
          round:room.round,
          message:"Response window expired."
        });

        setTimeout(() => {
          room.round += 1;
          startRound(room);
        }, NEXT_ROUND_DELAY);
      }
    }, 1000);

    emitRoom(room);
  }, COUNTDOWN * 1000);
}

function playerForSocket(socket, room) {
  const id = socket.data.playerId;
  return id ? room.players.get(id) : null;
}

function transferHost(room) {
  if (room.players.get(room.hostId)?.connected) return;

  const next = [...room.players.values()].find(p => p.connected);
  if (!next) return;

  room.hostId = next.id;
  next.ready = false;
  log(room, "HOST TRANSFERRED // " + next.name);
  emitRoom(room);
}

app.get("/health", (req,res) => {
  res.json({
    ok:true,
    service:"cloud-heist-server",
    rooms:rooms.size,
    time:new Date().toISOString()
  });
});

io.on("connection", socket => {
  socket.on("room:create", ({name,playerId}, ack) => {
    const id = String(playerId || socket.id);
    const code = makeCode();
    const player = {
      id,
      name:cleanName(name,"Operator 1"),
      score:0,
      ready:false,
      connected:true,
      correct:0,
      wrong:0,
      timeouts:0
    };

    const room = {
      code,
      hostId:id,
      players:new Map([[id,player]]),
      started:false,
      finished:false,
      round:0,
      maxRounds:10,
      incident:null,
      solved:false,
      timer:0,
      attempted:new Set(),
      roundResults:[],
      logs:[],
      timerHandle:null
    };

    rooms.set(code,room);

    socket.data.playerId=id;
    socket.data.roomCode=code;
    socket.join(code);

    log(room, player.name + " created room " + code);
    emitRoom(room);

    if (ack) ack({ok:true,code});
  });

  socket.on("room:join", ({code,name,playerId}, ack) => {
    const room = rooms.get(String(code || "").trim());

    if (!room) return ack && ack({ok:false,error:"Room not found."});
    if (room.started) return ack && ack({ok:false,error:"Raid already started."});

    const id = String(playerId || socket.id);
    let player = room.players.get(id);

    if (player) {
      player.name = cleanName(name,player.name);
      player.connected = true;
    } else {
      if (room.players.size >= 8) {
        return ack && ack({ok:false,error:"Room is full."});
      }

      player = {
        id,
        name:cleanName(name,"Operator " + (room.players.size+1)),
        score:0,
        ready:false,
        connected:true,
        correct:0,
        wrong:0,
        timeouts:0
      };

      room.players.set(id,player);
    }

    socket.data.playerId=id;
    socket.data.roomCode=room.code;
    socket.join(room.code);

    log(room, player.name + " joined the operation");
    emitRoom(room);

    if (ack) ack({ok:true,code:room.code});
  });

  socket.on("player:ready", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.started) return;

    const player = playerForSocket(socket,room);
    if (!player) return;

    player.ready = !player.ready;
    log(room, player.name + (player.ready ? " is READY." : " is NOT READY."));
    emitRoom(room);
  });

  socket.on("game:start", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.started || room.finished) return;

    const player = playerForSocket(socket,room);
    if (!player || room.hostId !== player.id) return;

    const connected = [...room.players.values()].filter(p => p.connected);

    if (connected.length < 2) {
      socket.emit("game:feedback", {
        type:"error", delta:0,
        message:"Need at least 2 connected operators.",
        score:player.score
      });
      return;
    }

    if (!connected.every(p => p.ready)) {
      socket.emit("game:feedback", {
        type:"error", delta:0,
        message:"Every connected operator must be ready.",
        score:player.score
      });
      return;
    }

    room.started = true;
    room.finished = false;
    room.round = 1;
    room.roundResults = [];

    for (const p of room.players.values()) {
      p.score = 0;
      p.correct = 0;
      p.wrong = 0;
      p.timeouts = 0;
    }

    log(room, "RAID STARTED // ALL SYSTEMS ARMED");
    emitRoom(room);
    startRound(room);
  });

  socket.on("game:action", ({answer}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.started || room.finished || room.solved) return;

    const player = playerForSocket(socket,room);
    if (!player || !player.connected) return;

    if (room.attempted.has(player.id)) {
      socket.emit("game:feedback", {
        type:"locked", delta:0,
        message:"Your response is already locked for this round.",
        score:player.score
      });
      return;
    }

    room.attempted.add(player.id);

    const selected = Number(answer);

    if (selected === room.incident.correct) {
      room.solved = true;
      clearRoundTimer(room);

      player.score += 100;
      player.correct += 1;

      const result = {
        round:room.round,
        incidentId:room.incident.id,
        winnerId:player.id,
        winnerName:player.name,
        result:"CORRECT"
      };

      room.roundResults.push(result);

      log(room, player.name + " solved the incident first. +100 POINTS");

      sendFeedback(
        room,
        player,
        100,
        "CORRECT REMEDIATION // +100",
        "correct"
      );

      io.to(room.code).emit("game:round-winner", {
        round:room.round,
        playerId:player.id,
        playerName:player.name,
        score:player.score
      });

      emitRoom(room);

      setTimeout(() => {
        if (!room.finished) {
          room.round += 1;
          startRound(room);
        }
      }, NEXT_ROUND_DELAY);

    } else {
      player.score = Math.max(0,player.score - 15);
      player.wrong += 1;

      sendFeedback(
        room,
        player,
        -15,
        "INCORRECT REMEDIATION // -15 // RESPONSE LOCKED",
        "wrong"
      );

      log(room, player.name + " selected an incorrect remediation. -15");
      emitRoom(room);
    }
  });

  socket.on("game:play-again", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.started) return;

    const player = playerForSocket(socket,room);
    if (!player || room.hostId !== player.id) return;

    room.finished = false;
    room.round = 0;
    room.incident = null;
    room.solved = false;
    room.timer = 0;
    room.roundResults = [];

    for (const p of room.players.values()) {
      p.score = 0;
      p.correct = 0;
      p.wrong = 0;
      p.timeouts = 0;
      p.ready = false;
    }

    log(room, "NEW RAID CONFIGURED // READY CHECK REQUIRED");
    emitRoom(room);
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;

    const player = room.players.get(socket.data.playerId);
    if (!player) return;

    player.connected = false;
    player.ready = false;

    log(room, player.name + " disconnected");
    transferHost(room);
    emitRoom(room);

    const anyConnected = [...room.players.values()].some(p => p.connected);

    if (!anyConnected) {
      setTimeout(() => {
        const current = rooms.get(room.code);
        if (current && ![...current.players.values()].some(p => p.connected)) {
          clearRoundTimer(current);
          rooms.delete(room.code);
        }
      }, 30 * 60 * 1000);
    }
  });
});

server.listen(PORT,"127.0.0.1",() => {
  console.log("CLOUD HEIST SERVER running on http://127.0.0.1:" + PORT);
});
