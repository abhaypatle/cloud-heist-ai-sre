const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Multi-Cloud Profiles
const CLOUD_PROFILES = {
  aws: {
    name: "AWS us-east-1 (N. Virginia)",
    services: { edge: "ALB CloudFront", gw: "Kong API Gateway", compute: "EKS Pods v1.30", db: "Aurora PostgreSQL", cache: "ElastiCache Redis" },
    costPerSec: 420
  },
  gcp: {
    name: "GCP europe-west3 (Frankfurt)",
    services: { edge: "Cloud Armor GCLB", gw: "Apigee Proxy", compute: "GKE Autopilot", db: "Cloud Spanner Leader", cache: "Memorystore Cluster" },
    costPerSec: 480
  },
  azure: {
    name: "Azure eastus2 (Virginia)",
    services: { edge: "Front Door WAF", gw: "Azure APIM", compute: "AKS Enterprise", db: "CosmosDB Multi-Master", cache: "Azure Managed Redis" },
    costPerSec: 450
  }
};

let activeCloudKey = "aws";
let isResolved = false;
let startTime = Date.now();
let mitigationTime = null;
let currentStep = 3;
let dollarLoss = 14200;
let canaryState = "IDLE";
let approvalPending = false;
let score = 12850;

let timeSeriesHistory = [];
for (let t = -120; t <= 0; t += 10) {
  const isHealthy = t < -60;
  timeSeriesHistory.push({
    offsetSec: t,
    p99Ms: isHealthy ? 22 : Math.round(4400 + (t + 60) * 10),
    dbPool: isHealthy ? 14 : 100,
    blastRadius: isHealthy ? 0.0 : 36.4,
    failing: !isHealthy
  });
}

const LEADERBOARD = [
  { rank: 1, handle: "root@kernel_panic", xp: 15400, mttr: "10s", badge: "GRAND CHAMPION" },
  { rank: 2, handle: "alex_devops_pro", xp: 13950, mttr: "16s", badge: "DIAMOND" },
  { rank: 3, handle: "sarah_k8s_hunter", xp: 12800, mttr: "22s", badge: "PLATINUM" },
  { rank: 4, handle: "Operator", xp: 12850, mttr: "26s", badge: "GOLD" }
];

let mcpServers = [
  { id: "github-mcp", name: "GitHub Sovereign MCP", tools: 14, status: "SCOPED_WRITE" },
  { id: "k8s-mcp", name: "Kubernetes Cluster MCP", tools: 28, status: "CLUSTER_ADMIN" },
  { id: "datadog-mcp", name: "Datadog Telemetry MCP", tools: 8, status: "METRICS_READ" },
  { id: "slack-mcp", name: "Slack Incident Bot MCP", tools: 6, status: "CHANNEL_WRITE" }
];

let slackMessages = [
  { sender: "PagerDuty Bot", time: "18:40:02", text: "TRIGGERED: P1 Alert #9921 - P99 latency > 4,500ms on US-East Ingress.", type: "alert" },
  { sender: "SRE Commander", time: "18:40:14", text: "Acknowledging incident. Investigating lock wait queues on primary DB.", type: "chat" }
];

let ebpfStream = [
  { ts: "18:40:10.124", probe: "kprobe:sys_futex", pid: 8140, comm: "postgres", event: "FUTEX_WAIT_QUEUE: Lock held on row_lock_inventory" },
  { ts: "18:40:11.892", probe: "tracepoint:tcp:tcp_drop", pid: 48, comm: "kong", event: "TCP_DROP: Upstream socket timeout on port 5432" },
  { ts: "18:40:13.441", probe: "kprobe:mem_cgroup_oom", pid: 102, comm: "redis-server", event: "CGROUP_MEMORY: Reached 99.8% threshold" }
];

let debateLog = [
  { agent: "Network Sentinel", stance: "Cascading 504s triggered by Kong ingress upstream queue starvation.", color: "#38e1f4" },
  { agent: "Database SRE", stance: "Contradiction: Exclusive row lock on PID 8140 is starving all 100 pool connections.", color: "#f59e0b" },
  { agent: "Swarm Commander", stance: "Consensus ruling: Execute SIGKILL on PID 8140 and trigger Canary patch rollout.", color: "#34d399" }
];

let nodes = [
  { id: "alb", name: "Edge Ingress", x: 70, y: 115, status: "HEALTHY", causalRole: "Root Symptom" },
  { id: "apigw", name: "API Gateway", x: 210, y: 115, status: "HEALTHY", causalRole: "504 Propagation" },
  { id: "api-prod", name: "Core Services", x: 380, y: 70, status: "DEGRADED", causalRole: "Pool Starvation" },
  { id: "worker", name: "Workers", x: 380, y: 165, status: "HEALTHY", causalRole: "Upstream Worker" },
  { id: "redis", name: "Redis Cache", x: 550, y: 55, status: "DEGRADED", causalRole: "Cache Stampede Trigger" },
  { id: "postgres", name: "Relational DB", x: 550, y: 165, status: "CRITICAL", causalRole: "Deadlock LockTuple Root" },
  { id: "otel", name: "Telemetry MCP", x: 700, y: 115, status: "HEALTHY", causalRole: "Observability Plane" }
];

