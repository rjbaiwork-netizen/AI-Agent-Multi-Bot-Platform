const STATIC_URL = process.env.NGROK_STATIC_URL || "https://lahoma-scenographical-inconveniently.ngrok-free.dev";

let publicUrl = null;

async function startTunnel() {
  publicUrl = STATIC_URL;
  console.log("[ngrok] static public URL:", publicUrl);
  return publicUrl;
}

async function stopTunnel() {
  publicUrl = null;
}

function getPublicUrl() { return publicUrl || STATIC_URL; }

module.exports = { startTunnel, stopTunnel, getPublicUrl };
