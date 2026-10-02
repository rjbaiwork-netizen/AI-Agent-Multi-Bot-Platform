const express=require("express");
const fs=require("fs");
const path=require("path");
const {HEARTBEAT_INTERVAL_MS}=require("../config/constants");
const {getHeartbeat}=require("../core/circuit-breaker");
const router=express.Router();
const startedAt=Date.now();
function getActiveSubBotCount(){try{const registry=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../../registry/bot_registry.json"),"utf8"));const bots=Array.isArray(registry)?registry:(Array.isArray(registry.bots)?registry.bots:[]);return bots.filter(function(bot){return ["pending","running","active"].includes(String(bot.status).toLowerCase());}).length;}catch(error){console.warn("[status] registry read failed:",error.message);return 0;}}
router.get("/",function(req,res){const now=Date.now();res.json({status:"online",service:"Ephemeral Backend Engine",uptimeSeconds:Math.floor((now-startedAt)/1000),startedAt:new Date(startedAt).toISOString(),heartbeat:Object.assign({},getHeartbeat(),{nextPulseDueInMs:HEARTBEAT_INTERVAL_MS}),activeSubBotCount:getActiveSubBotCount(),timestamp:new Date(now).toISOString()});});
module.exports=router;