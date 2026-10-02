const { INACTIVITY_TIMEOUT_MS, HEARTBEAT_INTERVAL_MS } = require("../config/constants");

let inactivityTimer = null;
let lastActivityAt = Date.now();
let shutdownInProgress = false;
let shutdownHandler = null;

function scheduleTimeout() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  const remaining = Math.max(1000, INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityAt));
  inactivityTimer = setTimeout(() => {
    if (Date.now() - lastActivityAt >= INACTIVITY_TIMEOUT_MS) {
      shutdown("inactivity-timeout");
    } else {
      scheduleTimeout();
    }
  }, remaining);
}

function startCircuitBreaker() {
  lastActivityAt = Date.now();
  scheduleTimeout();
  return { lastActivityAt: () => lastActivityAt, inactivityTimeoutMs: INACTIVITY_TIMEOUT_MS };
}

function touchActivity() {
  lastActivityAt = Date.now();
  scheduleTimeout();
}

function attachActivityMiddleware() {
  return (req, res, next) => {
    touchActivity();
    next();
  };
}

function onShutdown(handler) { shutdownHandler = handler; }

async function shutdown(reason = "manual") {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  if (inactivityTimer) clearTimeout(inactivityTimer);
  console.log("[circuit-breaker] shutdown requested:", reason);
  try {
    if (shutdownHandler) await shutdownHandler(reason);
  } catch (error) {
    console.error("[circuit-breaker] cleanup error:", error);
  } finally {
    process.exit(0);
  }
}

function getHeartbeat() {
  return {
    pulseAt: new Date().toISOString(),
    lastActivityAt: new Date(lastActivityAt).toISOString(),
    intervalMs: HEARTBEAT_INTERVAL_MS,
    inactivityTimeoutMs: INACTIVITY_TIMEOUT_MS
  };
}

module.exports = { startCircuitBreaker, attachActivityMiddleware, touchActivity, onShutdown, shutdown, getHeartbeat };
