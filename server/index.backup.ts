import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { randomInt } from "crypto";

const app = express();
const http = createServer(app);

const io = new Server(http, {
  cors: {
    origin: "*",
  },
});

type Action = {
  id: string;
  label: string;
  correct: boolean;
};

type Incident = {
  id: string;
  title: string;
  severity: string;
  description: string;
  actions: Action[];
};

type Player = {
  id: string;
  name: string;
  score: number;
};

type Room = {
  players: Map<string, Player>;
  incident: Incident;
  solved: boolean;
};

const rooms = new Map<string, Room>();

const incidents: Incident[] = [
  {
    id: "INC-001",
    title: "S3 Bucket Public Leak",
    severity: "CRITICAL",
    description:
      "Production assets are publicly readable. Lock down public access immediately.",
    actions: [
      {
        id: "a",
        label: "Enable S3 Block Public Access",
        correct: true,
      },
      {
        id: "b",
        label: "Restart Lambda functions",
        correct: false,
      },
      {
        id: "c",
        label: "Increase RDS storage",
        correct: false,
      },
    ],
  },
  {
    id: "INC-002",
    title: "Lambda Timeout",
    severity: "HIGH",
    description:
      "Function requests exceed the configured timeout.",
    actions: [
      {
        id: "a",
        label: "Review downstream latency and adjust timeout",
        correct: true,
      },
      {
        id: "b",
        label: "Delete the S3 bucket",
        correct: false,
      },
      {
        id: "c",
        label: "Disable IAM",
        correct: false,
      },
    ],
  },
  {
    id: "INC-003",
    title: "RDS Connection Pool Exhausted",
    severity: "CRITICAL",
    description:
      "Application requests cannot obtain database connections.",
    actions: [
      {
        id: "a",
        label: "Tune connection pooling and reuse connections",
        correct: true,
      },
      {
        id: "b",
        label: "Make the database publicly accessible",
        correct: false,
      },
      {
        id: "c",
        label: "Increase S3 object size",
        correct: false,
      },
    ],
  },
  {
    id: "INC-004",
    title: "IAM Permission Misconfiguration",
    severity: "HIGH",
    description:
      "A production service has insufficient permissions for its required operation.",
    actions: [
      {
        id: "a",
        label: "Grant the minimum required IAM permission",
        correct: true,
      },
      {
        id: "b",
        label: "Give AdministratorAccess to everyone",
        correct: false,
      },
      {
        id: "c",
        label: "Delete the IAM role",
        correct: false,
      },
    ],
  },
];

function generateRoomCode(): string {
  let code = "";

  do {
    code = String(randomInt(1000, 10000));
  } while (rooms.has(code));

  return code;
}

function broadcastRoom(roomCode: string): void {
  const room = rooms.get(roomCode);

  if (!room) {
    return;
  }

  io.to(roomCode).emit("room:update", {
    code: roomCode,
    players: Array.from(room.players.values()),
  });
}

function addPlayer(
  socket: any,
  roomCode: string,
  name: string
): void {
  const room = rooms.get(roomCode);

  if (!room) {
    return;
  }

  const player: Player = {
    id: socket.id,
    name: String(name || "Operator").trim().slice(0, 24) || "Operator",
    score: 0,
  };

  room.players.set(socket.id, player);

  socket.join(roomCode);

  socket.emit("game:incident", room.incident);

  socket.emit(
    "game:log",
    "[system] Secure uplink established."
  );

  broadcastRoom(roomCode);
}

