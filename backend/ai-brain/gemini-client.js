const MODEL = "gemini-2.5-flash";
let clientPromise = null;
async function getClient() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");
  if (!clientPromise) clientPromise = import("@google/genai").then(function(mod){ return new mod.GoogleGenAI({apiKey:process.env.GEMINI_API_KEY}); });
  return clientPromise;
}
function cleanError(error){ return new Error("Gemini API request failed: " + (error && error.message ? error.message : String(error))); }
async function generateAIResponse(prompt, systemInstruction, options) {
  options=options||{};
  if (!String(prompt||"").trim()) throw new Error("Gemini prompt cannot be empty.");
  const attempts=Math.max(1,Number(options.retries===undefined?2:options.retries)+1);
  let lastError=null;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const ai=await getClient();
      const response=await ai.models.generateContent({model:MODEL,contents:String(prompt),config:Object.assign({},systemInstruction?{systemInstruction:String(systemInstruction)}:{},{temperature:options.temperature===undefined?0.2:options.temperature,maxOutputTokens:options.maxOutputTokens||4096})});
      const text=typeof response.text==="string"?response.text.trim():"";
      if(!text) throw new Error("Gemini returned an empty response.");
      return {text:text,model:MODEL,attempt:attempt};
    }catch(error){
      lastError=cleanError(error);
      if(attempt<attempts) await new Promise(function(resolve){setTimeout(resolve,Math.min(4000,500*Math.pow(2,attempt-1)));});
    }
  }
  throw lastError||new Error("Gemini request failed.");
}
module.exports={MODEL,generateAIResponse};