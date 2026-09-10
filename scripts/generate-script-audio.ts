import * as fs from "fs";
import * as path from "path";
import {execFileSync} from "child_process";
import {generateSpeechToFile} from "./generate-tts";

const FPS=30;
type PronunciationItem={term:string;pronunciation:string};
function applyPronunciationDictionary(input:string){
  const f=path.resolve(process.cwd(),"data","pronunciation-dictionary.json");
  if(!fs.existsSync(f))return input;
  try{
    const d=JSON.parse(fs.readFileSync(f,"utf8"));
    const items:PronunciationItem[]=Array.isArray(d?.items)?d.items:[];
    let out=input;
    for(const x of [...items].sort((a,b)=>String(b.term||"").length-String(a.term||"").length)){
      const a=String(x.term||"").trim(),b=String(x.pronunciation||"").trim();
      if(a&&b)out=out.split(a).join(b);
    }
    return out;
  }catch{return input}
}

function audioSeconds(file:string){
  try{
    const out=execFileSync("ffprobe",[
      "-v","error",
      "-show_entries","format=duration",
      "-of","default=noprint_wrappers=1:nokey=1",
      file
    ],{encoding:"utf8"}).trim();
    const n=Number(out);
    return Number.isFinite(n)&&n>0?n:0;
  }catch{return 0}
}

function framesFor(sec:number,kind:string){
  const pad=kind==="intro"||kind==="outro"?0.55:0.38;
  return Math.max(
    Math.ceil((sec+pad)*FPS),
    Math.ceil((kind==="intro"||kind==="outro"?2.5:2.0)*FPS)
  );
}

function loadVieNeuConfig(){
  const configPath=path.resolve(process.cwd(),"data","voice-providers.json");
  if(!fs.existsSync(configPath))throw new Error("Không tìm thấy cấu hình Voice Providers");
  const d=JSON.parse(fs.readFileSync(configPath,"utf8"));
  const p=d?.providers?.vieneu||{};
  const baseUrl=String(p.baseUrl||"http://192.168.1.154:8000").replace(/\/+$/,"");
  const apiKey=String(p.apiKey||"").trim();
  if(!apiKey)throw new Error("VieNeu-TTS chưa có API Key");
  return {baseUrl,apiKey};
}

function findStringDeep(obj:any, keys:string[]):string{
  if(!obj||typeof obj!=="object")return "";
  for(const k of keys){
    const v=obj[k];
    if(typeof v==="string"&&v.trim())return v.trim();
  }
  for(const v of Object.values(obj)){
    if(v&&typeof v==="object"){
      const found=findStringDeep(v,keys);
      if(found)return found;
    }
  }
  return "";
}

async function downloadToFile(url:string, apiKey:string, out:string){
  const r=await fetch(url,{headers:{"X-Api-Key":apiKey}});
  if(!r.ok)throw new Error(`Không tải được audio VieNeu: HTTP ${r.status}`);
  const b=Buffer.from(await r.arrayBuffer());
  if(!b.length)throw new Error("VieNeu trả về file audio rỗng");
  fs.writeFileSync(out,b);
}

async function generateVieNeuToFile(text:string, voice:string, out:string){
  const {baseUrl,apiKey}=loadVieNeuConfig();
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const filename=path.basename(out);

  const r=await fetch(`${baseUrl}/api/tts`,{
    method:"POST",
    headers:{
      "Accept":"application/json, audio/*, application/octet-stream",
      "Content-Type":"application/json",
      "X-Api-Key":apiKey
    },
    body:JSON.stringify({text,voice,filename})
  });

  if(!r.ok){
    const msg=await r.text().catch(()=> "");
    throw new Error(`VieNeu TTS HTTP ${r.status}: ${msg.slice(0,500)}`);
  }

  const ct=String(r.headers.get("content-type")||"").toLowerCase();

  if(ct.startsWith("audio/")||ct.includes("application/octet-stream")){
    const b=Buffer.from(await r.arrayBuffer());
    if(!b.length)throw new Error("VieNeu trả về audio rỗng");
    fs.writeFileSync(out,b);
    return;
  }

  const raw=await r.text();
  let data:any;
  try{data=JSON.parse(raw)}catch{
    throw new Error(`VieNeu /api/tts không trả JSON/audio hợp lệ: ${raw.slice(0,300)}`);
  }

  const b64=findStringDeep(data,["audio_base64","base64","audioData","audio_data"]);
  if(b64){
    const clean=b64.includes(",")?b64.split(",").pop()||"":b64;
    const buf=Buffer.from(clean,"base64");
    if(buf.length>100){
      fs.writeFileSync(out,buf);
      return;
    }
  }

  const ref=findStringDeep(data,[
    "audio_url","audioUrl","download_url","downloadUrl","file_url","fileUrl",
    "url","audio_path","audioPath","file_path","filePath","path","filename"
  ]);

  if(ref){
    const candidates:string[]=[];
    if(/^https?:\/\//i.test(ref)){
      candidates.push(ref);
    }else{
      const rel=ref.replace(/^\/+/,"");
      candidates.push(`${baseUrl}/${rel}`);
      if(path.basename(ref)){
        const f=encodeURIComponent(path.basename(ref));
        candidates.push(
          `${baseUrl}/audio/${f}`,
          `${baseUrl}/outputs/${f}`,
          `${baseUrl}/output/${f}`,
          `${baseUrl}/api/audio/${f}`,
          `${baseUrl}/api/tts/audio/${f}`
        );
      }
    }

    for(const u of [...new Set(candidates)]){
      try{
        await downloadToFile(u,apiKey,out);
        return;
      }catch{}
    }
  }

  throw new Error(
    "VieNeu đã tạo TTS nhưng Explainer Studio chưa lấy được file audio từ response. " +
    `Response: ${JSON.stringify(data).slice(0,500)}`
  );
}

