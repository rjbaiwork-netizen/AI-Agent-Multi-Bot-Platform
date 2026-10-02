const express = require("express");
const { shutdown } = require("../core/circuit-breaker");

const router = express.Router();

router.post("/shutdown", (req, res) => {
  res.status(202).json({ status: "shutting_down", reason: "api-kill-switch" });
  setImmediate(() => shutdown("api-kill-switch").catch((error) => {
    console.error("[control] shutdown failed:", error);
    process.exit(1);
  }));
});

module.exports = router;
