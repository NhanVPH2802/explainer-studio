const fs = require('fs');
const path = require('path');

const PROVIDERS = {
  openai: {name: 'OpenAI', kind: 'openai-compatible', baseUrl: 'https://api.openai.com/v1'},
  claude: {name: 'Claude', kind: 'anthropic', baseUrl: 'https://api.anthropic.com'},
  gemini: {name: 'Gemini', kind: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com'},
  grok: {name: 'Grok', kind: 'openai-compatible', baseUrl: 'https://api.x.ai/v1'},
  deepseek: {name: 'DeepSeek', kind: 'openai-compatible', baseUrl: 'https://api.deepseek.com'},
  mistral: {name: 'Mistral', kind: 'openai-compatible', baseUrl: 'https://api.mistral.ai/v1'},
  groq: {name: 'Groq', kind: 'openai-compatible', baseUrl: 'https://api.groq.com/openai/v1'},
  custom: {name: 'Custom AI', kind: 'openai-compatible', baseUrl: ''},
};

const SYSTEM_PROMPT = `Bạn là AI viết nội dung cho Explainer Studio.
AI CHỈ sinh nội dung. Không sinh React, CSS, SVG, HTML hay mã Remotion.
Video dọc 9:16. Intro/Outro thương hiệu do hệ thống quản lý riêng, AI không được tự chèn thông tin kênh giả.
Trả về DUY NHẤT JSON hợp lệ, không markdown, không giải thích ngoài JSON.
Schema:
{
  "title":"string",
  "topic":"string",
  "language":"vi",
  "recommendedDuration":60,
  "scenes":[{"id":"scene1","type":"hook|problem|solution|workflow|benefit|example|summary","headline":"string","body":"string","voiceover":"string","keywords":["string"]}]
}
Yêu cầu:
- Headline ngắn 3-8 từ; Body ngắn, dễ đọc trên điện thoại.
- Voiceover tự nhiên, rõ ràng, phù hợp TTS.
- Cảnh đầu tạo tò mò; các cảnh giữa giải thích logic; cảnh cuối tóm tắt trước Outro hệ thống.
- Không dùng emoji làm icon. Không bịa thông số kỹ thuật.
- recommendedDuration chỉ là 60, 90 hoặc 120.`;

function ensureDir(dir){fs.mkdirSync(dir,{recursive:true});}
function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function writeJson(file,data){ensureDir(path.dirname(file));fs.writeFileSync(file,JSON.stringify(data,null,2));}
function normalizeBaseUrl(url){return String(url||'').trim().replace(/\/+$/,'');}
function maskKey(key){if(!key)return '';if(key.length<=8)return '********';return `${key.slice(0,4)}********${key.slice(-4)}`;}
function cleanJsonText(text){const t=String(text||'').trim();if(!t)throw new Error('AI returned an empty response');const fenced=t.match(/```(?:json)?\s*([\s\S]*?)```/i);const source=fenced?fenced[1].trim():t;const first=source.indexOf('{'),last=source.lastIndexOf('}');if(first<0||last<first)throw new Error('AI response did not contain JSON');return source.slice(first,last+1);}
function validateScript(obj){
  if(!obj||typeof obj!=="object")throw new Error("Invalid script object");
  if(!Array.isArray(obj.scenes)||obj.scenes.length<4||obj.scenes.length>12)throw new Error("Script must contain 4-12 scenes");
  obj.scenes.forEach((s,i)=>{if(!s||typeof s!=="object")throw new Error(`Scene ${i+1} is invalid`);s.id=String(s.id||`scene${i+1}`);s.type=String(s.type||"content");for(const k of ["headline","body","voiceover"])if(!String(s[k]||"").trim())throw new Error(`Scene ${i+1} missing ${k}`);if(!Array.isArray(s.keywords))s.keywords=[];});
  obj.language=obj.language||"vi";const rd=Number(obj.recommendedDuration||60);obj.recommendedDuration=[60,90,120].includes(rd)?rd:60;return obj;
}

function createManager(dataDir){
  const file=path.join(dataDir,'ai-providers.json');
  const scriptDir=path.join(dataDir,'scripts');
  ensureDir(scriptDir);
  let config=readJson(file,{providers:{}});if(!config.providers)config.providers={};
  const save=()=>writeJson(file,config);
  function publicState(){return {presets:PROVIDERS,providers:Object.fromEntries(Object.entries(config.providers).map(([id,c])=>[id,{...c,apiKey:undefined,hasApiKey:Boolean(c.apiKey),apiKeyMasked:maskKey(c.apiKey)}]))};}
  function getProvider(id,modelOverride=''){const preset=PROVIDERS[id];if(!preset)throw new Error('Unknown provider');const saved=config.providers[id]||{};return{id,name:saved.name||preset.name,kind:saved.kind||preset.kind,baseUrl:normalizeBaseUrl(saved.baseUrl||preset.baseUrl),apiKey:saved.apiKey||'',model:String(modelOverride||saved.model||'').trim(),models:Array.isArray(saved.models)?saved.models:[],connected:Boolean(saved.connected),lastTest:saved.lastTest||null};}
  function updateProvider(id,body){if(!PROVIDERS[id])throw new Error('Unknown provider');const old=config.providers[id]||{};const next={name:String(body.name||old.name||PROVIDERS[id].name).trim(),kind:String(body.kind||old.kind||PROVIDERS[id].kind).trim(),baseUrl:normalizeBaseUrl(body.baseUrl!==undefined?body.baseUrl:(old.baseUrl||PROVIDERS[id].baseUrl)),apiKey:body.clearApiKey?'':(body.apiKey?String(body.apiKey).trim():(old.apiKey||'')),models:Array.isArray(old.models)?old.models:[],connected:Boolean(old.connected),lastTest:old.lastTest||null,updatedAt:new Date().toISOString()};config.providers[id]=next;save();return publicState();}
  function deleteProvider(id){delete config.providers[id];save();return publicState();}
  function clearKey(id){if(!PROVIDERS[id])throw new Error('Unknown provider');const old=config.providers[id]||{};config.providers[id]={...old,apiKey:'',connected:false,lastTest:null,lastError:'',updatedAt:new Date().toISOString()};save();return publicState();}
  function resolveDefault(){const d=latestSuccessfulSelection();if(d)return{providerId:d.id,model:d.model};throw new Error('Chế độ mặc định cần ít nhất một AI Provider có model sinh văn bản đã kết nối thành công.');}

  async function fetchJson(url,opts={}){const r=await fetch(url,{...opts,signal:AbortSignal.timeout(30000)});const text=await r.text();let data=null;try{data=JSON.parse(text);}catch{}if(!r.ok)throw new Error(`HTTP ${r.status}: ${text.slice(0,500)}`);return data;}
  async function discoverModels(p){
    if(!p.apiKey)throw new Error('API Key is required');
    let models=[];
    if(p.kind==='gemini'){
      const base=p.baseUrl||'https://generativelanguage.googleapis.com';
      const d=await fetchJson(`${base}/v1beta/models?key=${encodeURIComponent(p.apiKey)}`);
      models=(d?.models||[]).map(x=>String(x.name||'').replace(/^models\//,'')).filter(Boolean);
    }else if(p.kind==='anthropic'){
      const base=p.baseUrl||'https://api.anthropic.com';
      const d=await fetchJson(`${base}/v1/models`,{headers:{'x-api-key':p.apiKey,'anthropic-version':'2023-06-01'}});
      models=(d?.data||[]).map(x=>x.id).filter(Boolean);
    }else{
      if(!p.baseUrl)throw new Error('Base URL is required');
      const d=await fetchJson(`${p.baseUrl}/models`,{headers:{Authorization:`Bearer ${p.apiKey}`}});
      models=(d?.data||d?.models||[]).map(x=>typeof x==='string'?x:(x.id||x.name)).filter(Boolean);
    }
    models=[...new Set(models)].sort();
    if(!models.length)throw new Error('Kết nối được nhưng provider không trả về danh sách model. Với Custom AI có thể cần endpoint /models tương thích OpenAI.');
    return models;
  }
  async function test(id){const p=getProvider(id);const models=await discoverModels(p);const saved=config.providers[id]||{};saved.models=models;saved.connected=true;saved.lastTest=new Date().toISOString();saved.lastError='';config.providers[id]=saved;save();return{ok:true,provider:id,name:p.name,models,count:models.length};}

  async function callOpenAICompatible(p,messages,maxTokens=1800){if(!p.baseUrl)throw new Error('Base URL is required');if(!p.apiKey)throw new Error('API Key is required');if(!p.model)throw new Error('Model is required');const r=await fetch(`${p.baseUrl}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${p.apiKey}`},body:JSON.stringify({model:p.model,messages,temperature:0.5,max_tokens:maxTokens}),signal:AbortSignal.timeout(90000)});const text=await r.text();if(!r.ok)throw new Error(`HTTP ${r.status}: ${text.slice(0,700)}`);const d=JSON.parse(text);const out=d?.choices?.[0]?.message?.content;if(!out)throw new Error('Provider returned no message content');return out;}
  async function callAnthropic(p,userPrompt,maxTokens=1800){if(!p.apiKey||!p.model)throw new Error('API Key and Model are required');const r=await fetch(`${p.baseUrl||'https://api.anthropic.com'}/v1/messages`,{method:'POST',headers:{'Content-Type':'application/json','x-api-key':p.apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:p.model,max_tokens:maxTokens,temperature:0.5,system:SYSTEM_PROMPT,messages:[{role:'user',content:userPrompt}]}),signal:AbortSignal.timeout(90000)});const text=await r.text();if(!r.ok)throw new Error(`HTTP ${r.status}: ${text.slice(0,700)}`);const d=JSON.parse(text);const out=Array.isArray(d.content)?d.content.filter(x=>x.type==='text').map(x=>x.text).join('\n'):'';if(!out)throw new Error('Claude returned no text content');return out;}
  async function callGemini(p,userPrompt,maxTokens=1800){if(!p.apiKey||!p.model)throw new Error('API Key and Model are required');const base=p.baseUrl||'https://generativelanguage.googleapis.com';const r=await fetch(`${base}/v1beta/models/${encodeURIComponent(p.model)}:generateContent?key=${encodeURIComponent(p.apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM_PROMPT}]},contents:[{role:'user',parts:[{text:userPrompt}]}],generationConfig:{temperature:0.5,maxOutputTokens:maxTokens,responseMimeType:'application/json'}}),signal:AbortSignal.timeout(90000)});const text=await r.text();if(!r.ok)throw new Error(`HTTP ${r.status}: ${text.slice(0,700)}`);const d=JSON.parse(text);const out=d?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('\n');if(!out)throw new Error('Gemini returned no text content');return out;}
  async function callProvider(id,model,userPrompt,maxTokens=1800){const p=getProvider(id,model);if(p.kind==='anthropic')return callAnthropic(p,userPrompt,maxTokens);if(p.kind==='gemini')return callGemini(p,userPrompt,maxTokens);return callOpenAICompatible(p,[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:userPrompt}],maxTokens);}
  function latestSuccessfulSelection(){
    try{
      const files=fs.readdirSync(scriptDir).filter(x=>x.endsWith('.json')).map(x=>({x,t:fs.statSync(path.join(scriptDir,x)).mtimeMs})).sort((a,b)=>b.t-a.t);
      for(const f of files){
        const d=readJson(path.join(scriptDir,f.x),null);const id=d?.ai?.provider, m=d?.ai?.model;
        if(id&&m){const p=getProvider(id,m);if(p.connected&&p.models.includes(m))return{id,model:m};}
      }
    }catch{}
    const bad=/(antigravity|image|imagen|veo|audio|tts|embedding|computer-use|deep-research)/i;
    for(const id of Object.keys(PROVIDERS)){
      const p=getProvider(id);if(!p.connected)continue;
      const models=(p.models||[]).filter(m=>!bad.test(m));
      const preferred=models.find(m=>/(flash|pro|sonnet|gpt|grok|llama|mistral|deepseek)/i.test(m))||models[0];
      if(preferred)return{id,model:preferred};
    }
    return null;
  }
  async function generate({mode,providerId,model,topic,duration,voiceProvider,voiceId,channelSettings}){
    if(mode==='default'&&(!providerId||!model)){const d=resolveDefault();providerId=d.providerId;model=d.model;}
    if(!providerId)throw new Error('Chọn AI trước');if(!model)throw new Error('Chọn Model AI trước');
    const p=getProvider(providerId,model);if(!p.connected)throw new Error('AI chưa được kiểm tra kết nối thành công');
    const rawDuration=String(duration||'60'),auto=rawDuration==='auto',fixed=auto?null:Number(rawDuration);
    const desiredScenes=auto?'5-10':(fixed>=120?10:(fixed>=90?8:6));
    const durationInstruction=auto?'Hệ thống đang ở chế độ Tự đề xuất. Hãy chọn recommendedDuration là 60, 90 hoặc 120 giây dựa vào độ rộng của chủ đề.':`Thời lượng mục tiêu: ${fixed} giây. recommendedDuration phải là ${fixed}.`;
    const userPrompt=`Chủ đề: ${String(topic||'').trim()}\n${durationInstruction}\nSố cảnh nội dung mong muốn: ${desiredScenes}. Intro và Outro do hệ thống thêm riêng, không tính vào scenes.\nHãy viết nội dung tiếng Việt theo schema bắt buộc.`;
    const text=await callProvider(providerId,model,userPrompt,3600);const parsed=validateScript(JSON.parse(cleanJsonText(text)));
    parsed.topic=parsed.topic||String(topic||'').trim();parsed.ai={mode:mode||'provider',provider:providerId,providerName:p.name,model};parsed.targetDuration=auto?parsed.recommendedDuration:(fixed||60);parsed.durationMode=auto?'auto':'fixed';parsed.voice={provider:voiceProvider||'',voiceId:voiceId||''};parsed.channel=channelSettings||{};parsed.createdAt=new Date().toISOString();
    const safe=(parsed.topic||'script').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'script';const name=`${Date.now()}-${safe}.json`;writeJson(path.join(scriptDir,name),parsed);return{script:parsed,file:name};
  }
  return{publicState,updateProvider,deleteProvider,clearKey,test,generate};
}
module.exports={createManager};
