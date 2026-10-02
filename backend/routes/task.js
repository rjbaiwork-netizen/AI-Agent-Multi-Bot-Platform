const express=require("express");
const crypto=require("crypto");
const fs=require("fs/promises");
const path=require("path");
const {decomposeTask}=require("../ai-brain/task-decomposer");
const {runBots}=require("../ai-brain/bot-synthesizer");
const registry=require("../core/bot-registry");
const router=express.Router();
const tasks=new Map();
const pipelineFile=path.resolve(__dirname,"../../registry/task_pipeline.json");
const botRegistryFile=path.resolve(__dirname,"../../registry/bot_registry.json");
async function readArray(file){try{const value=JSON.parse(await fs.readFile(file,"utf8"));return Array.isArray(value)?value:[]}catch(error){if(error.code==="ENOENT")return[];throw error}}
async function appendRecord(file,record,maxRecords){const records=await readArray(file);records.push(record);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(records.slice(-(maxRecords||100)),null,2)+"\n","utf8")}
async function resolveAssignment(subTask,taskId){
 let bot=await registry.selectBot(subTask.roleRequired,subTask.botId);
 if(bot&&(bot.status==="active"||bot.status==="running"))bot=await registry.createBot({name:bot.name+" Worker",category:bot.category,skills:bot.skills,systemPrompt:bot.systemPrompt});
 if(!bot)bot=await registry.createBot({name:(subTask.roleRequired||"Generalist")+" Bot",category:subTask.roleRequired||"Generalist",skills:[],systemPrompt:subTask.systemPrompt});
 await registry.setTaskState(bot.id,"active",taskId);return bot;
}
router.get("/",(req,res)=>res.json({status:"ready",activeTaskCount:tasks.size,tasks:Array.from(tasks.values())}));
router.post("/",async(req,res)=>{
 const masterPrompt=String((req.body&&(req.body.prompt||req.body.masterPrompt))||"").trim(),strategy=String((req.body&&req.body.strategy)||"balanced");
 if(!masterPrompt)return res.status(400).json({status:"error",error:"prompt is required"});
 if(masterPrompt.length>20000)return res.status(413).json({status:"error",error:"prompt exceeds 20,000 characters"});
 const taskId=crypto.randomUUID(),createdAt=new Date().toISOString(),pipeline={id:taskId,status:"decomposing",strategy,masterPrompt,createdAt,updatedAt:createdAt,subTasks:[],botRequests:[],assignments:[],execution:null};
 tasks.set(taskId,pipeline);
 try{
  const command=registry.parseBotCommand(masterPrompt);
  if(command?.action==="create"){const bot=await registry.createBot({name:command.name,category:command.category,skills:command.systemPrompt?command.systemPrompt.split(",").map(s=>s.trim()).filter(Boolean):[],systemPrompt:command.systemPrompt});pipeline.status="bot_created";pipeline.updatedAt=new Date().toISOString();await appendRecord(pipelineFile,Object.assign({},pipeline,{event:"bot_created",botId:bot.id,loggedAt:new Date().toISOString()}));return res.json({status:"bot_created",taskId,finalResponse:"Created bot "+bot.name+" ("+bot.id+") and loaded its isolated brain.",bot,subBots:[]})}
  if(command?.action==="load"){const bot=/^[a-f0-9-]{20,}$/i.test(command.query||"")?await registry.getBot(command.query):null;if(!bot)return res.status(404).json({status:"not_found",taskId,error:"Existing bot ID could not be loaded."});pipeline.status="bot_loaded";pipeline.updatedAt=new Date().toISOString();await appendRecord(pipelineFile,Object.assign({},pipeline,{event:"bot_loaded",botId:bot.id,loggedAt:new Date().toISOString()}));return res.json({status:"bot_loaded",taskId,finalResponse:"Loaded bot "+bot.name+" ("+bot.id+") with "+(bot.brain?.memory?.length||0)+" memory entries.",bot,subBots:[]})}
  const decomposition=await decomposeTask(masterPrompt);pipeline.subTasks=decomposition.subTasks;pipeline.botRequests=decomposition.botRequests;
  for(const request of decomposition.botRequests){if(request.action==="load"&&request.id)continue;await registry.createBot({id:request.id||undefined,name:request.name,category:request.category,skills:request.skills,systemPrompt:request.systemPrompt})}
  pipeline.status="running";pipeline.updatedAt=new Date().toISOString();
  const assignments=[];
  for(const subTask of pipeline.subTasks){const bot=await resolveAssignment(subTask,taskId);assignments.push({subTaskId:subTask.id,bot});pipeline.assignments.push({subTaskId:subTask.id,botId:bot.id})}
  await appendRecord(pipelineFile,Object.assign({},pipeline,{event:"decomposed",loggedAt:new Date().toISOString()}));
  const execution=await runBots(masterPrompt,pipeline.subTasks,{parallel:strategy!=="sequential",assignments});
  pipeline.execution=execution;pipeline.status=execution.subBots.some(bot=>bot.status==="failed")?"completed_with_errors":"completed";pipeline.updatedAt=new Date().toISOString();
  for(const bot of execution.subBots)await appendRecord(botRegistryFile,{botId:bot.botId,botInstanceId:bot.botInstanceId,taskId,role:bot.roleRequired,title:bot.title,status:bot.status,startedAt:bot.startedAt,completedAt:bot.completedAt,output:bot.output,error:bot.error||null},200);
  await appendRecord(pipelineFile,Object.assign({},pipeline,{event:"completed",loggedAt:new Date().toISOString()}));
  res.json({status:pipeline.status,taskId,strategy,finalResponse:execution.finalResponse,subBots:execution.subBots.map(bot=>{const copy=Object.assign({},bot);delete copy.systemPrompt;return copy}),pipeline:{createdAt,completedAt:execution.completedAt,executionMode:execution.executionMode,botRequests:pipeline.botRequests,assignments:pipeline.assignments}});
 }catch(error){pipeline.status="failed";pipeline.error=error.message;pipeline.updatedAt=new Date().toISOString();await appendRecord(pipelineFile,Object.assign({},pipeline,{event:"failed",loggedAt:new Date().toISOString()})).catch(()=>{});const code=error.message.includes("GEMINI_API_KEY")?503:500;res.status(code).json({status:"failed",taskId,error:error.message})}
});
router.get("/:taskId",(req,res)=>{const task=tasks.get(req.params.taskId);if(!task)return res.status(404).json({status:"not_found",taskId:req.params.taskId});res.json(task)});
module.exports=router;
