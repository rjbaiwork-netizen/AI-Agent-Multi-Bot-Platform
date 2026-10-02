const express=require("express");
const crypto=require("crypto");
const fs=require("fs/promises");
const path=require("path");
const {decomposeTask}=require("../ai-brain/task-decomposer");
const {runBots}=require("../ai-brain/bot-synthesizer");
const router=express.Router();
const tasks=new Map();
const pipelineFile=path.resolve(__dirname,"../../registry/task_pipeline.json");
const botRegistryFile=path.resolve(__dirname,"../../registry/bot_registry.json");
async function readArray(file){try{const value=JSON.parse(await fs.readFile(file,"utf8"));return Array.isArray(value)?value:[];}catch(error){if(error.code==="ENOENT")return[];throw error;}}
async function appendRecord(file,record,maxRecords){const records=await readArray(file);records.push(record);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(records.slice(-(maxRecords||100)),null,2)+"\n","utf8");}
router.get("/",function(req,res){res.json({status:"ready",activeTaskCount:tasks.size,tasks:Array.from(tasks.values())});});
router.post("/",async function(req,res){
  const masterPrompt=String((req.body&& (req.body.prompt||req.body.masterPrompt))||"").trim();
  const strategy=String((req.body&&req.body.strategy)||"balanced");
  if(!masterPrompt)return res.status(400).json({status:"error",error:"prompt is required"});
  if(masterPrompt.length>20000)return res.status(413).json({status:"error",error:"prompt exceeds 20,000 characters"});
  const taskId=crypto.randomUUID(),createdAt=new Date().toISOString();
  const pipeline={id:taskId,status:"decomposing",strategy:strategy,masterPrompt:masterPrompt,createdAt:createdAt,updatedAt:createdAt,subTasks:[],execution:null};
  tasks.set(taskId,pipeline);
  try{
    pipeline.subTasks=await decomposeTask(masterPrompt);
    pipeline.status="running";pipeline.updatedAt=new Date().toISOString();
    await appendRecord(pipelineFile,Object.assign({},pipeline,{event:"decomposed",loggedAt:new Date().toISOString()}));
    const execution=await runBots(masterPrompt,pipeline.subTasks,{parallel:strategy!=="sequential"});
    pipeline.execution=execution;
    pipeline.status=execution.subBots.some(function(bot){return bot.status==="failed";})?"completed_with_errors":"completed";
    pipeline.updatedAt=new Date().toISOString();
    for(const bot of execution.subBots) await appendRecord(botRegistryFile,{botInstanceId:bot.botInstanceId,taskId:taskId,role:bot.roleRequired,title:bot.title,status:bot.status,startedAt:bot.startedAt,completedAt:bot.completedAt,output:bot.output,error:bot.error||null},200);
    await appendRecord(pipelineFile,Object.assign({},pipeline,{event:"completed",loggedAt:new Date().toISOString()}));
    res.status(200).json({status:pipeline.status,taskId:taskId,strategy:strategy,finalResponse:execution.finalResponse,subBots:execution.subBots.map(function(bot){const copy=Object.assign({},bot);delete copy.systemPrompt;return copy;}),pipeline:{createdAt:createdAt,completedAt:execution.completedAt,executionMode:execution.executionMode}});
  }catch(error){
    pipeline.status="failed";pipeline.error=error.message;pipeline.updatedAt=new Date().toISOString();
    await appendRecord(pipelineFile,Object.assign({},pipeline,{event:"failed",loggedAt:new Date().toISOString()})).catch(function(){});
    const code=error.message.indexOf("GEMINI_API_KEY")!==-1?503:500;
    res.status(code).json({status:"failed",taskId:taskId,error:error.message});
  }
});
router.get("/:taskId",function(req,res){const task=tasks.get(req.params.taskId);if(!task)return res.status(404).json({status:"not_found",taskId:req.params.taskId});res.json(task);});
module.exports=router;