setInterval(() => {
  if (!isResolved) {
    dollarLoss += CLOUD_PROFILES[activeCloudKey].costPerSec;
    const ts = new Date().toTimeString().split(" ")[0] + "." + Math.floor(Math.random() * 900 + 100);
    const events = [
      { probe: "kprobe:sys_futex", pid: 8140, comm: "postgres", event: "FUTEX_WAIT: lock tuple contention active" },
      { probe: "tracepoint:tcp:tcp_drop", pid: 48, comm: "kong", event: "TCP_DROP: 504 gateway timeout packet" }
    ];
    ebpfStream.unshift({ ts, ...events[Math.floor(Math.random() * events.length)] });
    if (ebpfStream.length > 7) ebpfStream.pop();
  }
  io.emit("titaniumMasterSync", {
    activeCloud: CLOUD_PROFILES[activeCloudKey],
    activeCloudKey,
    isResolved,
    dollarLoss,
    currentStep,
    mitigationTime,
    canaryState,
    approvalPending,
    score,
    leaderboard: LEADERBOARD,
    mcpServers,
    slackMessages,
    ebpfStream,
    debateLog,
    nodes,
    history: timeSeriesHistory,
    p99Ms: isResolved ? 22 : Math.round(4400 + Math.random() * 500),
    dbPool: isResolved ? 14 : 100,
    blastRadius: isResolved ? 0.0 : 36.4
  });
}, 1000);

function executeHeal(actor) {
  if (isResolved) return;
  isResolved = true;
  currentStep = 7;
  mitigationTime = Math.max(8, Math.round((Date.now() - startTime) / 1000));
  const xpGained = Math.max(750, 1950 - mitigationTime * 15);
  score += xpGained;
  nodes.forEach(n => n.status = "HEALTHY");
  canaryState = "PROMOTED";
  LEADERBOARD[3].xp += xpGained;
  LEADERBOARD[3].mttr = mitigationTime + "s";
  LEADERBOARD[3].badge = score > 13500 ? "GRAND CHAMPION" : "PLATINUM";
  LEADERBOARD.sort((a, b) => b.xp - a.xp);
  LEADERBOARD.forEach((p, idx) => p.rank = idx + 1);

  const ts = new Date().toTimeString().split(" ")[0];
  slackMessages.push({
    sender: "Incident Bot",
    time: ts,
    text: `RESOLVED by ${actor}. Cluster restored to 22ms. FinOps loss capped at $${dollarLoss.toLocaleString()}.`,
    type: "success"
  });
}

// Serve static frontend in production
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

app.get("/health", (req, res) => res.json({ status: "healthy", tier: "Titanium-Sovereign-Top100" }));

// Socket connection
io.on("connection", (socket) => {
  socket.on("switchCloud", ({ key }) => {
    if (CLOUD_PROFILES[key]) {
      activeCloudKey = key;
      nodes[0].name = CLOUD_PROFILES[key].services.edge;
      nodes[1].name = CLOUD_PROFILES[key].services.gw;
      nodes[2].name = CLOUD_PROFILES[key].services.compute;
      nodes[4].name = CLOUD_PROFILES[key].services.cache;
      nodes[5].name = CLOUD_PROFILES[key].services.db;
    }
  });

  socket.on("sendSlackMsg", ({ text }) => {
    const ts = new Date().toTimeString().split(" ")[0];
    slackMessages.push({ sender: "Operator", time: ts, text, type: "chat" });
    if (text.toLowerCase().includes("/heal") || text.toLowerCase().includes("/approve")) {
      executeHeal("SLACK_COMMAND");
    }
  });

  socket.on("requestMitigationHandshake", () => {
    approvalPending = true;
    currentStep = 4;
  });

  socket.on("authorizeHandshake", () => {
    approvalPending = false;
    canaryState = "CANARY_10PCT";
    currentStep = 5;
    setTimeout(() => {
      executeHeal("COMMANDER_2FA");
    }, 2400);
  });

  socket.on("solveIncident", () => {
    executeHeal("AI_AGENT_AUTONOMOUS");
  });

  socket.on("resetIncident", () => {
    isResolved = false;
    currentStep = 3;
    canaryState = "IDLE";
    approvalPending = false;
    startTime = Date.now();
    dollarLoss = 14200;
    nodes.forEach(n => {
      if (n.id === "postgres" || n.id === "redis") n.status = "CRITICAL";
    });
  });
});

// Fallback all routes to index.html for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`[Production Titanium Engine] listening on port ${PORT}`));