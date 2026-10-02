const ngrok = require("ngrok");
const { PORT } = require("../config/constants");

let publicUrl = null;

async function startTunnel(port = PORT) {
  if (publicUrl) return publicUrl;
  const options = { addr: port, proto: "http" };
  if (process.env.NGROK_AUTHTOKEN) options.authtoken = process.env.NGROK_AUTHTOKEN;
  publicUrl = await ngrok.connect(options);
  console.log("[ngrok] public URL:", publicUrl);
  return publicUrl;
}

async function stopTunnel() {
  try { await ngrok.disconnect(); } catch (e) { console.warn("[ngrok] disconnect:", e.message); }
  try { await ngrok.kill(); } catch (e) { console.warn("[ngrok] kill:", e.message); }
  publicUrl = null;
}

function getPublicUrl() { return publicUrl; }

module.exports = { startTunnel, stopTunnel, getPublicUrl };
