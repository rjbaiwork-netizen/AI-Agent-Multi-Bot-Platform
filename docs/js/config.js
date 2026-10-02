(() => {
  const STORAGE_KEY = "ai-agent-multi-bot.github-pat";
  const cfg = Object.freeze({
    github: { owner:"rjbaiwork-netizen", repo:"AI-Agent-Multi-Bot-Platform", branch:"main", workflow:"backend-runner.yml", events:Object.freeze({startBackend:"start-backend",triggerTask:"trigger-task"}) },
    backend: { statusPath:"/api/status", taskPath:"/api/task", shutdownPath:"/api/shutdown", pollMs:5000, requestTimeoutMs:8000 },
    heartbeat: { intervalMs:30000, inactivityTimeoutMs:600000 },
    storageKey: STORAGE_KEY
  });
  window.AppConfig = cfg;
  window.TokenStore = {
    get:()=>{try{return localStorage.getItem(STORAGE_KEY)||""}catch{return""}},
    set:t=>{try{localStorage.setItem(STORAGE_KEY,t.trim())}catch{}},
    clear:()=>{try{localStorage.removeItem(STORAGE_KEY)}catch{}},
    has:()=>Boolean(window.TokenStore.get())
  };
})();