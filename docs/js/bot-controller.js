(() => {
  const ui=()=>window.DashboardUI;
  async function executeTask(){
    const prompt=document.getElementById("task-prompt").value.trim(),strategy=document.getElementById("strategy").value;
    if(!prompt)return ui().toast("Enter a master task prompt.");
    if(!window.BackendConnector.getBaseUrl()){ui().toast("Start the ephemeral backend first.");return}
    const button=document.getElementById("execute-task");button.disabled=true;ui().setPipeline("accepted");ui().log("Submitting master task...","info");
    try{
      const payload={prompt,strategy,source:"control-dashboard",requestedAt:new Date().toISOString()};
      const task=await window.BackendConnector.submitTask(payload);ui().log(`Task accepted: ${task.id}`,"ok");ui().setPipeline("decomposed");
      ui().renderBots([{role:"Task Coordinator",status:"accepted",output:`Task ${task.id} accepted. Strategy: ${strategy}`}]);
      ui().setPipeline("running");
      setTimeout(()=>ui().setPipeline("completed"),800);
    }catch(e){ui().log(`Task dispatch failed: ${e.message}`,"error");ui().toast(e.message);ui().setPipeline("accepted")}
    finally{button.disabled=false}
  }
  function init(){document.getElementById("execute-task")?.addEventListener("click",executeTask);document.getElementById("task-prompt")?.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")executeTask()})}
  window.BotController={init,executeTask};
})();