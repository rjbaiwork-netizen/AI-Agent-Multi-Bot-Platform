const crypto=require("crypto");
const {generateAIResponse}=require("./gemini-client");
const registry=require("../core/bot-registry");
async function executeSubTask(subTask,masterPrompt,bot){
 const startedAt=new Date().toISOString(),memory=bot?.brain?.memory||[],memoryText=memory.slice(-8).map(m=>"["+m.role+"] "+m.content).join("\n");
 try{
  const system=(bot?.systemPrompt||subTask.systemPrompt)+"\n\nYour isolated brain memory is private to this bot. Use it only as continuity context.";
  const prompt="Master request:\n"+masterPrompt+"\n\nAssigned sub-task:\n"+subTask.title+"\n\nRole:\n"+subTask.roleRequired+"\n\nRecent private memory:\n"+(memoryText||"(empty)")+"\n\nComplete only your assigned responsibility.";
  const response=await generateAIResponse(prompt,system,{temperature:0.25,maxOutputTokens:4096});
  const result=Object.assign({},subTask,{status:"completed",startedAt,completedAt:new Date().toISOString(),output:response.text,model:response.model,botInstanceId:bot.id,botId:bot.id,botName:bot.name});
  await registry.recordConversation(bot.id,{role:"user",content:masterPrompt,taskId:subTask.id,type:"task"});
  await registry.recordConversation(bot.id,{role:"assistant",content:response.text,taskId:subTask.id,type:"result"});
  await registry.setTaskState(bot.id,"idle",null);
  return result;
 }catch(error){if(bot?.id)await registry.setTaskState(bot.id,"idle",null).catch(()=>{});return Object.assign({},subTask,{status:"failed",startedAt,completedAt:new Date().toISOString(),output:"",error:error.message,botInstanceId:bot?.id||crypto.randomUUID(),botId:bot?.id||null,botName:bot?.name||null})}
}
async function synthesizeFinalResponse(masterPrompt,results){const usable=results.filter(i=>i.status==="completed");if(!usable.length)throw new Error("All sub-bots failed; no usable output is available.");const evidence=usable.map(i=>"["+i.title+" | "+i.roleRequired+" | "+(i.botName||"specialist")+"]\n"+i.output).join("\n\n---\n\n");const response=await generateAIResponse("Original master request:\n"+masterPrompt+"\n\nSpecialist outputs:\n"+evidence,"You are the lead synthesis agent. Combine specialist outputs into one accurate, coherent response. Resolve overlap and do not claim work absent from the outputs.",{temperature:0.2,maxOutputTokens:6000});return response.text}
async function runBots(masterPrompt,subTasks,options){options=options||{};const parallel=options.parallel!==false,startedAt=new Date().toISOString(),assignments=options.assignments||[];const worker=task=>executeSubTask(task,masterPrompt,assignments.find(a=>a.subTaskId===task.id)?.bot||null);const results=parallel?await Promise.all(subTasks.map(worker)):await subTasks.reduce(async(p,t)=>{const r=await p; r.push(await worker(t));return r},Promise.resolve([]));return {startedAt,completedAt:new Date().toISOString(),executionMode:parallel?"parallel":"sequential",subBots:results,finalResponse:await synthesizeFinalResponse(masterPrompt,results)}}
module.exports={executeSubTask,synthesizeFinalResponse,runBots};
