const crypto=require("crypto");
const {generateAIResponse}=require("./gemini-client");
async function executeSubTask(subTask,masterPrompt){
  const startedAt=new Date().toISOString();
  try{
    const response=await generateAIResponse("Master request:\n"+masterPrompt+"\n\nAssigned sub-task:\n"+subTask.title+"\n\nRole:\n"+subTask.roleRequired+"\n\nComplete only your assigned responsibility.",subTask.systemPrompt,{temperature:0.25,maxOutputTokens:4096});
    return Object.assign({},subTask,{status:"completed",startedAt:startedAt,completedAt:new Date().toISOString(),output:response.text,model:response.model,botInstanceId:crypto.randomUUID()});
  }catch(error){
    return Object.assign({},subTask,{status:"failed",startedAt:startedAt,completedAt:new Date().toISOString(),output:"",error:error.message,botInstanceId:crypto.randomUUID()});
  }
}
async function synthesizeFinalResponse(masterPrompt,results){
  const usable=results.filter(function(item){return item.status==="completed";});
  if(!usable.length) throw new Error("All sub-bots failed; no usable output is available.");
  const evidence=usable.map(function(item){return "["+item.title+" | "+item.roleRequired+"]\n"+item.output;}).join("\n\n---\n\n");
  const response=await generateAIResponse("Original master request:\n"+masterPrompt+"\n\nSpecialist outputs:\n"+evidence,"You are the lead synthesis agent. Combine specialist outputs into one accurate, coherent response. Resolve overlap and do not claim work absent from the outputs.",{temperature:0.2,maxOutputTokens:6000});
  return response.text;
}
async function runBots(masterPrompt,subTasks,options){
  options=options||{};
  const parallel=options.parallel!==false;
  const startedAt=new Date().toISOString();
  let results;
  if(parallel) results=await Promise.all(subTasks.map(function(task){return executeSubTask(task,masterPrompt);}));
  else {results=[];for(const task of subTasks) results.push(await executeSubTask(task,masterPrompt));}
  return {startedAt:startedAt,completedAt:new Date().toISOString(),executionMode:parallel?"parallel":"sequential",subBots:results,finalResponse:await synthesizeFinalResponse(masterPrompt,results)};
}
module.exports={executeSubTask,synthesizeFinalResponse,runBots};