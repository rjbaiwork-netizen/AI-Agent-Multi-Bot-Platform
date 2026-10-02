(() => {
const cfg=window.AppConfig;let baseUrl=cfg.backend.baseUrl;let timer=null;let stream=null;let lastStatus=null;
function normalize(url){return String(url||"").trim().replace(/\/$/,"")}
function setBaseUrl(url){baseUrl=normalize(url||cfg.backend.baseUrl);window.DashboardUI?.setTunnelUrl(baseUrl)}
function getBaseUrl(){return baseUrl}
function authHeaders(){const token=window.AuthController?.getToken?.()||window.TokenStore.get();return cfg.backend.forwardGithubAuth&&token?{"Authorization":"Bearer "+token,"X-Auth-Source":window.TokenStore.source?.()||"token"}:{}}
async function fetchJson(path,options={}){if(!baseUrl)throw new Error("No backend URL configured.");const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),cfg.backend.requestTimeoutMs);try{const r=await fetch(baseUrl+path,{...options,signal:ctrl.signal,headers:{"Content-Type":"application/json",...authHeaders(),...(options.headers||{})}});if(!r.ok){let message="Backend HTTP "+r.status;try{const body=await r.json();message=body.error||message}catch{}throw new Error(message)}return await r.json()}finally{clearTimeout(t)}}
async function checkHealth(){const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),cfg.backend.requestTimeoutMs);try{const r=await fetch(cfg.backend.healthUrl,{signal:ctrl.signal,headers:authHeaders()});if(!r.ok)throw new Error("Backend health HTTP "+r.status);return await r.json()}finally{clearTimeout(t)}}
async function waitForHealth(maxMs=120000){const started=Date.now();let lastError=null;while(Date.now()-started<maxMs){try{return await checkHealth()}catch(e){lastError=e;await new Promise(r=>setTimeout(r,Math.min(1000,cfg.backend.pollMs)))}}throw new Error("Static backend health check timed out: "+(lastError?.message||"unknown error"))}
async function pollStatus(){if(!baseUrl)return null;try{const s=await fetchJson(cfg.backend.statusPath);lastStatus=s;window.DashboardUI?.applyBackendStatus(s);return s}catch(e){window.DashboardUI?.setGlobalStatus("offline");window.DashboardUI?.log("Heartbeat lost: "+e.message,"warn");return null}}
function startRealtime(){stopRealtime();if(!baseUrl||typeof EventSource==="undefined")return false;stream=new EventSource(baseUrl+"/api/events");stream.addEventListener("connected",()=>window.DashboardUI?.setRealtimeState?.("live"));stream.addEventListener("heartbeat",e=>{try{window.DashboardUI?.applyRealtimeHeartbeat?.(JSON.parse(e.data))}catch{}});stream.addEventListener("snapshot",e=>{try{window.DashboardUI?.applyRealtimeSnapshot?.(JSON.parse(e.data))}catch{}});stream.addEventListener("backend",e=>{try{window.DashboardUI?.applyRealtimeEvent?.(JSON.parse(e.data))}catch{}});stream.onerror=()=>{window.DashboardUI?.setRealtimeState?.("reconnecting")};return true}
function startPolling(){clearInterval(timer);pollStatus();timer=setInterval(pollStatus,cfg.backend.pollMs);startRealtime()}
function stopPolling(){clearInterval(timer);timer=null;stopRealtime()}
function stopRealtime(){if(stream){stream.close();stream=null}}
async function shutdown(){const result=await fetchJson(cfg.backend.shutdownPath,{method:"POST",body:"{}"});window.DashboardUI?.log("Emergency kill-switch accepted.","warn");stopPolling();return result}
async function submitTask(payload){const result=await fetchJson(cfg.backend.taskPath,{method:"POST",body:JSON.stringify(payload)});await pollStatus();return result}
async function listBots(){return fetchJson("/api/bots")}
async function createBot(payload){const result=await fetchJson("/api/bots",{method:"POST",body:JSON.stringify(payload)});await pollStatus();return result}
async function updateBot(id,payload){const result=await fetchJson("/api/bots/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify(payload)});await pollStatus();return result}
async function resetBotBrain(id){const result=await fetchJson("/api/bots/"+encodeURIComponent(id)+"/reset",{method:"POST",body:"{}"});await pollStatus();return result}
async function deleteBot(id){const result=await fetchJson("/api/bots/"+encodeURIComponent(id),{method:"DELETE"});await pollStatus();return result}
async function getBot(id){return fetchJson("/api/bots/"+encodeURIComponent(id))}
window.BackendConnector={setBaseUrl,getBaseUrl,checkHealth,waitForHealth,pollStatus,startPolling,stopPolling,startRealtime,stopRealtime,shutdown,submitTask,listBots,createBot,updateBot,resetBotBrain,deleteBot,getBot,get lastStatus(){return lastStatus}};
})();
