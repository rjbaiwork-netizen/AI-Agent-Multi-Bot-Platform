const express = require("express");
const crypto = require("crypto");

const router = express.Router();
const tasks = new Map();

router.get("/", (req, res) => {
  res.json({ status: "ready", activeTaskCount: tasks.size, tasks: Array.from(tasks.values()) });
});

router.post("/", (req, res) => {
  const task = {
    id: crypto.randomUUID(),
    status: "accepted",
    createdAt: new Date().toISOString(),
    payload: req.body || {}
  };
  tasks.set(task.id, task);
  res.status(202).json(task);
});

router.get("/:taskId", (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) return res.status(404).json({ status: "not_found", taskId: req.params.taskId });
  res.json(task);
});

module.exports = router;
