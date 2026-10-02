(() => {
  const cfg=window.AppConfig;
  const API=`https://api.github.com/repos/${cfg.github.owner}/${cfg.github.repo}`;
  let lastRunId=null,bootPromise=null;
  const getToken=()=>window.AuthController?.getToken?.()||window.TokenStore.get();
  const jsonHeaders=token=>({"Accept":"application/vnd.github+json","Content-Type":"application/json","X-GitHub-Api-Version":"2026-03-10","Authorization":`Bearer ${token}`});
  async function request(url,options={},timeout=cfg.backend.requestTimeoutMs){
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
    try{const r=await fetch(url,{...options,signal:ctrl.signal});if(!r.ok)throw new Error(`GitHub API ${r.status}: ${await r.text()}`);return r.status===204?null:r.json()}finally{clearTimeout(timer)}
  }
  async function verifyToken(token=getToken()){
    if(!token)return false;
    try{await request("https://api.github.com/user",{headers:jsonHeaders(token)});return true}catch(e){
      if(window.TokenStore.source?.()==="oauth"){await window.AuthController?.restoreSession?.();const fallback=window.TokenStore.get();if(fallback&&fallback!==token){try{await request("https://api.github.com/user",{headers:jsonHeaders(fallback)});return true}catch{}}}
      return false;
    }
  }
  async function triggerBackendStart(token=getToken()){
    if(window.TokenStore.source?.()==="oauth")await window.AuthController?.restoreSession?.();
    token=getToken();
    if(!token)throw new Error("GitHub authentication required. Sign in with GitHub or enter a PAT.");
    lastRunId=null;
    await request(`${API}/dispatches`,{method:"POST",headers:jsonHeaders(token),body:JSON.stringify({event_type:cfg.github.events.startBackend,client_payload:{source:"control-dashboard",authSource:window.TokenStore.source?.()||"token",requested_at:new Date().toISOString()}})});
    window.DashboardUI?.log("GitHub repository_dispatch sent: start-backend","ok");
    return true;
  }
  async function fetchWorkflowStatus(){
    const token=getToken();if(!token)return null;
    const data=await request(`${API}/actions/workflows/${cfg.github.workflow}/runs?branch=${encodeURIComponent(cfg.github.branch)}&per_page=10`,{headers:jsonHeaders(token)});
    const runs=data.workflow_runs||[];const candidate=lastRunId?runs.find(r=>r.id===lastRunId):runs[0];
    if(!candidate)return null;if(!lastRunId)lastRunId=candidate.id;
    return {id:candidate.id,status:candidate.status,conclusion:candidate.conclusion,createdAt:candidate.created_at,updatedAt:candidate.updated_at,htmlUrl:candidate.html_url};
  }
  async function getRunJobs(runId){
    const token=getToken();if(!token)throw new Error("GitHub authentication required.");
    const data=await request(`${API}/actions/runs/${runId}/jobs?per_page=100`,{headers:jsonHeaders(token)});return data.jobs||[];
  }
  async function readJobLog(jobId){
    const token=getToken();if(!token)return "";
    const data=await fetch(`${API}/actions/jobs/${jobId}/logs`,{headers:jsonHeaders(token)});if(!data.ok)throw new Error(`GitHub job log HTTP ${data.status}`);return data.text();
  }
  async function fetchPublishedTunnelUrl(){
    const token=getToken();if(!token)return null;
    try{
      const data=await request(API+"/commits/"+encodeURIComponent(cfg.github.branch)+"/status",{headers:jsonHeaders(token)});
      const status=(data.statuses||[]).find(s=>s.context==="ephemeral-backend-url"&&s.state==="success"&&/^https:\/\//i.test(s.target_url||""));
      return status?.target_url||null;
    }catch(e){window.DashboardUI?.log("Published Ngrok status pending: "+e.message,"warn");return null}
  }
  async function discoverTunnelUrl(runId){
    const published=await fetchPublishedTunnelUrl();if(published)return published;
    const jobs=await getRunJobs(runId);
    for(const job of jobs){try{const log=await readJobLog(job.id);const matches=log.match(/https:\/\/(?:[a-z0-9-]+\.)?(?:ngrok(?:-free)?\.app|ngrok\.io)\b[^\s"'<>]*/gi)||[];const url=matches.find(u=>/^https:\/\//i.test(u));if(url)return url.replace(/[),.;]+$/,"")}catch(e){window.DashboardUI?.log("Could not read job log "+job.id+": "+e.message,"warn")}}
    return null;
  }
  async function pollWorkflowStatus({onChange,maxMs=120000}={}){
    const started=Date.now();let previous="";
    while(Date.now()-started<maxMs){try{const s=await fetchWorkflowStatus();if(s){const key=`${s.id}:${s.status}:${s.conclusion}`;if(key!==previous){previous=key;onChange?.(s)}if(s.status==="completed"||s.status==="cancelled")return s}}catch(e){window.DashboardUI?.log(e.message,"warn")}await new Promise(r=>setTimeout(r,cfg.backend.pollMs))}
    return fetchWorkflowStatus();
  }
async function bootAndDiscover({onWorkflowChange,maxMs=180000}={}){
  if(bootPromise)return bootPromise;
  bootPromise=(async()=>{
    await triggerBackendStart();
    const started=Date.now();let previous="";
    while(Date.now()-started<maxMs){
      try{
        const s=await fetchWorkflowStatus();
        if(s){
          const key=`${s.id}:${s.status}:${s.conclusion}`;
          if(key!==previous){previous=key;onWorkflowChange?.(s)}
          try{const url=await discoverTunnelUrl(s.id);if(url)return {workflow:s,url}}catch(e){window.DashboardUI?.log("Ngrok discovery pending: "+e.message,"warn")}
          if(s.status==="completed"||s.status==="cancelled"){
            if(s.conclusion==="failure")throw new Error("Backend workflow failed.");
            if(s.status==="completed")throw new Error("Backend workflow completed, but no Ngrok URL was found.");
          }
        }
      }catch(e){
        if(/Backend workflow failed|completed, but no Ngrok URL/.test(e.message))throw e;
        window.DashboardUI?.log("Backend discovery pending: "+e.message,"warn");
      }
      await new Promise(r=>setTimeout(r,cfg.backend.pollMs));
    }
    throw new Error("Timed out waiting for the ephemeral backend Ngrok tunnel.");
  })().finally(()=>{bootPromise=null});
  return bootPromise;
}
  window.GitHubBridge={triggerBackendStart,fetchWorkflowStatus,pollWorkflowStatus,discoverTunnelUrl,fetchPublishedTunnelUrl,bootAndDiscover,verifyToken,getToken};
})();