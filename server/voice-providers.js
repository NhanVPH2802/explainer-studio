const fs=require('fs');
const path=require('path');

const PROVIDERS={
  edge:{name:'Edge TTS',kind:'edge',baseUrl:'',builtin:true},
  vieneu:{name:'VieNeu-TTS',kind:'vieneu',baseUrl:'http://192.168.1.154:8000'},
  openai_voice:{name:'OpenAI Voice',kind:'openai-voice',baseUrl:'https://api.openai.com/v1'},
  elevenlabs:{name:'ElevenLabs',kind:'elevenlabs',baseUrl:'https://api.elevenlabs.io/v1'},
  custom_voice:{name:'Custom Voice API',kind:'custom-rest',baseUrl:''},
};
const EDGE_VOICES=[
  {id:'vi-VN-NamMinhNeural',name:'Nam Minh',language:'vi-VN'},
  {id:'vi-VN-HoaiMyNeural',name:'Hoài My',language:'vi-VN'},
];
function ensureDir(d){fs.mkdirSync(d,{recursive:true});}
function readJson(f,x){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return x;}}
function writeJson(f,d){ensureDir(path.dirname(f));fs.writeFileSync(f,JSON.stringify(d,null,2));}
function norm(u){return String(u||'').trim().replace(/\/+$/,'');}
function canonicalVieNeuBase(u){
  const base=norm(u||'http://192.168.1.154:8000');
  try{
    const x=new URL(base);
    // VieNeu REST API runs on port 8000. The UI may run on 7680/7860,
    // but Explainer Studio must never use the UI port for REST discovery.
    if(!x.port || x.port==='7680' || x.port==='7860' || x.port!=='8000'){
      x.port='8000';
    }
    return norm(x.toString());
  }catch{}
  return 'http://192.168.1.154:8000';
}
function mask(k){if(!k)return '';if(k.length<=8)return '********';return `${k.slice(0,4)}********${k.slice(-4)}`;}
function unique(arr){return [...new Set(arr.filter(Boolean))];}
function createVoiceManager(dataDir){
 const file=path.join(dataDir,'voice-providers.json');let config=readJson(file,{providers:{}});if(!config.providers)config.providers={};
 const save=()=>writeJson(file,config);
 // Repair stale VieNeu settings immediately on backend startup.
 {
   const old=config.providers.vieneu||{};
   const fixed=canonicalVieNeuBase(old.baseUrl||PROVIDERS.vieneu.baseUrl);
   const staleVoices=Array.isArray(old.voices) && old.voices.some(v=>/VieNeu-TTS-v3-Turbo|Custom Model/i.test(String(v?.id||v?.name||'')));
   if(old.baseUrl!==fixed || staleVoices){
     config.providers.vieneu={...old,name:'VieNeu-TTS',kind:'vieneu',baseUrl:fixed,connected:false,voices:[],voicesEndpoint:'',ttsEndpoint:'',lastWarning:'',lastTest:null,updatedAt:new Date().toISOString()};
     save();
   }
 }
 function publicState(){
   const providers={};
   for(const [id,preset] of Object.entries(PROVIDERS)){
     const c=config.providers[id]||{};
     const normalized={...c};
     if(id==='vieneu'){normalized.kind='vieneu';normalized.name='VieNeu-TTS';normalized.baseUrl=canonicalVieNeuBase(c.baseUrl||preset.baseUrl);}
     providers[id]={...normalized,apiKey:undefined,hasApiKey:Boolean(c.apiKey),apiKeyMasked:mask(c.apiKey)};
     if(preset.builtin){
       providers[id]={...providers[id],name:preset.name,kind:preset.kind,baseUrl:'',connected:true,voices:EDGE_VOICES,lastTest:providers[id].lastTest||null};
     }
   }
   return{presets:PROVIDERS,providers};
 }
 function get(id){const p=PROVIDERS[id];if(!p)throw new Error('Unknown voice provider');const s=config.providers[id]||{};let baseUrl=norm(s.baseUrl||p.baseUrl);if(id==='vieneu')baseUrl=canonicalVieNeuBase(baseUrl);return{id,name:id==='vieneu'?'VieNeu-TTS':(s.name||p.name),kind:id==='vieneu'?'vieneu':(s.kind||p.kind),baseUrl,apiKey:s.apiKey||'',voices:Array.isArray(s.voices)?s.voices:[],connected:p.builtin?true:Boolean(s.connected),voicesEndpoint:s.voicesEndpoint||'',ttsEndpoint:s.ttsEndpoint||''};}
 function update(id,b){if(!PROVIDERS[id])throw new Error('Unknown voice provider');const p=PROVIDERS[id],o=config.providers[id]||{};let baseUrl=norm(b.baseUrl!==undefined?b.baseUrl:(o.baseUrl||p.baseUrl));if(id==='vieneu')baseUrl=canonicalVieNeuBase(baseUrl);config.providers[id]={name:id==='vieneu'?'VieNeu-TTS':String(b.name||o.name||p.name).trim(),kind:id==='vieneu'?'vieneu':String(b.kind||o.kind||p.kind).trim(),baseUrl,apiKey:b.clearApiKey?'':(b.apiKey?String(b.apiKey).trim():(o.apiKey||'')),voicesEndpoint:String(b.voicesEndpoint!==undefined?b.voicesEndpoint:(o.voicesEndpoint||'')).trim(),ttsEndpoint:String(b.ttsEndpoint!==undefined?b.ttsEndpoint:(o.ttsEndpoint||'')).trim(),voices:Array.isArray(o.voices)?o.voices:[],connected:p.builtin?true:Boolean(o.connected),lastTest:o.lastTest||null,lastWarning:o.lastWarning||'',updatedAt:new Date().toISOString()};save();return publicState();}
 function clearKey(id){if(!PROVIDERS[id])throw new Error('Unknown voice provider');const o=config.providers[id]||{};config.providers[id]={...o,apiKey:'',connected:PROVIDERS[id].builtin?true:false,lastTest:null,lastWarning:'',updatedAt:new Date().toISOString()};save();return publicState();}
 async function fetchText(url,opts={}){const r=await fetch(url,{...opts,signal:AbortSignal.timeout(15000)});const text=await r.text();if(!r.ok)throw new Error(`HTTP ${r.status}: ${text.slice(0,300)}`);return{text,headers:r.headers,status:r.status};}
 async function fetchJson(url,opts={}){const {text}=await fetchText(url,opts);try{return JSON.parse(text);}catch{throw new Error(`Response is not JSON: ${text.slice(0,180)}`);}}
 function vieneuHeaders(p){const h={Accept:'application/json'};if(p&&p.apiKey)h['X-Api-Key']=String(p.apiKey).trim();return h;}
 function authHeaders(p){if(!p.apiKey)return{};if(p.kind==='elevenlabs')return{'xi-api-key':p.apiKey};return{Authorization:`Bearer ${p.apiKey}`,'x-api-key':p.apiKey,'X-API-Key':p.apiKey};}
 function normalizeVoices(d){
   let arr=Array.isArray(d)?d:(d?.voices||d?.data||d?.items||d?.speakers||d?.results||[]);
   if(!Array.isArray(arr))return[];
   return arr.map(v=>{
     if(typeof v==='string')return{id:v,name:v};
     if(Array.isArray(v)){
       const name=String(v[0]??v[1]??'');const id=String(v[1]??v[0]??'');return{id,name};
     }
     return{id:String(v.id||v.voice_id||v.speaker_id||v.value||v.name||v.short_name||''),name:String(v.name||v.display_name||v.label||v.id||v.voice_id||v.speaker_id||''),language:v.language||v.locale||'',type:v.type||'',gender:v.gender||'',region:v.region||'',style:v.style||'',description:v.description||'',enabled:v.enabled!==false};
   }).filter(v=>v.id);
 }
 function alternateBases(base){
   const out=[norm(base)];
   try{
     const u=new URL(base);const host=u.hostname;const proto=u.protocol;
     if(u.port==='7860')out.push(`${proto}//${host}:8000`);
     if(u.port==='8000')out.push(`${proto}//${host}:7860`);
   }catch{}
   return unique(out);
 }
 async function discoverOpenApi(base,p){
   for(const ep of ['/openapi.json','/api/openapi.json']){
     try{const spec=await fetchJson(base+ep,{headers:authHeaders(p)});const paths=Object.keys(spec?.paths||{});return{spec,voicePaths:paths.filter(x=>/voice|speaker|clone/i.test(x)),ttsPaths:paths.filter(x=>/tts|synth|speech|generate|audio/i.test(x))};}catch{}
   }
   return{spec:null,voicePaths:[],ttsPaths:[]};
 }
 function extractGradioChoices(obj){
   const found=[];
   function walk(x){
     if(!x||typeof x!=='object')return;
     if(Array.isArray(x)){for(const y of x)walk(y);return;}
     const label=String(x.label||x.name||x.title||x.api_name||x.id||'');
     if(Array.isArray(x.choices)&&x.choices.length){
       const voices=normalizeVoices(x.choices);
       if(voices.length)found.push({label,voices});
     }
     if(x.props&&Array.isArray(x.props.choices)&&x.props.choices.length){
       const voices=normalizeVoices(x.props.choices);const l=String(x.props.label||x.props.name||label||'');
       if(voices.length)found.push({label:l,voices});
     }
     for(const v of Object.values(x))walk(v);
   }
   walk(obj);
   const preferred=found.find(x=>/voice|speaker|gi[oọ]ng|người đọc|reference/i.test(x.label));
   return preferred?.voices||found[0]?.voices||[];
 }
 async function discoverGradio(base,p){
   for(const ep of ['/config','/gradio_api/info','/info','/api/info']){
     try{const d=await fetchJson(base+ep,{headers:authHeaders(p)});const voices=extractGradioChoices(d);if(voices.length)return{voices,voicesEndpoint:ep,ttsEndpoint:'gradio'};}catch{}
   }
   return null;
 }
 async function probeRoot(base,p){try{const r=await fetch(base,{headers:authHeaders(p),signal:AbortSignal.timeout(8000)});return r.ok;}catch{return false;}}
 async function discoverVieNeu(p){
   const base=canonicalVieNeuBase(p.baseUrl||'http://192.168.1.154:8000');
   const headers=vieneuHeaders(p);
   // VieNeu-TTS REST API v2.0.0 contract:
   // GET /api/voices -> {count,preset_count,custom_count,voices:[...]}
   // POST /api/tts  -> JSON body {text,voice,filename?}
   const data=await fetchJson(`${base}/api/voices`,{headers});
   let voices=normalizeVoices(data).filter(v=>v.enabled!==false);
   // If /api/voices is ever configured to return only preset voices, merge custom voices too.
   try{
     const custom=await fetchJson(`${base}/api/custom-voices`,{headers});
     const extra=normalizeVoices(custom).filter(v=>v.enabled!==false);
     const seen=new Set(voices.map(v=>v.id));
     for(const v of extra){if(!seen.has(v.id)){voices.push(v);seen.add(v.id);}}
   }catch{}
   return{
     voices,
     voicesEndpoint:'/api/voices',
     ttsEndpoint:'/api/tts',
     detectedBaseUrl:base,
     presetCount:Number(data?.preset_count||voices.filter(v=>v.type==='preset').length||0),
     customCount:Number(data?.custom_count||voices.filter(v=>v.type==='custom').length||0),
   };
 }

 async function discoverCustomAtBase(base,p){
   const openapi=await discoverOpenApi(base,p);
   const candidates=[];
   if(p.voicesEndpoint)candidates.push(p.voicesEndpoint);
   candidates.push('/api/voices','/voices','/api/v1/voices','/v1/voices','/api/speakers','/speakers','/api/voice/list');
   candidates.push(...openapi.voicePaths);
   for(const ep of unique(candidates)){
     try{const d=await fetchJson(`${base}${ep.startsWith('/')?'':'/'}${ep}`,{headers:authHeaders(p)});const voices=normalizeVoices(d);if(voices.length)return{voices,voicesEndpoint:ep,ttsEndpoint:p.ttsEndpoint||openapi.ttsPaths[0]||'',detectedBaseUrl:base};}catch{}
   }
   const gradio=await discoverGradio(base,p);
   if(gradio)return{...gradio,detectedBaseUrl:base};
   if(await probeRoot(base,p))return{voices:[],voicesEndpoint:'',ttsEndpoint:p.ttsEndpoint||openapi.ttsPaths[0]||'',detectedBaseUrl:base,warning:'Kết nối server thành công nhưng chưa đọc được danh sách giọng tự động.'};
   return null;
 }
 async function discoverVoices(p){
   if(p.kind==='edge')return{voices:EDGE_VOICES,voicesEndpoint:'builtin',ttsEndpoint:'builtin',detectedBaseUrl:''};
   if(!p.baseUrl)throw new Error('API URL is required');
   if(p.kind==='vieneu')return await discoverVieNeu(p);
   if(p.kind==='openai-voice')return{voices:[{id:'alloy',name:'alloy'},{id:'echo',name:'echo'},{id:'fable',name:'fable'},{id:'onyx',name:'onyx'},{id:'nova',name:'nova'},{id:'shimmer',name:'shimmer'}],voicesEndpoint:'preset',ttsEndpoint:'/audio/speech',detectedBaseUrl:p.baseUrl};
   if(p.kind==='elevenlabs'){
     const d=await fetchJson(`${p.baseUrl}/voices`,{headers:authHeaders(p)});return{voices:normalizeVoices(d),voicesEndpoint:'/voices',ttsEndpoint:'/text-to-speech/{voice_id}',detectedBaseUrl:p.baseUrl};
   }
   let lastWarning='';
   for(const base of alternateBases(p.baseUrl)){
     const result=await discoverCustomAtBase(base,p);
     if(result){
       if(result.voices.length)return result;
       lastWarning=result.warning||lastWarning;
     }
   }
   if(lastWarning)return{voices:[],voicesEndpoint:'',ttsEndpoint:p.ttsEndpoint||'',detectedBaseUrl:p.baseUrl,warning:lastWarning};
   throw new Error('Không kết nối được Voice server hoặc server không cung cấp endpoint giọng có thể nhận diện.');
 }
 async function test(id){
   const p=get(id);const result=await discoverVoices(p);const old=config.providers[id]||{};
   const detectedBase=result.detectedBaseUrl||p.baseUrl;
   config.providers[id]={...old,name:p.name,kind:p.kind,baseUrl:detectedBase,apiKey:p.apiKey,voices:result.voices,voicesEndpoint:result.voicesEndpoint||old.voicesEndpoint||'',ttsEndpoint:result.ttsEndpoint||old.ttsEndpoint||'',connected:true,lastTest:new Date().toISOString(),lastWarning:result.warning||'',updatedAt:new Date().toISOString()};
   save();return{ok:true,provider:id,name:p.name,count:result.voices.length,voices:result.voices,warning:result.warning||'',voicesEndpoint:result.voicesEndpoint||'',ttsEndpoint:result.ttsEndpoint||'',detectedBaseUrl:detectedBase,presetCount:result.presetCount||0,customCount:result.customCount||0};
 }
 return{publicState,update,clearKey,test};
}
module.exports={createVoiceManager};
