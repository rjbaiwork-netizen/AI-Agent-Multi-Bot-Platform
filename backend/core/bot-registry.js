const fs=require("fs/promises");
const path=require("path");
const crypto=require("crypto");
const ROOT=path.resolve(__dirname,"../../registry/bots");
const INDEX=path.join(ROOT,"index.json");
const MAX_MEMORY=50;
const DEFAULT_CATEGORY="Generalist";
async function ensureStore(){await fs.mkdir(ROOT,{recursive:true});try{await fs.access(INDEX)}catch{await fs.writeFile(INDEX,"[]\n","utf8")}}
async function readIndex(){await ensureStore();try{const v=JSON.parse(await fs.readFile(INDEX,"utf8"));return Array.isArray(v)?v:[]}catch{return[]}}
async function writeIndex(list){await ensureStore();await fs.writeFile(INDEX,JSON.stringify(list,null,2)+"\n","utf8")}
function clean(value,max){return String(value||"").trim().slice(0,max)}
function normalizeBot(input){
 const now=new Date().toISOString(),id=clean(input.id,80)||crypto.randomUUID(),category=clean(input.category||input.role,80)||DEFAULT_CATEGORY;
 return {id,name:clean(input.name,100)||("Bot-"+id.slice(0,8)),category,role:category,skills:Array.isArray(input.skills)?input.skills.map(v=>clean(v,40)).filter(Boolean).slice(0,12):[],systemPrompt:clean(input.systemPrompt||input.skillPrompt||input.prompt,6000)||("You are a specialist "+category+" agent. Work carefully and return actionable results."),status:"idle",activeTaskId:null,createdAt:input.createdAt||now,updatedAt:now,memoryCount:Number(input.memoryCount)||0};
}
async function readBrain(id){const file=path.join(ROOT,id,"brain.json");return JSON.parse(await fs.readFile(file,"utf8"))}
async function writeBrain(bot,memory){
 const dir=path.join(ROOT,bot.id);await fs.mkdir(dir,{recursive:true});
 const brain={schemaVersion:1,botId:bot.id,name:bot.name,category:bot.category,role:bot.role,skills:bot.skills,systemPrompt:bot.systemPrompt,memory:Array.isArray(memory)?memory.slice(-MAX_MEMORY):[],memoryCount:Array.isArray(memory)?Math.min(memory.length,MAX_MEMORY):0,lastUpdated:new Date().toISOString()};
 await fs.writeFile(path.join(dir,"brain.json"),JSON.stringify(brain,null,2)+"\n","utf8");return brain;
}
async function listBots(){const list=await readIndex();return Promise.all(list.map(async meta=>{try{const brain=await readBrain(meta.id);return Object.assign({},meta,{memoryCount:brain.memory.length,memoryState:brain.memory.length?"populated":"empty"})}catch{return meta}}))}
async function getBot(id){const list=await readIndex(),meta=list.find(b=>b.id===id);if(!meta)return null;try{return Object.assign({},meta,{brain:await readBrain(id)})}catch{return Object.assign({},meta,{brain:{memory:[]}})}}
async function createBot(input){
 const bot=normalizeBot(input),list=await readIndex();
 if(list.some(b=>b.id===bot.id))throw new Error("Bot ID already exists.");
 list.push(bot);await writeIndex(list);await writeBrain(bot,[]);return getBot(bot.id);
}
async function updateBot(id,patch){
 const list=await readIndex(),idx=list.findIndex(b=>b.id===id);if(idx<0)throw new Error("Bot not found.");
 const current=Object.assign({},list[idx]),next=Object.assign(current,{name:clean(patch.name,100)||current.name,category:clean(patch.category||patch.role,80)||current.category,role:clean(patch.role||patch.category,80)||current.role,skills:Array.isArray(patch.skills)?patch.skills.map(v=>clean(v,40)).filter(Boolean).slice(0,12):current.skills,systemPrompt:patch.systemPrompt!==undefined?clean(patch.systemPrompt,6000):current.systemPrompt,updatedAt:new Date().toISOString()});
 list[idx]=next;await writeIndex(list);const brain=await readBrain(id).catch(()=>({memory:[]}));await writeBrain(next,brain.memory||[]);return getBot(id);
}
async function resetBrain(id){const bot=await getBot(id);if(!bot)throw new Error("Bot not found.");await writeBrain(bot,[]);const list=await readIndex();const idx=list.findIndex(b=>b.id===id);list[idx]=Object.assign({},list[idx],{memoryCount:0,updatedAt:new Date().toISOString(),status:"idle",activeTaskId:null});await writeIndex(list);return getBot(id)}
async function deleteBot(id){const list=await readIndex(),bot=list.find(b=>b.id===id);if(!bot)throw new Error("Bot not found.");await fs.rm(path.join(ROOT,id),{recursive:true,force:true});await writeIndex(list.filter(b=>b.id!==id));return bot}
async function selectBot(category,preferredId){
 const list=await listBots(),normalized=clean(category,80).toLowerCase();
 let candidates=preferredId?list.filter(b=>b.id===preferredId):list.filter(b=>String(b.category).toLowerCase()===normalized);
 if(!candidates.length)candidates=list.filter(b=>String(b.role).toLowerCase()===normalized);
 if(!candidates.length)return null;
 candidates.sort((a,b)=>(a.activeTaskId?1:0)-(b.activeTaskId?1:0)||(a.memoryCount||0)-(b.memoryCount||0));
 return getBot(candidates[0].id);
}
async function setTaskState(id,status,taskId){
 const list=await readIndex(),idx=list.findIndex(b=>b.id===id);if(idx<0)return null;
 list[idx]=Object.assign({},list[idx],{status,activeTaskId:status==="active"||status==="running"?taskId:null,updatedAt:new Date().toISOString()});await writeIndex(list);return getBot(id);
}
async function recordConversation(id,entry){
 const bot=await getBot(id);if(!bot)throw new Error("Bot not found.");
 const memory=Array.isArray(bot.brain.memory)?bot.brain.memory:[];memory.push(Object.assign({timestamp:new Date().toISOString()},entry));await writeBrain(bot,memory);const list=await readIndex(),idx=list.findIndex(b=>b.id===id);if(idx>=0){list[idx]=Object.assign({},list[idx],{memoryCount:Math.min(memory.length,MAX_MEMORY),updatedAt:new Date().toISOString()});await writeIndex(list)}return getBot(id);
}
function parseBotCommand(prompt){
 const text=String(prompt||"").trim();
 const explicit=text.match(/(?:\/bot\s+)?create(?:\s+new)?\s+bot\s*[:\-]?\s*(?:name\s*=\s*)?["']?([^"',;]+?)["']?\s+(?:as|role|category)\s*[:=]?\s*["']?([^"',;]+?)["']?(?:\s+(?:skill|skills|prompt)\s*[:=]\s*["']?(.+?)["']?)?$/i);
 if(explicit)return {action:"create",name:explicit[1].trim(),category:explicit[2].trim(),systemPrompt:(explicit[3]||"").trim()};
 const simple=text.match(/create\s+(?:a\s+)?(?:new\s+)?bot\s+(?:named\s+)?["']([^"']+)["']\s+(?:for|as)\s+([a-z0-9 _-]+)(?:\s+with\s+(?:skill|expertise)\s+(.+))?$/i);
 if(simple)return {action:"create",name:simple[1].trim(),category:simple[2].trim(),systemPrompt:(simple[3]||"").trim()};
 const load=text.match(/(?:load|use|activate)\s+(?:existing\s+)?bot\s*[:=]?\s*["']?([a-f0-9-]{20,}|[^"']{2,80})["']?$/i);
 if(load)return {action:"load",query:load[1].trim()};
 return null;
}
module.exports={ROOT,INDEX,listBots,getBot,createBot,updateBot,resetBrain,deleteBot,selectBot,setTaskState,recordConversation,parseBotCommand};