function normalizeSceneAudio(file:string){
  try{
    const ext=path.extname(file).toLowerCase();
    const tmp=file+".normalized"+ext;
    const codec=ext===".mp3"?["-c:a","libmp3lame","-q:a","3"]:["-c:a","pcm_s16le"];
    execFileSync("ffmpeg",[
      "-y","-hide_banner","-loglevel","error","-i",file,
      "-af","silenceremove=start_periods=1:start_duration=0.02:start_threshold=-48dB:stop_periods=1:stop_duration=0.08:stop_threshold=-48dB,apad=pad_dur=0.30",
      ...codec,tmp
    ],{stdio:"ignore"});
    if(fs.existsSync(tmp)&&fs.statSync(tmp).size>0)fs.renameSync(tmp,file);
  }catch{}
}

function loadCustomTemplate(templateId:string){
  if(!templateId.startsWith("custom:"))return null;
  const id=templateId.slice(7).replace(/[^a-zA-Z0-9._-]+/g,"-");
  const f=path.resolve("/opt/explainer-studio-data/custom-templates",id+".json");
  if(!fs.existsSync(f))return null;
  try{return JSON.parse(fs.readFileSync(f,"utf8"))}catch{return null}
}

async function main(){
  const scriptPath=process.argv[2],projectId=process.argv[3];
  if(!scriptPath||!projectId)throw new Error(
    "Usage: generate-script-audio.ts <script.json> <projectId>"
  );

  const script=JSON.parse(fs.readFileSync(scriptPath,"utf8"));
  const provider=String(script.voice?.provider||"edge");

  if(!["edge","vieneu"].includes(provider)){
    throw new Error(
      `Render tự động hiện hỗ trợ Edge TTS và VieNeu-TTS. Voice provider: ${provider}`
    );
  }

  const voice=String(
    script.voice?.voiceId||
    (provider==="edge"?"vi-VN-NamMinhNeural":"Mai Anh")
  );

  const channel=script.channel||{};
  const dir=path.resolve(process.cwd(),"public","generated",projectId);
  fs.mkdirSync(dir,{recursive:true});
  const scenes:any[]=[];

  const pushScene=async(s:any,index:number)=>{
    const ext=provider==="vieneu"?"wav":"mp3";
    const file=`scene-${index+1}.${ext}`;
    const abs=path.join(dir,file);
    const text=String(s.voiceover||s.body||s.headline||"").trim();
    const ttsText=applyPronunciationDictionary(text);

    if(text){
      if(provider==="vieneu"){
        await generateVieNeuToFile(ttsText,voice,abs);
      }else{
        await generateSpeechToFile(ttsText,abs,{voice});
      }
    }

    if(text)normalizeSceneAudio(abs);
    const sec=text?audioSeconds(abs):0;
    if(text&&sec<=0)throw new Error(`Không đo được thời lượng audio scene ${index+1}`);

    scenes.push({
      ...s,
      audioPath:text?`generated/${projectId}/${file}`:"",
      audioDuration:sec,
      durationInFrames:framesFor(sec,String(s.type||"content"))
    });
  };

  let idx=0;

  if(channel.introEnabled){
    const name=channel.channelName||"Explainer Studio";
    await pushScene({
      type:"intro",
      headline:channel.introTitle||name,
      body:channel.introSubtitle||script.title||script.topic||"",
      voiceover:channel.introVoiceover||`Bạn đang xem ${name}. Cùng bắt đầu nhé.`,
      keywords:[]
    },idx++);
  }

  for(const s of script.scenes||[])await pushScene(s,idx++);

  if(channel.outroEnabled){
    const links=[
      channel.facebook ? `Facebook : ${channel.facebook}` : "",
      channel.tiktok ? `TikTok : ${channel.tiktok}` : "",
      channel.youtube ? `YouTube : ${channel.youtube}` : "",
      channel.website ? `Website : ${channel.website}` : ""
    ].filter(Boolean);
    await pushScene({
      type:"outro",
      headline:channel.outroTitle||"Cảm ơn bạn đã theo dõi",
      body:channel.cta||"Theo dõi kênh để xem thêm video mới!",
      voiceover:channel.outroVoiceover||channel.cta||"Theo dõi kênh để xem thêm video mới!",
      keywords:[],
      links
    },idx++);
  }

  const totalFrames=scenes.reduce((n,s)=>n+Number(s.durationInFrames||0),0);
  const props={
    title:script.title||script.topic||"Explainer Studio",template:String(script.template||"classic-docker"),
    templateConfig:loadCustomTemplate(String(script.template||"")),
    channel,
    scenes
  };
  const propsPath=path.resolve(process.cwd(),"data","render-props",`${projectId}.json`);

  fs.mkdirSync(path.dirname(propsPath),{recursive:true});
  fs.writeFileSync(propsPath,JSON.stringify(props,null,2),"utf8");

  process.stdout.write(JSON.stringify({
    propsPath,
    totalFrames,
    seconds:Number((totalFrames/FPS).toFixed(2)),
    voiceProvider:provider,
    voiceId:voice
  }));
}

main().catch(e=>{
  console.error(e?.stack||e);
  process.exit(1);
});
