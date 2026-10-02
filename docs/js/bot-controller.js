(() => {
function onView(route){
 if(route!=="chat")return;
 const send=document.getElementById("send-task");
 const prompt=document.getElementById("master-prompt");
 if(send&&!send.dataset.bound){send.dataset.bound="1";send.addEventListener("click",executeTask)}
 if(prompt&&!prompt.dataset.bound){prompt.dataset.bound="1";prompt.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")executeTask()})}
}
async function executeTask(){
 const prompt=document.getElementById("master-prompt");
 const strategy=document.getElementById("chat-strategy");
 const text=prompt?.value.trim();
 if(!text)return window.DashboardUI?.toast("Enter a master task prompt.");
 if(!window.BackendConnector.getBaseUrl())return window.DashboardUI?.toast("Start the ephemeral backend first.");
 const button=document.getElementById("send-task");if(button)button.disabled=true;
 addMessage("user",text);
 window.DashboardUI?.log("Submitting master task.","info");
 try{
  const result=await window.BackendConnector.submitTask({prompt:text,strategy:strategy?.value||"balanced",source:"ai-workspace",requestedAt:new Date().toISOString()});
  addMessage("ai",result.finalResponse||"Task completed.");
  window.DashboardUI?.toast("Task completed.");
  if(result.subBots)window.DashboardUI?.renderBots(result.subBots.map(b=>({role:b.roleRequired,title:b.title,status:b.status,progress:b.status==="completed"?100:60,output:b.output})));
 }catch(e){addMessage("ai","Backend task failed: "+e.message);window.DashboardUI?.log("Task failed: "+e.message,"error");window.DashboardUI?.toast(e.message)}
 finally{if(button)button.disabled=false}
}
function addMessage(type,text){
 const box=document.getElementById("chat-messages");if(!box)return;
 const article=document.createElement("article");article.className="bubble "+type;
 article.textContent=String(text);
 if(type==="ai"){const copy=document.createElement("button");copy.className="secondary-btn";copy.textContent="Copy response";copy.onclick=()=>navigator.clipboard?.writeText(String(text));article.appendChild(document.createElement("br"));article.appendChild(copy)}
 box.appendChild(article);box.scrollTop=box.scrollHeight;
}
window.BotController={onView,executeTask};
})();