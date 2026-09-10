const express = require("express");
const cors = require("cors");
const {exec, spawn} = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const {createManager} = require("./ai-providers");
const {createVoiceManager} = require("./voice-providers");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 8081);
const PROJECT_DIR = process.env.PROJECT_DIR || "/opt/explainer-studio";
const OUTPUT_DIR = path.join(PROJECT_DIR, "output");
const DATA_DIR = path.join(PROJECT_DIR, "data");
const JOB_FILE = path.join(DATA_DIR, "render-jobs.json");
const COMP_FILE = path.join(DATA_DIR, "compositions-cache.json");
const LOG_DIR = path.join(PROJECT_DIR, "logs");
const SCRIPT_DIR = path.join(DATA_DIR, "scripts");
const CHANNEL_FILE = path.join(DATA_DIR, "channel-settings.json");
for (const dir of [OUTPUT_DIR, DATA_DIR, LOG_DIR, SCRIPT_DIR]) fs.mkdirSync(dir, {recursive: true});
const aiManager = createManager(DATA_DIR);
const voiceManager = createVoiceManager(DATA_DIR);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), {recursive:true});
  const tmp=filePath+".tmp";fs.writeFileSync(tmp,JSON.stringify(data,null,2),"utf8");fs.renameSync(tmp,filePath);
}
const DEFAULT_CHANNEL={channelName:"",facebook:"",youtube:"",tiktok:"",website:"",cta:"Theo dõi kênh để xem thêm video mới!",introEnabled:true,introTitle:"Explainer Studio",introSubtitle:"",introVoiceover:"",outroEnabled:true,outroTitle:"Cảm ơn bạn đã theo dõi",outroVoiceover:""};
function getChannelSettings(){return {...DEFAULT_CHANNEL,...readJson(CHANNEL_FILE,{})};}

let jobs = readJson(JOB_FILE, []);
for (const job of jobs) {
  if (job.status === "rendering") {
    job.status = "failed";
    job.error = "Backend restarted during render";
    job.finishedAt = new Date().toISOString();
  }
}
const saveJobs = () => fs.writeFileSync(JOB_FILE, JSON.stringify(jobs.slice(-100), null, 2));
saveJobs();

let activeJobId = null;
let compPersisted = readJson(COMP_FILE, {at: 0, data: []});
let compositionsCache = {
  at: Number(compPersisted.at || 0),
  data: Array.isArray(compPersisted.data) ? compPersisted.data : [],
};
let compositionsLoading = false;
let compositionWaiters = [];

function saveCompositions() {
  fs.writeFileSync(COMP_FILE, JSON.stringify(compositionsCache, null, 2));
}

function parseCompositions(stdout) {
  const out = [];
  for (const line of stdout.split("\n")) {
    const m = line.match(/^(\S+)\s+(\d+)\s+(\d+)x(\d+)\s+(\d+)\s+\(([\d.]+)\s+sec\)/);
    if (m) out.push({id:m[1], fps:+m[2], width:+m[3], height:+m[4], frames:+m[5], duration:+m[6]});
  }
  return out;
}

function refreshCompositions(done) {
  if (compositionsLoading) {
    compositionWaiters.push(done);
    return;
  }
  compositionsLoading = true;
  compositionWaiters.push(done);
  exec("npx remotion compositions --timeout=120000", {cwd: PROJECT_DIR, timeout: 150000}, (error, stdout, stderr) => {
    let err = null;
    if (error) err = new Error(stderr || error.message);
    else {
      const data = parseCompositions(stdout);
      if (!data.length) err = new Error("No compositions found");
      else {
        compositionsCache = {at: Date.now(), data};
        saveCompositions();
      }
    }
    compositionsLoading = false;
    const waiters = compositionWaiters.splice(0);
    for (const cb of waiters) cb(err, compositionsCache.data);
  });
}

