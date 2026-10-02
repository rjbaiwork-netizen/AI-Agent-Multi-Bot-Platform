const fs = require("fs");
const path = require("path");
const axios = require("axios");
const CHANGELOG_PATH = path.resolve(__dirname, "../registry/changelog_history.json");

function readChangelog() {
  try { const data = JSON.parse(fs.readFileSync(CHANGELOG_PATH, "utf8")); return Array.isArray(data) ? data : []; }
  catch (error) { console.warn("[telegram] changelog read failed:", error.message); return []; }
}
function appendSession({ publicUrl = null, status = "booting", event = "boot" } = {}) {
  const history = readChangelog();
  const entry = { version: "v" + (history.length + 1), event, status, startedAt: new Date().toISOString(), publicUrl, botName: process.env.TELEGRAM_BOT_NAME || "Ephemeral AI Bot", workflowRun: process.env.GITHUB_RUN_ID || null };
  history.push(entry);
  fs.mkdirSync(path.dirname(CHANGELOG_PATH), { recursive: true });
  fs.writeFileSync(CHANGELOG_PATH, JSON.stringify(history, null, 2) + "\n", "utf8");
  return { entry, history };
}
async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) { console.warn("[telegram] Telegram credentials missing; notification skipped."); return { sent: false, skipped: true }; }
  const response = await axios.post("https://api.telegram.org/bot" + token + "/sendMessage", { chat_id: chatId, text: message, parse_mode: "Markdown" }, { timeout: 15000 });
  return { sent: Boolean(response.data && response.data.ok) };
}
async function notify({ publicUrl = null, status = "booting", event = "boot" } = {}) {
  const result = appendSession({ publicUrl, status, event });
  const links = process.env.TELEGRAM_BOT_LINKS || "Not configured";
  const changelog = result.history.map((item) => "- " + item.version + ": " + item.event + " | " + item.status + " | " + item.startedAt).join("\n");
  const message = ["*Ephemeral Backend Engine — " + result.entry.version + "*", "", "*Status:* " + status, "*Event:* " + event, "*Bot:* " + (process.env.TELEGRAM_BOT_NAME || "Ephemeral AI Bot"), "*Live URL:* " + (publicUrl || "Pending / unavailable"), "*Links:* " + links, "", "*Cumulative Changelog:*", changelog || "- No previous sessions", "", "*Reported:* " + result.entry.startedAt].join("\n");
  try { const sent = await sendTelegramMessage(message); console.log("[telegram] notification result:", sent); return { ...sent, ...result }; }
  catch (error) { console.error("[telegram] notification failed:", error.message); return { sent: false, error: error.message, ...result }; }
}
if (require.main === module) { notify({ publicUrl: process.env.NGROK_URL || null, status: process.env.BACKEND_STATUS || "booting", event: process.env.BACKEND_EVENT || "boot" }).then((result) => { if (result.error) process.exitCode = 1; }); }
module.exports = { notify, readChangelog, appendSession };