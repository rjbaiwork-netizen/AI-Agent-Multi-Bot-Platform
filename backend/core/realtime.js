const clients=new Set();
function write(client,event,data){try{client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)}catch{clients.delete(client)}}
function addClient(res){clients.add(res);res.on("close",()=>clients.delete(res));res.on("error",()=>clients.delete(res))}
function broadcast(event,data){for(const client of clients)write(client,event,data)}
async function snapshot(){
 try{
  const registry=require("./bot-registry");
  const {getHeartbeat}=require("./circuit-breaker");
  const bots=await registry.listBots();
  const now=Date.now();
  broadcast("snapshot",{timestamp:new Date(now).toISOString(),status:"online",heartbeat:getHeartbeat(),activeSubBotCount:bots.filter(b=>["pending","running","active"].includes(String(b.status).toLowerCase())).length,registeredBotCount:bots.length,botMemoryEntries:bots.reduce((n,b)=>n+(Number(b.memoryCount)||0),0),bots});
 }catch(error){broadcast("error",{message:error.message,timestamp:new Date().toISOString()})}
}
const timer=setInterval(snapshot,1000);timer.unref?.();
module.exports={addClient,broadcast,snapshot};