function getCompositions(cb, {force = false} = {}) {
  const hasCache = compositionsCache.data.length > 0;
  const fresh = Date.now() - compositionsCache.at < 30 * 60 * 1000;

  // While rendering, never start another Headless Chrome just to list compositions.
  // Return persisted cache immediately so F5 stays responsive.
  if (activeJobId && hasCache) return cb(null, compositionsCache.data, "cache-rendering");
  if (!force && hasCache && fresh) return cb(null, compositionsCache.data, "cache");

  refreshCompositions((err, data) => {
    if (err && hasCache) return cb(null, compositionsCache.data, "stale-cache");
    cb(err, data, "fresh");
  });
}

function stripAnsi(text) {
  return text
    .replace(/\x1B\[[0-?]*[ -\/]*[@-~]/g, "")
    .replace(/\r/g, "\n");
}

function updateProgressFromText(job, rawText, state) {
  state.buffer = (state.buffer + stripAnsi(rawText)).slice(-12000);

  const patterns = [
    /(?:Rendering|Rendered)\s+frames?\s*[: ]\s*(\d+)\s*\/\s*(\d+)/gi,
    /(?:Rendering|Rendered)\s*[: ]\s*(\d+)\s*\/\s*(\d+)/gi,
    /(?:frame|frames)\s+(\d+)\s*\/\s*(\d+)/gi,
  ];

  let best = null;
  for (const re of patterns) {
    for (const match of state.buffer.matchAll(re)) {
      const current = Number(match[1]);
      const total = Number(match[2]);
      if (Number.isFinite(current) && Number.isFinite(total) && total > 0 && current <= total) {
        if (!best || current >= best.current) best = {current, total};
      }
    }
  }

  if (!best) {
    // Fallback: Remotion occasionally inserts cursor control sequences between label and numbers.
    const allRatios = [...state.buffer.matchAll(/\b(\d{1,6})\s*\/\s*(\d{2,7})\b/g)];
    for (const match of allRatios) {
      const current = Number(match[1]);
      const total = Number(match[2]);
      if (total === job.totalFrames && current <= total) best = {current, total};
    }
  }

  if (best && best.current >= (job.currentFrame || 0)) {
    job.currentFrame = best.current;
    job.totalFrames = best.total;
    job.progress = Math.min(99, Math.max(0, Math.floor((best.current / best.total) * 100)));
    job.updatedAt = new Date().toISOString();
    saveJobs();
  }
}

function runNext() {
  if (activeJobId) return;
  const job = jobs.find(j => j.status === "queued");
  if (!job) return;

  activeJobId = job.id;
  job.status = "rendering";
  job.startedAt = new Date().toISOString();
  job.updatedAt = job.startedAt;
  job.progress = 0;
  job.currentFrame = 0;
  saveJobs();

  const outputPath = path.join(OUTPUT_DIR, job.filename);
  const logPath = path.join(LOG_DIR, `render-${job.id}.log`);
  const log = fs.createWriteStream(logPath, {flags:"a"});
  const renderArgs=["remotion", "render", job.composition, outputPath, "--timeout=120000"];
  if(job.propsPath) renderArgs.push(`--props=${job.propsPath}`);
  const child = spawn(
    "npx",
    renderArgs,
    {cwd: PROJECT_DIR, shell:false, env:{...process.env, FORCE_COLOR:"0", NO_COLOR:"1"}}
  );

  job.pid = child.pid;
  saveJobs();
  const progressState = {buffer: ""};

  const onData = (buf) => {
    const text = buf.toString();
    log.write(text);
    updateProgressFromText(job, text, progressState);
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  child.on("close", code => {
    log.end();
    job.finishedAt = new Date().toISOString();
    job.updatedAt = job.finishedAt;
    delete job.pid;
    if (code === 0 && fs.existsSync(outputPath)) {
      job.status = "completed";
      job.progress = 100;
      job.currentFrame = job.totalFrames;
      job.url = `/output/${job.filename}`;
      job.size = fs.statSync(outputPath).size;
    } else {
      job.status = "failed";
      job.error = `Render exited with code ${code}`;
    }
    activeJobId = null;
    saveJobs();
    setTimeout(runNext, 250);
  });
}

app.get("/api/health", (req,res) => res.json({
  status:"ok",
  service:"Explainer Studio Backend",
  activeJobId,
  queue:jobs.filter(j=>j.status==="queued").length,
  compositionsCached:compositionsCache.data.length,
}));

app.get("/api/compositions", (req,res) => getCompositions((err,data,source) => {
  if (err) return res.status(500).json({success:false,error:err.message});
  res.json({success:true,compositions:data,source,cacheAt:compositionsCache.at});
}));

app.post("/api/compositions/refresh", (req,res) => getCompositions((err,data,source) => {
  if (err) return res.status(500).json({success:false,error:err.message});
  res.json({success:true,compositions:data,source});
}, {force:true}));

app.get("/api/channel-settings",(req,res)=>res.json({success:true,settings:getChannelSettings()}));
app.put("/api/channel-settings",(req,res)=>{try{const old=getChannelSettings(),b=req.body||{},next={...old};for(const k of ["channelName","facebook","youtube","tiktok","website","cta","introTitle","introSubtitle","introVoiceover","outroTitle","outroVoiceover"])if(b[k]!==undefined)next[k]=String(b[k]||"").trim();if(b.introEnabled!==undefined)next.introEnabled=Boolean(b.introEnabled);if(b.outroEnabled!==undefined)next.outroEnabled=Boolean(b.outroEnabled);writeJson(CHANNEL_FILE,next);res.json({success:true,settings:next,message:"Đã lưu thông tin kênh"});}catch(e){res.status(400).json({success:false,error:e.message});}});

app.get("/api/ai/providers", (req,res) => {
  res.json({success:true, ...aiManager.publicState()});
});

app.put("/api/ai/providers/:id", (req,res) => {
  try {
    const state = aiManager.updateProvider(req.params.id, req.body || {});
    res.json({success:true, ...state, message:"Đã lưu cấu hình AI"});
  } catch (e) {
    res.status(400).json({success:false,error:e.message});
  }
});

app.delete("/api/ai/providers/:id", (req,res) => {
  try {
    const state = aiManager.deleteProvider(req.params.id);
    res.json({success:true, ...state});
  } catch (e) {
    res.status(400).json({success:false,error:e.message});
  }
});

app.post("/api/ai/providers/:id/test", async (req,res) => {
  try {
    const result = await aiManager.test(req.params.id);
    res.json({success:true,result, ...aiManager.publicState()});
  } catch (e) {
    res.status(400).json({success:false,error:e.message});
  }
});

app.delete("/api/ai/providers/:id/key", (req,res) => {
  try {
    const state = aiManager.clearKey(req.params.id);
    res.json({success:true, ...state, message:"Đã xóa API Key"});
  } catch (e) {
    res.status(400).json({success:false,error:e.message});
  }
});

app.get("/api/voice/providers", (req,res) => {
  res.json({success:true, ...voiceManager.publicState()});
});

app.put("/api/voice/providers/:id", (req,res) => {
  try {
    const state = voiceManager.update(req.params.id, req.body || {});
    res.json({success:true, ...state, message:"Đã lưu cấu hình Voice"});
  } catch (e) {
    res.status(400).json({success:false,error:e.message});
  }
});

app.post("/api/voice/providers/:id/test", async (req,res) => {
  try {
    const result = await voiceManager.test(req.params.id);
    res.json({success:true,result, ...voiceManager.publicState()});
  } catch (e) {
    res.status(400).json({success:false,error:e.message});
  }
});

app.delete("/api/voice/providers/:id/key", (req,res) => {
  try {
    const state = voiceManager.clearKey(req.params.id);
    res.json({success:true, ...state, message:"Đã xóa API Key"});
  } catch (e) {
    res.status(400).json({success:false,error:e.message});
  }
});

app.post("/api/scripts/generate", async (req,res) => {
  try {
    const result = await aiManager.generate({...req.body,channelSettings:getChannelSettings()});
    res.json({success:true,...result});
  } catch (e) {
    res.status(400).json({success:false,error:e.message});
  }
});

app.put("/api/scripts/:file", (req,res) => {
  try {
    const file = String(req.params.file || "");
    if (!/^[A-Za-z0-9._-]+\.json$/.test(file) || path.basename(file) !== file) {
      return res.status(400).json({success:false,error:"Invalid script file"});
    }
    const target = path.join(SCRIPT_DIR, file);
    if (!fs.existsSync(target)) return res.status(404).json({success:false,error:"Script not found"});
    const script = req.body?.script;
    if (!script || !Array.isArray(script.scenes) || script.scenes.length < 4 || script.scenes.length > 12) {
      return res.status(400).json({success:false,error:"Kịch bản phải có từ 4 đến 12 scene"});
    }
    const finalize = Boolean(req.body?.finalize);
    script.status = finalize ? "ready" : "draft";
    script.updatedAt = new Date().toISOString();
    if (finalize) script.finalizedAt = script.updatedAt; else delete script.finalizedAt;
    fs.writeFileSync(target, JSON.stringify(script, null, 2));
    res.json({success:true,script,message:finalize?"Đã lưu và chốt kịch bản":"Đã lưu bản nháp"});
  } catch (e) {
    res.status(400).json({success:false,error:e.message});
  }
});

async function prepareScriptRender(job, scriptPath){
  try{
    job.status="preparing";job.updatedAt=new Date().toISOString();saveJobs();
    const projectId=`script-${job.id}`;
    const child=spawn("npx",["tsx","scripts/generate-script-audio.ts",scriptPath,projectId],{cwd:PROJECT_DIR,shell:false,env:{...process.env,FORCE_COLOR:"0",NO_COLOR:"1"}});
    let out="",err="";
    child.stdout.on("data",b=>out+=b.toString());
    child.stderr.on("data",b=>err+=b.toString());
    const code=await new Promise(resolve=>child.on("close",resolve));
    if(code!==0)throw new Error(err||`Audio preparation exited with code ${code}`);
    const last=out.trim().split(/\n/).filter(Boolean).pop()||"{}";
    const d=JSON.parse(last);
    if(!d.propsPath)throw new Error("Không tạo được render props");
    job.propsPath=d.propsPath;job.composition="ScriptExplainer";job.totalFrames=Number(d.totalFrames||1800);job.currentFrame=0;job.progress=0;job.status="queued";job.updatedAt=new Date().toISOString();saveJobs();runNext();
  }catch(e){job.status="failed";job.error=String(e?.message||e);job.finishedAt=new Date().toISOString();job.updatedAt=job.finishedAt;saveJobs();}
}

app.post("/api/scripts/:file/render", (req,res) => {
  try{
    const file=path.basename(req.params.file||"");
    if(!file.endsWith(".json"))return res.status(400).json({success:false,error:"Invalid script file"});
    const scriptPath=path.join(SCRIPT_DIR,file);
    if(!fs.existsSync(scriptPath))return res.status(404).json({success:false,error:"Script not found"});
    const script=readJson(scriptPath,null);
    if(!script)return res.status(400).json({success:false,error:"Script JSON không hợp lệ"});
    if(script.status!=="ready")return res.status(400).json({success:false,error:"Hãy Lưu / Chốt kịch bản trước khi Render"});
    const requestedVoice=(req.body&&req.body.voice&&typeof req.body.voice==="object")?req.body.voice:{};
    const activeVoice={provider:String(requestedVoice.provider||script.voice?.provider||"edge"),voiceId:String(requestedVoice.voiceId||script.voice?.voiceId||"")};
    if(!["edge","vieneu"].includes(activeVoice.provider))return res.status(400).json({success:false,error:"Render tự động hiện hỗ trợ Edge TTS và VieNeu-TTS."});
    script.voice=activeVoice;script.channel=getChannelSettings();writeJson(scriptPath,script);
    const id=crypto.randomBytes(6).toString("hex");
    const safe=(script.topic||script.title||"explainer").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,45)||"explainer";
    const job={id,composition:"ScriptExplainer",filename:`${safe}-${Date.now()}.mp4`,status:"preparing",progress:0,currentFrame:0,totalFrames:1800,createdAt:new Date().toISOString(),scriptFile:file};
    jobs.push(job);saveJobs();prepareScriptRender(job,scriptPath);
    res.status(202).json({success:true,job,message:"Đang tạo voice và chuẩn bị render"});
  }catch(e){res.status(500).json({success:false,error:e.message});}
});

app.get("/api/jobs", (req,res) => res.json({success:true,jobs:[...jobs].reverse()}));
app.get("/api/jobs/:id", (req,res) => {
  const j=jobs.find(x=>x.id===req.params.id);
  if(!j) return res.status(404).json({success:false,error:"Job not found"});
  res.json({success:true,job:j});
});

app.post("/api/render", (req,res) => {
  const composition=String(req.body.composition||"");
  if(!/^[A-Za-z0-9_-]+$/.test(composition)) return res.status(400).json({success:false,error:"Invalid composition name"});
  getCompositions((err, comps) => {
    if(err) return res.status(500).json({success:false,error:err.message});
    const comp=comps.find(c=>c.id===composition);
    if(!comp) return res.status(404).json({success:false,error:"Composition not found"});
    const id=crypto.randomBytes(6).toString("hex");
    const job={
      id,
      composition,
      filename:`${composition}-${Date.now()}.mp4`,
      status:"queued",
      progress:0,
      currentFrame:0,
      totalFrames:comp.frames,
      createdAt:new Date().toISOString(),
    };
    jobs.push(job);
    saveJobs();
    runNext();
    res.status(202).json({success:true,job});
  });
});

app.use("/output", express.static(OUTPUT_DIR));
app.listen(PORT,"0.0.0.0",()=>{
  console.log(`Explainer Studio Backend running on port ${PORT}`);
  // Warm the cache only when there is no persisted composition list.
  if (!compositionsCache.data.length) getCompositions(() => {});
  runNext();
});

// Alpha13 project management
const a13fs=require("fs"),a13path=require("path");
const a13meta=a13path.join(process.cwd(),"data","project-meta.json");
function a13read(){try{return JSON.parse(a13fs.readFileSync(a13meta,"utf8"))}catch{return {}}}
function a13write(v){a13fs.mkdirSync(a13path.dirname(a13meta),{recursive:true});a13fs.writeFileSync(a13meta,JSON.stringify(v,null,2))}
app.get("/api/projects/meta",(req,res)=>res.json({success:true,projects:a13read()}));
app.post("/api/projects/:id/rename",(req,res)=>{
 const id=String(req.params.id||""),name=String(req.body?.name||"").trim();
 if(!id||!name)return res.status(400).json({success:false,error:"Thiếu tên dự án"});
 const m=a13read();m[id]={...(m[id]||{}),name,updatedAt:new Date().toISOString()};a13write(m);
 res.json({success:true,name});
});
app.delete("/api/projects/:id",(req,res)=>{
 const id=String(req.params.id||""),safe=id.replace(/[^a-zA-Z0-9._-]/g,"");
 if(!safe)return res.status(400).json({success:false,error:"Project ID không hợp lệ"});
 for(const t of [a13path.join(process.cwd(),"public","generated",safe),a13path.join(process.cwd(),"data","render-props",safe+".json")]){
   try{a13fs.rmSync(t,{recursive:true,force:true})}catch{}
 }
 const m=a13read();delete m[id];a13write(m);res.json({success:true});
});

// ===== Alpha13B Project Manager =====
const a13bFs = require("fs");
const a13bPath = require("path");
const a13bMetaFile = a13bPath.join(process.cwd(), "data", "project-meta-alpha13b.json");
function a13bReadMeta(){try{return JSON.parse(a13bFs.readFileSync(a13bMetaFile,"utf8"))}catch{return {}}}
function a13bWriteMeta(v){a13bFs.mkdirSync(a13bPath.dirname(a13bMetaFile),{recursive:true});a13bFs.writeFileSync(a13bMetaFile,JSON.stringify(v,null,2),"utf8")}
function a13bSafeBase(v){return a13bPath.basename(String(v||"")).replace(/[^a-zA-Z0-9._-]/g,"")}
function a13bFindFileRecursive(dir,basename){
 if(!a13bFs.existsSync(dir))return "";
 const stack=[dir];
 while(stack.length){
  const d=stack.pop();let entries=[];
  try{entries=a13bFs.readdirSync(d,{withFileTypes:true})}catch{continue}
  for(const e of entries){
   const f=a13bPath.join(d,e.name);
   if(e.isDirectory())stack.push(f);
   else if(e.isFile()&&e.name===basename)return f;
  }
 }
 return "";
}
app.get("/api/a13b/projects",(req,res)=>res.json({success:true,projects:a13bReadMeta()}));
app.post("/api/a13b/projects/:id/link",(req,res)=>{
 const id=String(req.params.id||"");
 if(!id)return res.status(400).json({success:false,error:"Missing project ID"});
 const m=a13bReadMeta();
 m[id]={...(m[id]||{}),scriptFile:String(req.body?.scriptFile||m[id]?.scriptFile||""),name:String(req.body?.title||m[id]?.name||"").trim(),updatedAt:new Date().toISOString()};
 a13bWriteMeta(m);res.json({success:true,project:m[id]});
});
app.post("/api/a13b/projects/:id/rename",(req,res)=>{
 const id=String(req.params.id||""),name=String(req.body?.name||"").trim();
 if(!id||!name)return res.status(400).json({success:false,error:"Missing project name"});
 const m=a13bReadMeta();m[id]={...(m[id]||{}),name,updatedAt:new Date().toISOString()};a13bWriteMeta(m);res.json({success:true,name});
});
app.delete("/api/a13b/projects/:id",(req,res)=>{
 const id=String(req.params.id||""),safe=a13bSafeBase(id);
 if(!safe)return res.status(400).json({success:false,error:"Invalid project ID"});
 const url=String(req.body?.url||"");const outName=a13bSafeBase(url.split("/").pop()||"");
 const targets=[a13bPath.join(process.cwd(),"public","generated",safe),a13bPath.join(process.cwd(),"data","render-props",safe+".json")];
 if(outName)targets.push(a13bPath.join(process.cwd(),"output",outName));
 for(const t of targets){try{a13bFs.rmSync(t,{recursive:true,force:true})}catch{}}
 const m=a13bReadMeta();m[id]={...(m[id]||{}),deleted:true,deletedAt:new Date().toISOString()};a13bWriteMeta(m);
 res.json({success:true});
});
app.get("/api/a13b/scripts/:file",(req,res)=>{
 const file=a13bSafeBase(req.params.file);
 if(!file)return res.status(400).json({success:false,error:"Invalid script name"});
 const found=a13bFindFileRecursive(a13bPath.join(process.cwd(),"data"),file);
 if(!found)return res.status(404).json({success:false,error:"Script not found"});
 try{const script=JSON.parse(a13bFs.readFileSync(found,"utf8"));res.json({success:true,script,file})}
 catch(e){res.status(500).json({success:false,error:"Cannot read script: "+e.message})}
});
// ===== End Alpha13B Project Manager =====

// Alpha14.4 pronunciation dictionary
const a144DictFile=require("path").join(process.cwd(),"data","pronunciation-dictionary.json");
function a144Read(){try{const d=JSON.parse(require("fs").readFileSync(a144DictFile,"utf8"));return {items:Array.isArray(d.items)?d.items:[]}}catch{return {items:[]}}}
function a144Write(d){require("fs").writeFileSync(a144DictFile,JSON.stringify(d,null,2),"utf8")}
app.get("/api/pronunciation",(req,res)=>res.json({success:true,...a144Read()}));
app.post("/api/pronunciation",(req,res)=>{const term=String(req.body?.term||"").trim(),pronunciation=String(req.body?.pronunciation||"").trim();if(!term||!pronunciation)return res.status(400).json({success:false,error:"Thiếu dữ liệu"});const d=a144Read(),i=d.items.findIndex(x=>String(x.term).toLowerCase()===term.toLowerCase()),item={term,pronunciation};if(i>=0)d.items[i]=item;else d.items.push(item);d.items.sort((a,b)=>String(b.term).length-String(a.term).length);a144Write(d);res.json({success:true,items:d.items})});
app.delete("/api/pronunciation/:term",(req,res)=>{const t=String(req.params.term||"").toLowerCase(),d=a144Read();d.items=d.items.filter(x=>String(x.term).toLowerCase()!==t);a144Write(d);res.json({success:true,items:d.items})});
