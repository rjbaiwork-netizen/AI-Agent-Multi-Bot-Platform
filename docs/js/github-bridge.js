(() => {
  const cfg=window.AppConfig;
  const API=`https://api.github.com/repos/${cfg.github.owner}/${cfg.github.repo}`;
  let lastRunId=null;
  const jsonHeaders=token=>({"Accept":"application/vnd.github+json","Content-Type":"application/json","X-GitHub-Api-Version":"2026-03-10","Authorization":`Bearer ${token}`});
  async function request(url,options={},timeout=cfg.backend.requestTimeoutMs){
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
    try{const r=await fetch(url,{...options,signal:ctrl.signal});if(!r.ok)throw new Error(`GitHub API ${r.status}: ${await r.text()}`);return r.status===204?null:r.json()}finally{clearTimeout(timer)}
  }
  async function verifyToken(token=window.TokenStore.get()){
    if(!token)return false;
    try{await request("https://api.github.com/user",{headers:jsonHeaders(token)});return true}catch{return false}
  }
  async function triggerBackendStart(patToken=window.TokenStore.get()){
    if(!patToken)throw new Error("GitHub PAT is not configured.");
    lastRunId=null;
    await request(`${API}/dispatches`,{method:"POST",headers:jsonHeaders(patToken),body:JSON.stringify({event_type:cfg.github.events.startBackend,client_payload:{source:"control-dashboard",requested_at:new Date().toISOString()}})});
    window.DashboardUI?.log("GitHub repository_dispatch sent: start-backend","ok");
    return true;
  }
  async function fetchWorkflowStatus(){
    const token=window.TokenStore.get();if(!token)return null;
    const data=await request(`${API}/actions/workflows/${cfg.github.workflow}/runs?branch=${encodeURIComponent(cfg.github.branch)}&per_page=10`,{headers:jsonHeaders(token)});
    const runs=data.workflow_runs||[];
    const candidate=lastRunId?runs.find(r=>r.id===lastRunId):runs[0];
    if(!candidate)return null;
    if(!lastRunId)lastRunId=candidate.id;
    return {id:candidate.id,status:candidate.status,conclusion:candidate.conclusion,createdAt:candidate.created_at,updatedAt:candidate.updated_at,htmlUrl:candidate.html_url};
  }
  async function getRunJobs(runId){
    const token=window.TokenStore.get();if(!token)throw new Error("GitHub PAT is not configured.");
    const data=await request(`${API}/actions/runs/${runId}/jobs?per_page=100`,{headers:jsonHeaders(token)});
    return data.jobs||[];
  }
  async function readJobLog(jobId){
    const token=window.TokenStore.get();if(!token)return "";
    const data=await fetch(`${API}/actions/jobs/${jobId}/logs`,{headers:jsonHeaders(token)});
    if(!data.ok)throw new Error(`GitHub job log HTTP ${data.status}`);
    return data.text();
  }
  async function discoverTunnelUrl(runId){
    const jobs=await getRunJobs(runId);
    for(const job of jobs){
      try{
        const log=await readJobLog(job.id);
        const matches=log.match(/https:\/\/(?:[a-z0-9-]+\.)?(?:ngrok(?:-free)?\.app|ngrok\.io)\b[^\s"'<>]*/gi)||[];
        const url=matches.find(u=>/^https:\/\//i.test(u));
        if(url)return url.replace(/[),.;]+$/,"");
      }catch(e){window.DashboardUI?.log(`Could not read job log ${job.id}: ${e.message}`,"warn")}
    }
    return null;
  }
  async function pollWorkflowStatus({onChange,maxMs=120000}={}){
    const started=Date.now();let previous="";
    while(Date.now()-started<maxMs){
      try{const s=await fetchWorkflowStatus();if(s){const key=`${s.id}:${s.status}:${s.conclusion}`;if(key!==previous){previous=key;onChange?.(s)}if(s.status==="completed"||s.status==="cancelled")return s}}catch(e){window.DashboardUI?.log(e.message,"warn")}
      await new Promise(r=>setTimeout(r,cfg.backend.pollMs));
    }
    return fetchWorkflowStatus();
  }
  window.GitHubBridge={triggerBackendStart,fetchWorkflowStatus,pollWorkflowStatus,discoverTunnelUrl,verifyToken};
})();