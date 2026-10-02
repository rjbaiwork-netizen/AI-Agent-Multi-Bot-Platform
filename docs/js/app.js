(() => {
const routes={
"control-center":{title:"Control Center",file:"./views/control-center.html"},
"chat":{title:"AI Workspace",file:"./views/chat.html"},
"orchestrator":{title:"Bot Orchestrator",file:"./views/orchestrator.html"},
"logs":{title:"System Audit Logs",file:"./views/logs.html"},
"analytics":{title:"Analytics & API Usage",file:"./views/analytics.html"},
"settings":{title:"Platform Settings",file:"./views/settings.html"},
"docs":{title:"Documentation & Help Center",file:"./views/docs.html"},
"profile":{title:"Admin Profile",file:"./views/profile.html"},
"backup":{title:"System Backup & Recovery",file:"./views/backup.html"}
};
let current="";
async function load(route){
const cfg=routes[route]||routes["control-center"];current=routes[route]?route:"control-center";
document.getElementById("view-title").textContent=cfg.title;
document.querySelectorAll("[data-route]").forEach(a=>a.classList.toggle("active",a.dataset.route===current));
const host=document.getElementById("app-content")||document.getElementById("app-view");
host.innerHTML='<div class="panel"><p class="muted">Loading module…</p></div>';
try{const r=await fetch(cfg.file,{cache:"no-store"});if(!r.ok)throw new Error("Module HTTP "+r.status);host.innerHTML=await r.text()}
catch(e){host.innerHTML='<div class="panel"><p class="eyebrow">MODULE LOAD ERROR</p><h2>Could not load '+cfg.title+'</h2><p class="muted">'+escapeHtml(e.message)+'</p></div>';window.DashboardUI?.log("View load failed: "+e.message,"error");return}
window.lucide?.createIcons();window.DashboardUI?.onView(current);window.BotController?.onView(current);
}
function navigate(){load(location.hash.replace(/^#/,"")||"control-center")}
function escapeHtml(v){return String(v).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
const api={init(){
document.querySelectorAll("[data-route]").forEach(a=>a.addEventListener("click",()=>{document.getElementById("sidebar").classList.remove("open");document.getElementById("drawer-backdrop").classList.remove("show")}));
document.getElementById("menu-toggle")?.addEventListener("click",()=>{document.getElementById("sidebar").classList.add("open");document.getElementById("drawer-backdrop").classList.add("show")});
document.getElementById("drawer-backdrop")?.addEventListener("click",()=>{document.getElementById("sidebar").classList.remove("open");document.getElementById("drawer-backdrop").classList.remove("show")});
window.addEventListener("hashchange",navigate);navigate();window.DashboardUI?.init();
},routes,load,get current(){return current}};
window.App=api;
})();