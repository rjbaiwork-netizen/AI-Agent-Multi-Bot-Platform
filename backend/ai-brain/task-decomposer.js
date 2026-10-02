const crypto=require("crypto");
const {generateAIResponse}=require("./gemini-client");
const DECOMPOSER_SYSTEM=`You are the task decomposition engine for a multi-agent AI platform.
Break a master user request into a small, useful set of specialist tasks.
Return ONLY valid JSON with root object {"subTasks":[...]}.
Each item must contain id, title, roleRequired, systemPrompt, status:"pending".
Prefer 1-6 subtasks. Do not invent unnecessary requirements. Make systemPrompt actionable and self-contained.`;
function extractJson(text){
  const raw=String(text||"").trim().replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/i,"");
  try{return JSON.parse(raw);}catch(e){}
  const match=raw.match(/\{[\s\S]*\}/);
  if(!match) throw new Error("Gemini decomposition response did not contain JSON.");
  return JSON.parse(match[0]);
}
function normalizeTasks(parsed,masterPrompt){
  const list=Array.isArray(parsed)?parsed:parsed&&parsed.subTasks;
  if(!Array.isArray(list)||!list.length) throw new Error("Gemini returned no subtasks.");
  return list.slice(0,6).map(function(task,index){return {
    id:String(task.id||("subtask-"+(index+1)+"-"+crypto.randomUUID().slice(0,8))),
    title:String(task.title||("Specialist task "+(index+1))).slice(0,180),
    roleRequired:String(task.roleRequired||"Generalist Specialist").slice(0,120),
    systemPrompt:String(task.systemPrompt||("Complete the assigned portion of this master request: "+masterPrompt)).slice(0,6000),
    status:"pending"
  };});
}
async function decomposeTask(masterPrompt){
  try{
    const response=await generateAIResponse("Master user request:\n\n"+String(masterPrompt).trim()+"\n\nDesign the smallest useful specialist pipeline.",DECOMPOSER_SYSTEM,{temperature:0.1,maxOutputTokens:5000});
    return normalizeTasks(extractJson(response.text),masterPrompt);
  }catch(error){
    if(error.message.indexOf("GEMINI_API_KEY")!==-1) throw error;
    return [{id:"subtask-1-"+crypto.randomUUID().slice(0,8),title:"Complete master request",roleRequired:"Generalist AI Specialist",systemPrompt:"Complete the user's master request accurately. State assumptions and deliver a useful final result.",status:"pending",fallbackReason:error.message}];
  }
}
module.exports={decomposeTask,extractJson,normalizeTasks};