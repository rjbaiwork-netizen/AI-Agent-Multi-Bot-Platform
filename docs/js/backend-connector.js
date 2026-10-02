(() => {
const cfg=window.AppConfig;let baseUrl="";let timer=null;let lastStatus=null;
function normalize(url){return String(url||"").trim().replace(/\/$/,"")}
function setBaseUrl(url){baseUrl=normalize(url);window.DashboardUI?.setTunnelUrl(baseUrl)}
function getBaseUrl(){return baseUrl}
function authHeaders(){const token=window.AuthController?.getToken?.()||window.TokenStore.get();return cfg.backend.forwardGithubAuth&&token?{"Authorization":"Bearer "+token,"X-Auth-Source":window.TokenStore.source?.()||"token"}:{}}
async function fetchJson(path,options={}){
 if(!baseUrl)throw new Error("No live Ngrok backend URL.");
 const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),cfg.backend.requestTimeoutMs);
 try{const r=await fetch(baseUrl+path,{...options,signal:ctrl.signal,headers:{"Content-Type":"application/json",...authHeaders(),...(options.headers||{})}});if(!r.ok){let message="Backend HTTP "+r.status;try{const body=await r.json();message=body.error||message}catch{}throw new Error(message)}return await r.json()}finally{clearTimeout(t)}
}
async function pollStatus(){if(!baseUrl)return null;try{const s=await fetchJson(cfg.backend.statusPath);lastStatus=s;window.DashboardUI?.applyBackendStatus(s);return s}catch(e){window.DashboardUI?.setGlobalStatus("offline");window.DashboardUI?.log("Heartbeat lost: "+e.message,"warn");return null}}
function startPolling(){clearInterval(timer);pollStatus();timer=setInterval(pollStatus,cfg.backend.pollMs)}
function stopPolling(){clearInterval(timer);timer=null}
async function shutdown(){const result=await fetchJson(cfg.backend.shutdownPath,{method:"POST",body:"{}"});window.DashboardUI?.log("Emergency kill-switch accepted.","warn");stopPolling();return result}
async function submitTask(payload){return fetchJson(cfg.backend.taskPath,{method:"POST",body:JSON.stringify(payload)})}
async function listBots(){return fetchJson("/api/bots")}
async function createBot(payload){return fetchJson("/api/bots",{method:"POST",body:JSON.stringify(payload)})}
async function updateBot(id,payload){return fetchJson("/api/bots/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify(payload)})}
async function resetBotBrain(id){return fetchJson("/api/bots/"+encodeURIComponent(id)+"/reset",{method:"POST",body:"{}"})}
async function deleteBot(id){return fetchJson("/api/bots/"+encodeURIComponent(id),{method:"DELETE"})}
async function getBot(id){return fetchJson("/api/bots/"+encodeURIComponent(id))}
window.BackendConnector={setBaseUrl,getBaseUrl,pollStatus,startPolling,stopPolling,shutdown,submitTask,listBots,createBot,updateBot,resetBotBrain,deleteBot,getBot,get lastStatus(){return lastStatus}};
})();