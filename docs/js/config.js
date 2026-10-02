(() => {
  const PAT_KEY = "ai-agent-multi-bot.github-pat";
  const OAUTH_TOKEN_KEY = "ai-agent-multi-bot.github-oauth.token";
  const OAUTH_REFRESH_KEY = "ai-agent-multi-bot.github-oauth.refresh";
  const OAUTH_META_KEY = "ai-agent-multi-bot.github-oauth.meta";
  const cfg = Object.freeze({
    github: { owner:"rjbaiwork-netizen", repo:"AI-Agent-Multi-Bot-Platform", branch:"main", workflow:"backend-runner.yml", events:Object.freeze({startBackend:"start-backend",triggerTask:"trigger-task"}) },
    auth: {
      provider:"github",
      githubClientId:"Ov23lifrakUAgHKymiu4",
      scopes:"repo offline_access",
      deviceFlow:true,
      deviceCodeUrl:"https://github.com/login/device/code",
      tokenUrl:"https://github.com/login/oauth/access_token",
      userUrl:"https://api.github.com/user"
    },
    backend: {
      baseUrl:"https://lahoma-scenographical-inconveniently.ngrok-free.dev",
      healthUrl:"https://lahoma-scenographical-inconveniently.ngrok-free.dev/health",
      statusPath:"/api/status",
      taskPath:"/api/task",
      shutdownPath:"/api/shutdown",
      pollMs:5000,
      requestTimeoutMs:8000,
      forwardGithubAuth:true
    },
    heartbeat: { intervalMs:30000, inactivityTimeoutMs:600000 },
    storageKey: PAT_KEY
  });
  window.AppConfig = cfg;
  const read=(store,key)=>{try{return store.getItem(key)||""}catch{return""}};
  const write=(store,key,value)=>{try{store.setItem(key,value)}catch{}};
  const remove=(store,key)=>{try{store.removeItem(key)}catch{}};
  window.TokenStore = {
    get:()=>read(sessionStorage,OAUTH_TOKEN_KEY)||read(localStorage,PAT_KEY),
    set:t=>write(localStorage,PAT_KEY,String(t||"").trim()),
    clear:()=>remove(localStorage,PAT_KEY),
    has:()=>Boolean(window.TokenStore.get()),
    source:()=>read(sessionStorage,OAUTH_TOKEN_KEY)?"oauth":read(localStorage,PAT_KEY)?"pat":"none",
    setOAuth:(token,refresh,meta)=>{write(sessionStorage,OAUTH_TOKEN_KEY,token);if(refresh)write(sessionStorage,OAUTH_REFRESH_KEY,refresh);else remove(sessionStorage,OAUTH_REFRESH_KEY);write(localStorage,OAUTH_META_KEY,JSON.stringify(meta||{}));},
    clearOAuth:()=>{remove(sessionStorage,OAUTH_TOKEN_KEY);remove(sessionStorage,OAUTH_REFRESH_KEY);remove(localStorage,OAUTH_META_KEY)},
    getOAuthMeta:()=>{try{return JSON.parse(read(localStorage,OAUTH_META_KEY)||"{}")}catch{return{}}},
    getOAuthRefresh:()=>read(sessionStorage,OAUTH_REFRESH_KEY)
  };
})();
