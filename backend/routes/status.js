const express=require("express");
const {HEARTBEAT_INTERVAL_MS}=require("../config/constants");
const {getHeartbeat}=require("../core/circuit-breaker");
const registry=require("../core/bot-registry");
const router=express.Router();
const startedAt=Date.now();
router.get("/",async(req,res)=>{const now=Date.now();let bots=[];try{bots=await registry.listBots()}catch(error){console.warn("[status] bot registry read failed:",error.message)}res.json({status:"online",service:"Ephemeral Backend Engine",uptimeSeconds:Math.floor((now-startedAt)/1000),startedAt:new Date(startedAt).toISOString(),heartbeat:Object.assign({},getHeartbeat(),{nextPulseDueInMs:HEARTBEAT_INTERVAL_MS}),activeSubBotCount:bots.filter(b=>["pending","running","active"].includes(String(b.status).toLowerCase())).length,registeredBotCount:bots.length,botMemoryEntries:bots.reduce((n,b)=>n+(Number(b.memoryCount)||0),0),timestamp:new Date(now).toISOString()})});
module.exports=router;
