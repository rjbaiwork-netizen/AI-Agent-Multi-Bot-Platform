(() => {
  const cfg=window.AppConfig;
  const TOKEN_URL=cfg.auth.tokenUrl,DEVICE_URL=cfg.auth.deviceCodeUrl,USER_URL=cfg.auth.userUrl;
  const CORS_PROXY_URL="https://cors-anywhere.herokuapp.com/";
  let pollTimer=null,flowAbort=false,viewBound=false;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
  const clientId=()=>String(window.__GITHUB_OAUTH_CLIENT_ID__||cfg.auth.githubClientId||"").trim();
  const scopes=()=>cfg.auth.scopes||"repo offline_access";
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function setText(id,value){const e=$(id);if(e)e.textContent=String(value??"")}
  function setBadge(id,label,state){const e=$(id);if(!e)return;e.className="status-badge status-"+state;e.innerHTML='<span class="status-dot"></span>'+esc(label)}
  function meta(){return window.TokenStore.getOAuthMeta()}
  function syncUI(){
    const source=window.TokenStore.source(),m=meta(),logged=source==="oauth";
    const label=logged?(m.login?"Connected • @"+m.login:"GitHub Connected"):source==="pat"?"PAT Fallback":"Not authenticated";
    setBadge("auth-status-badge",label,logged?"live":source==="pat"?"spinning":"offline");
    setBadge("header-auth-badge",logged?(m.login?"@"+m.login:"GitHub"):source==="pat"?"PAT":"Sign in",logged?"live":source==="pat"?"spinning":"offline");
    ["auth-session-label","login-session-label"].forEach(id=>setText(id,logged?(m.login?"GitHub • @"+m.login:"GitHub OAuth session"):source==="pat"?"Personal Access Token fallback":"No active session"));
    const logout=$("auth-logout"),topLogout=$("header-logout");if(logout)logout.hidden=!logged&&source!=="pat";if(topLogout)topLogout.hidden=!logged&&source!=="pat";
    const sign=$("github-oauth-signin");if(sign)sign.disabled=Boolean(pollTimer)||logged;
    const pat=$("auth-pat-fallback");if(pat)pat.textContent=source==="pat"?"Manage PAT":"Use PAT fallback";
    setText("oauth-scope-value",m.scope||scopes());
    setText("oauth-expiry-value",m.expiresAt?new Date(m.expiresAt).toLocaleString():"Session token");
    const card=$("oauth-session-card");if(card)card.classList.toggle("connected",logged);
  }
  function setProgress(message){setText("oauth-flow-status",message);window.DashboardUI?.log("OAuth: "+message,"info")}
  function clearError(){const e=$("oauth-error");if(e){e.hidden=true;e.textContent=""}}
  function showError(){const e=$("oauth-error");if(e){e.hidden=false;e.textContent="GitHub sign-in could not start. Please try again."}setProgress("GitHub sign-in could not start.");window.DashboardUI?.log("OAuth sign-in failed","error")}
  function friendlyNetworkError(e){
    if(e instanceof TypeError) return "GitHub sign-in could not start. Please try again.";
    return "GitHub sign-in could not start. Please try again.";
  }
  async function postOAuth(endpoint,body){
    const options={method:"POST",headers:{"Accept":"application/json","Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(body)};
    try{
      return await fetch(endpoint,options);
    }catch(directError){
      setProgress("Direct GitHub request was blocked; trying CORS proxy fallback…");
      try{
        const proxyEndpoint=CORS_PROXY_URL+endpoint;
        return await fetch(proxyEndpoint,options);
      }catch(proxyError){
        throw new Error("GitHub OAuth request failed after direct and CORS-proxy attempts. The free proxy may require temporary access or may be unavailable. Verify Device Flow is enabled, the Client ID is correct, and try again on an HTTPS connection.");
      }
    }
  }
  async function parseResponse(r){
    const text=await r.text();let data={};try{data=JSON.parse(text)}catch{data=Object.fromEntries(new URLSearchParams(text))}
    if(!r.ok||data.error){
      const code=String(data.error||"");
      if(code==="unauthorized_client") throw new Error("GitHub rejected this OAuth app. Confirm Device Flow is enabled for the OAuth App and that Client ID \""+clientId()+"\" is correct.");
      if(code==="bad_verification_code") throw new Error("GitHub rejected the device code. Start sign-in again.");
      if(code==="invalid_client") throw new Error("GitHub reports an invalid OAuth Client ID. Verify AppConfig.auth.githubClientId.");
      throw new Error((data.error_description||code||"GitHub OAuth request failed.")+" (HTTP "+r.status+").");
    }
    return data;
  }
  async function requestDeviceCode(){
    const id=clientId();if(!id)throw new Error("GitHub OAuth Client ID is not configured. Set AppConfig.auth.githubClientId in docs/js/config.js.");
    const r=await postOAuth(DEVICE_URL,{client_id:id,scope:scopes()});
    return parseResponse(r);
  }
  async function pollToken(deviceCode,interval,expiresIn){
    const id=clientId(),deadline=Date.now()+Number(expiresIn||900)*1000;
    let wait=Math.max(5000,Number(interval||5)*1000);
    while(!flowAbort&&Date.now()<deadline){
      await sleep(wait);if(flowAbort)break;
      const r=await postOAuth(TOKEN_URL,{client_id:id,device_code:deviceCode,grant_type:"urn:ietf:params:oauth:grant-type:device_code"});
      const text=await r.text();let data={};try{data=JSON.parse(text)}catch{data=Object.fromEntries(new URLSearchParams(text))}
      if(data.access_token)return data;
      if(data.error==="authorization_pending"){setProgress("Waiting for GitHub authorization…");continue}
      if(data.error==="slow_down"){wait+=5000;setProgress("GitHub requested slower polling…");continue}
      if(data.error==="expired_token")throw new Error("The GitHub device code expired. Start sign-in again.");
      if(data.error==="access_denied")throw new Error("GitHub authorization was denied.");
      if(data.error==="unauthorized_client")throw new Error("GitHub rejected this OAuth app. Confirm Device Flow is enabled.");
      if(data.error==="invalid_client")throw new Error("GitHub reports an invalid OAuth Client ID. Verify AppConfig.auth.githubClientId.");
      throw new Error(data.error_description||data.error||"GitHub authorization failed.");
    }
    throw new Error("OAuth sign-in was cancelled or timed out.");
  }
  async function fetchUser(token){
    const r=await fetch(USER_URL,{headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2026-03-10"}});
    if(!r.ok)throw new Error("GitHub identity verification failed ("+r.status+").");
    return r.json();
  }
  async function refresh(){
    const refreshToken=window.TokenStore.getOAuthRefresh(),id=clientId();if(!refreshToken||!id)return false;
    try{
      const r=await fetch(TOKEN_URL,{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:id,refresh_token:refreshToken,grant_type:"refresh_token"})});
      const data=await parseResponse(r);const expiresAt=data.expires_in?Date.now()+Number(data.expires_in)*1000:0;
      const user=await fetchUser(data.access_token);
      window.TokenStore.setOAuth(data.access_token,data.refresh_token||refreshToken,{login:user.login,id:user.id,avatar:user.avatar_url,scope:data.scope||scopes(),expiresAt,refreshExpiresAt:data.refresh_token_expires_in?Date.now()+Number(data.refresh_token_expires_in)*1000:0});
      syncUI();return true;
    }catch(e){window.TokenStore.clearOAuth();syncUI();window.DashboardUI?.log("OAuth refresh unavailable: "+e.message,"warn");return false}
  }
  async function restoreSession(){
    const token=window.TokenStore.get(),source=window.TokenStore.source();
    if(source!=="oauth")return syncUI();
    const m=meta();
    if(m.expiresAt&&Date.now()<Number(m.expiresAt)-30000)return syncUI();
    if(await refresh())return;
    if(token)try{const user=await fetchUser(token);window.TokenStore.setOAuth(token,window.TokenStore.getOAuthRefresh(),Object.assign({},m,{login:user.login,id:user.id,avatar:user.avatar_url}));syncUI();return}catch{}
    window.TokenStore.clearOAuth();syncUI();
  }
  async function startLogin(){
    if(pollTimer)return;
    flowAbort=false;
    clearError();
    setProgress("Requesting a GitHub device code…");
    try{
      const d=await requestDeviceCode();
      const verificationUrl=d.verification_uri_complete||d.verification_uri||"https://github.com/login/device";
      setText("oauth-device-code",d.user_code);setText("oauth-device-expires",Math.ceil(Number(d.expires_in||900)/60)+" minutes");
      const link=$("oauth-verify-link");if(link){link.href=verificationUrl;link.hidden=false}
      $("oauth-device-card")?.classList.add("visible");setProgress("Opening GitHub authorization…");
      try{window.open(verificationUrl,"_blank")}catch{}
      pollTimer=pollToken(d.device_code,d.interval,d.expires_in).then(async data=>{
        const user=await fetchUser(data.access_token),expiresAt=data.expires_in?Date.now()+Number(data.expires_in)*1000:0;
        window.TokenStore.setOAuth(data.access_token,data.refresh_token,{login:user.login,id:user.id,avatar:user.avatar_url,scope:data.scope||scopes(),expiresAt,refreshExpiresAt:data.refresh_token_expires_in?Date.now()+Number(data.refresh_token_expires_in)*1000:0});
        setProgress("Authenticated as @"+user.login+".");window.DashboardUI?.toast("GitHub OAuth login successful.");syncUI();
        if(location.hash==="#login")location.hash="#control-center";
      }).catch(e=>{showError();window.DashboardUI?.toast(e.message)}).finally(()=>{pollTimer=null;syncUI()});
    }catch(e){showError();window.DashboardUI?.toast(e.message)}
  }
  function logout(){
    flowAbort=true;pollTimer=null;window.TokenStore.clearOAuth();syncUI();window.DashboardUI?.toast("GitHub OAuth session cleared.");if(location.hash==="#login")location.hash="#control-center";
  }
  function bindGlobal(){
    if(viewBound)return;viewBound=true;
    $("header-logout")?.addEventListener("click",logout);
  }
  function bindView(){
    bindGlobal();
    $("github-oauth-signin")?.addEventListener("click",startLogin);
    $("auth-logout")?.addEventListener("click",logout);
    $("auth-pat-fallback")?.addEventListener("click",()=>{$("pat-input")?.focus();$("pat-modal")?.showModal()});
  }
  function onView(route){if(route==="login"){viewBound=false;bindView();syncUI()}else syncUI()}
  const api={init:async()=>{bindGlobal();await restoreSession()},restoreSession,startLogin,logout,getToken:()=>window.TokenStore.get(),getSource:()=>window.TokenStore.source(),getUser:meta,onView,syncUI};
  window.AuthController=api;
})();