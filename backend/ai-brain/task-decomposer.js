const crypto=require("crypto");
const {generateAIResponse}=require("./gemini-client");
const DECOMPOSER_SYSTEM=`You are the Master Agent decomposition engine for an autonomous multi-bot platform.
Interpret the user's request and decide whether specialist bots must be created or existing bots can be reused.
Return ONLY valid JSON:
{"botRequests":[{"id":"optional-existing-uuid","name":"string","category":"Coder|Reviewer|Scraper|other","skills":["string"],"systemPrompt":"string","action":"create|load"}],"subTasks":[{"id":"string","title":"string","roleRequired":"string","botId":"optional-existing-uuid","systemPrompt":"string","status":"pending"}]}
Rules:
- Reuse an existing bot when the request explicitly names an existing bot ID; otherwise choose a category and allow the orchestrator to load the least-busy matching bot.
- Create a bot request when the user's task clearly needs a specialist category that may not exist.
- Keep botRequests minimal and subtasks 1-6.
- systemPrompt must be specialized, actionable, and safe.
- Never return markdown or commentary.`;
function extractJson(text){const raw=String(text||"").trim().replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/i,"");try{return JSON.parse(raw)}catch{}const match=raw.match(/\{[\s\S]*\}/);if(!match)throw new Error("Gemini decomposition response did not contain JSON.");return JSON.parse(match[0])}
function normalizeTasks(parsed,masterPrompt){
 const list=Array.isArray(parsed)?parsed:parsed&&parsed.subTasks,requests=Array.isArray(parsed?.botRequests)?parsed.botRequests:[];
 if(!Array.isArray(list)||!list.length)throw new Error("Gemini returned no subtasks.");
 return {botRequests:requests.slice(0,6).map((b,i)=>({id:b.id?String(b.id):null,name:String(b.name||("Specialist "+(i+1))).slice(0,100),category:String(b.category||b.role||"Generalist").slice(0,80),skills:Array.isArray(b.skills)?b.skills.map(String).slice(0,10):[],systemPrompt:String(b.systemPrompt||("You are a specialist "+(b.category||"Generalist")+" agent.")).slice(0,6000),action:b.action==="load"?"load":"create"})),subTasks:list.slice(0,6).map((task,index)=>({id:String(task.id||("subtask-"+(index+1)+"-"+crypto.randomUUID().slice(0,8))),title:String(task.title||("Specialist task "+(index+1))).slice(0,180),roleRequired:String(task.roleRequired||"Generalist").slice(0,120),botId:task.botId?String(task.botId):null,systemPrompt:String(task.systemPrompt||("Complete the assigned portion of this master request: "+masterPrompt)).slice(0,6000),status:"pending"}))};
}
async function decomposeTask(masterPrompt){
 try{const response=await generateAIResponse("Master user request:\n\n"+String(masterPrompt).trim()+"\n\nDesign the smallest useful autonomous specialist pipeline.",DECOMPOSER_SYSTEM,{temperature:0.1,maxOutputTokens:6000});return normalizeTasks(extractJson(response.text),masterPrompt)}
 catch(error){if(error.message.includes("GEMINI_API_KEY"))throw error;return {botRequests:[],subTasks:[{id:"subtask-1-"+crypto.randomUUID().slice(0,8),title:"Complete master request",roleRequired:"Generalist",botId:null,systemPrompt:"Complete the user's master request accurately. State assumptions and deliver a useful final result.",status:"pending",fallbackReason:error.message}]}}
}
module.exports={decomposeTask,extractJson,normalizeTasks};