io.on("connection", (socket) => {
  console.log(`[socket] Connected: ${socket.id}`);

  socket.on(
    "room:create",
    (
      data: { name?: string },
      callback?: (result: { code?: string; error?: string }) => void
    ) => {
      const roomCode = generateRoomCode();

      rooms.set(roomCode, {
        players: new Map(),
        incident: incidents[0],
        solved: false,
      });

      addPlayer(
        socket,
        roomCode,
        data?.name || "Operator"
      );

      callback?.({
        code: roomCode,
      });

      console.log(
        `[room] Created room ${roomCode}`
      );
    }
  );

  socket.on(
    "room:join",
    (
      data: {
        name?: string;
        code?: string;
      },
      callback?: (result: { code?: string; error?: string }) => void
    ) => {
      const roomCode = String(
        data?.code || ""
      ).trim();

      if (!/^\d{4}$/.test(roomCode)) {
        callback?.({
          error: "Room code must be 4 digits.",
        });

        return;
      }

      const room = rooms.get(roomCode);

      if (!room) {
        callback?.({
          error: "Room not found.",
        });

        return;
      }

      if (room.players.size >= 8) {
        callback?.({
          error: "Room is full.",
        });

        return;
      }

      addPlayer(
        socket,
        roomCode,
        data?.name || "Operator"
      );

      callback?.({
        code: roomCode,
      });

      io.to(roomCode).emit(
        "game:log",
        `[system] ${data?.name || "Operator"} joined the room.`
      );

      console.log(
        `[room] Player joined ${roomCode}`
      );
    }
  );

  socket.on(
    "game:start",
    (data: { room?: string }) => {
      const roomCode = String(
        data?.room || ""
      );

      const room = rooms.get(roomCode);

      if (!room) {
        return;
      }

      if (room.players.size < 2) {
        socket.emit(
          "game:feedback",
          "At least 2 players are required to start."
        );

        return;
      }

      room.incident =
        incidents[randomInt(0, incidents.length)];

      room.solved = false;

      io.to(roomCode).emit(
        "game:incident",
        room.incident
      );

      io.to(roomCode).emit(
        "game:log",
        `[system] New incident detected: ${room.incident.title}`
      );

      console.log(
        `[game] Started in room ${roomCode}`
      );
    }
  );

  socket.on(
    "game:action",
    (
      data: {
        room?: string;
        actionId?: string;
      }
    ) => {
      const roomCode = String(
        data?.room || ""
      );

      const room = rooms.get(roomCode);

      if (!room || room.solved) {
        return;
      }

      const player = room.players.get(socket.id);

      if (!player) {
        return;
      }

      const action = room.incident.actions.find(
        (item) => item.id === data?.actionId
      );

      if (!action) {
        socket.emit(
          "game:feedback",
          "Invalid remediation action."
        );

        return;
      }

      if (action.correct) {
        room.solved = true;

        player.score += 100;

        io.to(roomCode).emit(
          "game:feedback",
          `${player.name} resolved the incident! +100`
        );

        io.to(roomCode).emit(
          "game:log",
          `[success] ${player.name} completed remediation.`
        );

        broadcastRoom(roomCode);

        console.log(
          `[game] ${player.name} solved ${room.incident.id} in ${roomCode}`
        );
      } else {
        player.score = Math.max(
          0,
          player.score - 15
        );

        socket.emit(
          "game:feedback",
          "Incorrect remediation. -15"
        );

        io.to(roomCode).emit(
          "game:log",
          `[warning] ${player.name} submitted an invalid action.`
        );

        broadcastRoom(roomCode);
      }
    }
  );

  socket.on(
    "disconnect",
    () => {
      console.log(
        `[socket] Disconnected: ${socket.id}`
      );

      for (const [roomCode, room] of rooms) {
        if (room.players.delete(socket.id)) {
          broadcastRoom(roomCode);

          io.to(roomCode).emit(
            "game:log",
            "[system] An operator disconnected."
          );

          if (room.players.size === 0) {
            rooms.delete(roomCode);

            console.log(
              `[room] Deleted empty room ${roomCode}`
            );
          }
        }
      }
    }
  );
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "cloud-heist-server",
    rooms: rooms.size,
  });
});

const PORT = Number(
  process.env.PORT || 4000
);

http.listen(
  PORT,
  "127.0.0.1",
  () => {
    console.log(
      `Cloud Heist server listening on http://127.0.0.1:${PORT}`
    );
  }
);
