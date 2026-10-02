(() => {
  const cfg=window.AppConfig;let baseUrl="";let timer=null;let lastStatus=null;
  function normalize(url){return String(url||"").trim().replace(/\/$/,"")}
  function setBaseUrl(url){baseUrl=normalize(url);window.DashboardUI?.setTunnelUrl(baseUrl)}
  function getBaseUrl(){return baseUrl}
  async function fetchJson(path,options={}){
    if(!baseUrl)throw new Error("No live Ngrok backend URL.");
    const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),cfg.backend.requestTimeoutMs);
    try{const r=await fetch(baseUrl+path,{...options,signal:ctrl.signal,headers:{"Content-Type":"application/json",...(options.headers||{})}});if(!r.ok)throw new Error(`Backend HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}
  }
  async function pollStatus(){
    if(!baseUrl)return null;
    try{
      const s=await fetchJson(cfg.backend.statusPath);lastStatus=s;window.DashboardUI?.applyBackendStatus(s);return s
    }catch(e){window.DashboardUI?.setGlobalStatus("offline");window.DashboardUI?.log(`Heartbeat lost: ${e.message}`,"warn");return null}
  }
  function startPolling(){clearInterval(timer);pollStatus();timer=setInterval(pollStatus,cfg.backend.pollMs)}
  function stopPolling(){clearInterval(timer);timer=null}
  async function shutdown(){
    const result=await fetchJson(cfg.backend.shutdownPath,{method:"POST",body:"{}"});window.DashboardUI?.log("Emergency kill-switch accepted.","warn");stopPolling();return result
  }
  async function submitTask(payload){return fetchJson(cfg.backend.taskPath,{method:"POST",body:JSON.stringify(payload)})}
  window.BackendConnector={setBaseUrl,getBaseUrl,pollStatus,startPolling,stopPolling,shutdown,submitTask,get lastStatus(){return lastStatus}};
})();