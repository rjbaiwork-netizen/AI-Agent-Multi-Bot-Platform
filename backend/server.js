require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { PORT } = require("./config/constants");
const statusRouter = require("./routes/status");
const taskRouter = require("./routes/task");
const controlRouter = require("./routes/control");
const { startCircuitBreaker, attachActivityMiddleware, onShutdown, shutdown } = require("./core/circuit-breaker");
const { startTunnel, stopTunnel } = require("./core/ngrok-tunnel");
const { notify } = require("../scripts/telegram-notifier");

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(attachActivityMiddleware());
app.get("/", (req, res) => res.json({ service: "On-Demand Ephemeral AI Agent & Multi-Bot Platform", phase: "Phase 2", status: "online" }));
app.use("/api/status", statusRouter);
app.use("/api/task", taskRouter);
app.use("/api", controlRouter);

let server;
onShutdown(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await stopTunnel();
});

async function start() {
  startCircuitBreaker();
  server = app.listen(PORT, async () => {
    console.log("[server] listening on http://localhost:" + PORT);
    let publicUrl = null;
    try { publicUrl = await startTunnel(PORT); } catch (error) { console.error("[server] ngrok startup failed:", error.message); }
    await notify({ publicUrl, status: publicUrl ? "online" : "online-local-only", event: "phase-2-boot" });
  });
  server.on("error", (error) => { console.error("[server] fatal error:", error); process.exitCode = 1; });
}
process.on("SIGTERM", () => shutdown("SIGTERM").catch(() => process.exit(1)));
process.on("SIGINT", () => shutdown("SIGINT").catch(() => process.exit(1)));
start().catch((error) => { console.error("[server] startup failed:", error); process.exit(1); });
module.exports = { app };