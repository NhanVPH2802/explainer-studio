import React from "react";
import { z } from "zod";
import {AbsoluteFill,Audio,Series,interpolate,spring,staticFile,useCurrentFrame,useVideoConfig} from "remotion";
import {AlertIcon,ArrowDownIcon,BoltIcon,CloudIcon,DiskIcon,FileIcon,GearIcon,LaptopIcon,PackageIcon,RocketIcon,TrophyIcon} from "../DockerExplainer/components/Icons";

export const scriptExplainerSchema=z.object({
 title:z.string(),template:z.string().optional(),templateConfig:z.object({backgroundUrl:z.string().optional(),fontUrl:z.string().optional(),fontFamily:z.string().optional(),accent:z.string().optional(),backgroundFit:z.string().optional()}).optional(),
 channel:z.object({channelName:z.string().optional(),facebook:z.string().optional(),youtube:z.string().optional(),tiktok:z.string().optional(),website:z.string().optional()}).optional(),
 scenes:z.array(z.object({type:z.string(),headline:z.string(),body:z.string(),voiceover:z.string().optional(),keywords:z.array(z.string()).optional(),audioPath:z.string().optional(),durationInFrames:z.number().optional(),links:z.array(z.string()).optional()})).min(1),
});
export type ScriptExplainerProps=z.infer<typeof scriptExplainerSchema>;
type DynamicScene=ScriptExplainerProps["scenes"][number];
type DynamicChannel=NonNullable<ScriptExplainerProps["channel"]>;
const audioSrc=(p?:string)=>!p?null:/^https?:\/\//i.test(p)?p:staticFile(p.replace(/^\/+/,""));
const sceneLabel=(t:string,i:number)=>({intro:"GIỚI THIỆU",hook:"MÓC CÂU",problem:"VẤN ĐỀ",solution:"GIẢI PHÁP",workflow:"QUY TRÌNH",example:"VÍ DỤ",benefits:"LỢI ÍCH",summary:"TỔNG KẾT",outro:"KẾT THÚC"}[t]||`PHẦN ${i+1}`);const headlinePx=(v:string,base=58)=>{const n=String(v||"").length;return n>55?44:n>38?50:base};

const Shell:React.FC<{children:React.ReactNode;badge:string;tone?:"sky"|"red"|"emerald"|"purple"}>=({children,badge,tone="sky"})=>{
 const frame=useCurrentFrame();const {fps}=useVideoConfig();const sc=spring({frame,fps,config:{damping:12,stiffness:100}});
 const cls=tone==="red"?"border-red-500/50 bg-red-500/15 text-red-300":tone==="emerald"?"border-emerald-400/50 bg-emerald-500/15 text-emerald-300":tone==="purple"?"border-purple-400/50 bg-purple-500/15 text-purple-300":"border-sky-400/50 bg-sky-500/15 text-sky-300";
 return <AbsoluteFill className="flex flex-col items-center justify-center px-10 text-white"><div style={{transform:`scale(${sc})`}} className={`flex items-center gap-3 rounded-full border-2 px-8 py-3.5 backdrop-blur-md ${cls}`}><span className="text-3xl font-black tracking-wider uppercase">{badge}</span></div>{children}</AbsoluteFill>;
};

const HookScene:React.FC<{scene:DynamicScene;index:number}>=({scene,index})=>{const frame=useCurrentFrame();const {fps}=useVideoConfig();const y=spring({frame:frame-6,fps,from:60,to:0,config:{damping:14,stiffness:90}});const op=interpolate(frame,[6,20],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});const is=spring({frame:frame-15,fps,config:{damping:10,stiffness:80}});const fl=Math.sin(frame/12)*15;return <Shell badge={sceneLabel(scene.type,index)}><div className="mt-10 flex flex-col items-center gap-7"><div style={{transform:`scale(${is}) translateY(${fl}px)`}} className="relative flex h-52 w-52 items-center justify-center rounded-3xl border-2 border-sky-400/40 bg-gradient-to-br from-sky-500/25 via-blue-600/15 to-transparent p-6 shadow-[0_0_90px_rgba(56,189,248,0.45)] backdrop-blur-xl"><RocketIcon size={112}/></div><div style={{transform:`translateY(${y}px)`,opacity:op}} className="max-w-[900px] text-center"><h1 style={{fontSize:headlinePx(scene.headline,58)}} className="font-black tracking-tight leading-[1.08]"><span className="bg-gradient-to-r from-sky-400 via-blue-300 to-indigo-400 bg-clip-text text-transparent">{scene.headline}</span></h1><p className="mt-5 text-4xl font-bold leading-snug text-slate-200">{scene.body}</p></div></div></Shell>};

const ProblemScene:React.FC<{scene:DynamicScene;index:number}>=({scene,index})=>{const frame=useCurrentFrame();const {fps}=useVideoConfig();const cs=spring({frame:frame-5,fps,config:{damping:12,stiffness:90}});const l=spring({frame:frame-15,fps,from:-100,to:0,config:{damping:14,stiffness:100}});const r=spring({frame:frame-22,fps,from:100,to:0,config:{damping:14,stiffness:100}});return <Shell badge={sceneLabel(scene.type,index)} tone="red"><div className="mt-8 flex w-full flex-col items-center gap-7"><div style={{transform:`scale(${cs})`}} className="w-full max-w-[900px] rounded-3xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-slate-900/95 to-amber-500/15 p-9 text-center shadow-2xl backdrop-blur-xl"><div className="flex justify-center text-rose-300"><AlertIcon size={72}/></div><h2 style={{fontSize:headlinePx(scene.headline)}} className="mt-4 font-black leading-tight text-amber-300">{scene.headline}</h2><p className="mt-4 text-3xl font-semibold leading-snug text-slate-200">{scene.body}</p></div><div className="grid w-full max-w-[900px] grid-cols-2 gap-6"><div style={{transform:`translateX(${l}px)`}} className="flex min-h-[190px] flex-col items-center justify-center rounded-3xl border-2 border-emerald-500/40 bg-emerald-950/40 p-7 text-center shadow-xl"><LaptopIcon size={64}/><h3 className="mt-3 text-3xl font-black text-emerald-300">Hiện trạng</h3></div><div style={{transform:`translateX(${r}px)`}} className="flex min-h-[190px] flex-col items-center justify-center rounded-3xl border-2 border-rose-500/50 bg-rose-950/50 p-7 text-center shadow-xl"><AlertIcon size={64}/><h3 className="mt-3 text-3xl font-black text-rose-300">Vấn đề</h3></div></div></div></Shell>};

const SolutionScene:React.FC<{scene:DynamicScene;index:number}>=({scene,index})=>{const frame=useCurrentFrame();const {fps}=useVideoConfig();const sc=spring({frame:frame-6,fps,config:{damping:12,stiffness:85,mass:0.9}});const items=[...(scene.keywords||[])].slice(0,3);while(items.length<3)items.push(["Mã nguồn","Thư viện","Cấu hình"][items.length]);const icons=[FileIcon,PackageIcon,GearIcon];return <Shell badge={sceneLabel(scene.type,index)}><div style={{transform:`scale(${sc})`}} className="relative mt-8 flex w-full max-w-[900px] flex-col items-center rounded-3xl border-2 border-sky-400/50 bg-gradient-to-b from-sky-950/80 via-slate-900/90 to-slate-950 p-9 shadow-2xl backdrop-blur-2xl"><div className="flex items-center gap-5"><PackageIcon size={74}/><div><h2 style={{fontSize:headlinePx(scene.headline)}} className="font-black tracking-tight leading-tight text-white">{scene.headline}</h2><p className="mt-2 text-3xl font-bold leading-snug text-sky-300">{scene.body}</p></div></div><div className="mt-7 flex w-full flex-col gap-4">{items.map((x:string,i:number)=>{const I=icons[i];return <div key={i} className="flex min-h-[105px] items-center gap-5 rounded-2xl border-2 border-sky-400/25 bg-slate-900/65 px-7 py-5"><I size={50}/><span className="text-3xl font-black text-slate-100">{x}</span></div>})}</div></div></Shell>};

const WorkflowScene:React.FC<{scene:DynamicScene;index:number}>=({scene,index})=>{const steps=[...(scene.keywords||[])].slice(0,3);while(steps.length<3)steps.push(["Bước 1","Bước 2","Bước 3"][steps.length]);const icons=[FileIcon,DiskIcon,RocketIcon];return <Shell badge={sceneLabel(scene.type,index)} tone="purple"><div className="mt-8 flex w-full max-w-[900px] flex-col items-center gap-4"><h2 style={{fontSize:headlinePx(scene.headline)}} className="mb-2 text-center font-black leading-tight text-white">{scene.headline}</h2><p className="mb-3 max-w-[860px] text-center text-3xl font-semibold leading-snug text-slate-200">{scene.body}</p>{steps.map((x:string,i:number)=>{const I=icons[i];return <React.Fragment key={i}><div className="flex min-h-[125px] w-full items-center gap-6 rounded-3xl border-2 border-purple-400/35 bg-slate-900/90 p-6 shadow-lg"><div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-500/20"><I size={56}/></div><h3 className="text-4xl font-black text-purple-200">{x}</h3></div>{i<2?<ArrowDownIcon size={34}/>:null}</React.Fragment>})}</div></Shell>};

const BenefitsScene:React.FC<{scene:DynamicScene;index:number}>=({scene,index})=>{const items=[...(scene.keywords||[])].slice(0,3);while(items.length<3)items.push(["Nhanh hơn","Tiết kiệm","Linh hoạt"][items.length]);const icons=[BoltIcon,DiskIcon,CloudIcon];return <Shell badge={sceneLabel(scene.type,index)} tone="emerald"><div className="mt-8 flex w-full max-w-[900px] flex-col gap-5"><div className="text-center"><TrophyIcon size={72}/><h2 style={{fontSize:headlinePx(scene.headline)}} className="mt-3 font-black leading-tight text-white">{scene.headline}</h2><p className="mt-3 text-3xl font-semibold leading-snug text-slate-200">{scene.body}</p></div>{items.map((x:string,i:number)=>{const I=icons[i];return <div key={i} className="flex min-h-[125px] items-center gap-6 rounded-3xl border-2 border-emerald-500/35 bg-emerald-950/35 p-6 shadow-xl"><I size={58}/><h3 className="text-4xl font-black text-emerald-200">{x}</h3></div>})}</div></Shell>};

const OutroScene:React.FC<{scene:DynamicScene;index:number;channel?:DynamicChannel}>=({scene,index,channel})=>{const frame=useCurrentFrame();const {fps}=useVideoConfig();const ms=spring({frame:frame-8,fps,config:{damping:12,stiffness:90,mass:0.8}});const links=[channel?.facebook?`Facebook : ${channel.facebook}`:"",channel?.tiktok?`TikTok : ${channel.tiktok}`:"",channel?.youtube?`YouTube : ${channel.youtube}`:"",channel?.website?`Website : ${channel.website}`:""].filter(Boolean);return <Shell badge={sceneLabel("outro",index)}><div style={{transform:`scale(${ms})`}} className="mt-8 flex w-full max-w-[900px] flex-col items-center rounded-3xl border-2 border-white/20 bg-gradient-to-b from-slate-900/90 via-sky-950/40 to-slate-950 p-10 text-center shadow-2xl backdrop-blur-xl"><div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-400 to-blue-600"><RocketIcon size={58}/></div><h2 style={{fontSize:headlinePx(scene.headline)}} className="mt-6 font-black tracking-tight leading-tight text-white">{scene.headline}</h2><div className="mt-7 flex w-full flex-col gap-4">{links.map((x:string,i:number)=><div key={i} className="rounded-2xl border border-white/10 bg-slate-900/70 px-6 py-4 text-left text-3xl font-bold text-slate-100">{x}</div>)}</div></div></Shell>};


const altItems=(scene:DynamicScene,channel?:DynamicChannel)=>{
 const t=(scene.type||"").toLowerCase();
 if(t==="outro")return [channel?.facebook?`Facebook : ${channel.facebook}`:"",channel?.tiktok?`TikTok : ${channel.tiktok}`:"",channel?.youtube?`YouTube : ${channel.youtube}`:"",channel?.website?`Website : ${channel.website}`:""].filter(Boolean);
 return [...(scene.keywords||[])].slice(0,3);
};

const TechCardsTemplateScene:React.FC<{scene:DynamicScene;index:number;channel?:DynamicChannel}>=({scene,index,channel})=>{
 const items=altItems(scene,channel);while(items.length<3)items.push(["Điểm chính","Ứng dụng","Lợi ích"][items.length]);
 const icons=[BoltIcon,PackageIcon,CloudIcon];
 return <AbsoluteFill className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 px-12 py-28 text-white">
   <div className="mx-auto flex h-full w-full max-w-[930px] flex-col justify-center">
    <div className="mb-7 self-start rounded-full border-2 border-blue-400/60 bg-blue-500/15 px-7 py-3 text-2xl font-black tracking-wider text-blue-200">{sceneLabel(scene.type,index)}</div>
    <h1 style={{fontSize:headlinePx(scene.headline,60)}} className="font-black leading-[1.08] text-white">{scene.headline}</h1>
    <p className="mt-5 text-[34px] font-semibold leading-[1.35] text-blue-100">{scene.body}</p>
    <div className="mt-9 grid grid-cols-1 gap-5">
     {items.map((x:string,i:number)=>{const I=icons[i%icons.length];return <div key={i} className="flex min-h-[145px] items-center gap-6 rounded-3xl border-2 border-blue-400/35 bg-blue-950/55 px-7 py-6 shadow-2xl"><div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-blue-500/20"><I size={58}/></div><div className="text-3xl font-black text-blue-100">{x}</div></div>})}
    </div>
   </div>
 </AbsoluteFill>
};

const MinimalTemplateScene:React.FC<{scene:DynamicScene;index:number;channel?:DynamicChannel}>=({scene,index,channel})=>{
 const items=altItems(scene,channel);
 return <AbsoluteFill className="bg-slate-950 px-16 py-32 text-white">
   <div className="flex h-full flex-col justify-center">
    <div className="text-2xl font-black tracking-[0.28em] text-slate-400">{String(index+1).padStart(2,"0")} / {sceneLabel(scene.type,index)}</div>
    <h1 style={{fontSize:headlinePx(scene.headline,72)}} className="mt-8 max-w-[900px] font-black leading-[1.04] tracking-tight text-white">{scene.headline}</h1>
    <div className="mt-8 h-2 w-40 rounded-full bg-white"/>
    <p className="mt-8 max-w-[900px] text-[38px] font-semibold leading-[1.35] text-slate-300">{scene.body}</p>
    {items.length?<div className="mt-10 flex flex-wrap gap-4">{items.map((x:string,i:number)=><div key={i} className="rounded-full border border-slate-600 bg-slate-900 px-6 py-3 text-2xl font-bold text-slate-200">{x}</div>)}</div>:null}
   </div>
 </AbsoluteFill>
};

const CyberTemplateScene:React.FC<{scene:DynamicScene;index:number;channel?:DynamicChannel}>=({scene,index,channel})=>{
 const frame=useCurrentFrame();const pulse=0.72+Math.sin(frame/10)*0.18;
 const items=altItems(scene,channel);while(items.length<3 && (scene.type||"").toLowerCase()!=="outro")items.push(["SYSTEM","NETWORK","SECURITY"][items.length]);
 return <AbsoluteFill className="overflow-hidden bg-black px-10 py-28 font-sans text-cyan-100" style={{fontFamily:"DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif"}}>
   <div className="absolute inset-0 opacity-30" style={{backgroundImage:"linear-gradient(rgba(34,211,238,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.12) 1px,transparent 1px)",backgroundSize:"48px 48px"}}/>
   <div className="absolute left-8 top-28 bottom-28 w-1 bg-cyan-400" style={{opacity:pulse}}/>
   <div className="relative mx-auto flex h-full w-full max-w-[930px] flex-col justify-center">
    <div className="flex items-center justify-between">
      <div className="rounded-md border border-cyan-300/70 bg-cyan-950/70 px-5 py-2 text-xl font-black tracking-[0.2em] text-cyan-300">{sceneLabel(scene.type,index)}</div>
      <div className="text-xl font-bold text-cyan-500">NODE-{String(index+1).padStart(2,"0")}</div>
    </div>
    <div className="mt-6 rounded-3xl border-2 border-cyan-400/55 bg-cyan-950/25 p-8 shadow-[0_0_60px_rgba(34,211,238,0.18)]">
      <div className="mb-5 text-cyan-400"><span className="mr-3">&gt;</span>INITIALIZE_TOPIC</div>
      <h1 style={{fontSize:headlinePx(scene.headline,58)}} className="font-black leading-[1.06] text-cyan-100">{scene.headline}</h1>
      <p className="mt-6 text-[34px] font-semibold leading-[1.35] text-slate-100">{scene.body}</p>
    </div>
    {items.length?<div className="mt-7 grid grid-cols-1 gap-4">{items.map((x:string,i:number)=><div key={i} className="flex min-h-[108px] items-center rounded-xl border border-cyan-500/35 bg-slate-950/80 px-7 text-[30px] font-bold leading-tight text-cyan-100"><span className="mr-5 text-cyan-500">0{i+1}</span>{x}</div>)}</div>:null}
   </div>
 </AbsoluteFill>
};

const TerminalTemplateScene:React.FC<{scene:DynamicScene;index:number;channel?:DynamicChannel}>=({scene,index,channel})=>{
 const items=altItems(scene,channel);const t=(scene.type||"").toLowerCase();
 return <AbsoluteFill className="bg-black px-10 py-28 text-emerald-300" style={{fontFamily:"DejaVu Sans Mono, Liberation Mono, Consolas, monospace"}}>
   <div className="mx-auto flex h-full w-full max-w-[940px] flex-col justify-center rounded-3xl border-2 border-emerald-500/40 bg-slate-950 p-8 shadow-[0_0_80px_rgba(34,197,94,0.12)]">
    <div className="mb-8 flex items-center gap-3 border-b border-emerald-900 pb-5"><span className="h-4 w-4 rounded-full bg-red-500"/><span className="h-4 w-4 rounded-full bg-amber-400"/><span className="h-4 w-4 rounded-full bg-emerald-500"/><span className="ml-4 text-xl text-emerald-700">explainer@studio:~</span></div>
    <div className="text-2xl text-emerald-500">$ scene --type {t||"content"} --index {index+1}</div>
    <h1 style={{fontSize:headlinePx(scene.headline,54)}} className="mt-6 font-black leading-tight text-emerald-300">&gt; {scene.headline}</h1>
    <p className="mt-6 whitespace-pre-wrap text-[34px] font-semibold leading-[1.35] text-slate-200">{scene.body}</p>
    <div className="mt-8 space-y-4">{items.map((x:string,i:number)=><div key={i} className="text-2xl text-emerald-400">[{String(i+1).padStart(2,"0")}] {x}</div>)}</div>
    <div className="mt-8 text-xl text-emerald-700">status: READY_</div>
   </div>
 </AbsoluteFill>
};

type CustomTemplateConfig=NonNullable<ScriptExplainerProps["templateConfig"]>;
const CustomTemplateScene:React.FC<{scene:DynamicScene;index:number;channel?:DynamicChannel;cfg:CustomTemplateConfig}>=({scene,index,channel,cfg})=>{const links=(scene.type||"").toLowerCase()==="outro"?[channel?.facebook?`Facebook : ${channel.facebook}`:"",channel?.tiktok?`TikTok : ${channel.tiktok}`:"",channel?.youtube?`YouTube : ${channel.youtube}`:"",channel?.website?`Website : ${channel.website}`:""].filter(Boolean):(scene.keywords||[]).slice(0,3);const bg=cfg.backgroundUrl?`url(${staticFile(cfg.backgroundUrl)})`:undefined;const fontUrl=cfg.fontUrl?staticFile(cfg.fontUrl):"";const fontFamily=fontUrl?"CustomTemplateFont":(cfg.fontFamily||"DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif");const accent=cfg.accent||"#38bdf8";return <AbsoluteFill style={{fontFamily,backgroundImage:bg,backgroundSize:cfg.backgroundFit||"cover",backgroundPosition:"center"}} className="bg-slate-950 text-white">{fontUrl?<style>{`@font-face{font-family:"CustomTemplateFont";src:url("${fontUrl}")}`}</style>:null}<div className="absolute inset-0 bg-slate-950/55"/><div className="relative mx-auto flex h-full w-full max-w-[920px] flex-col justify-center px-12 py-28"><div style={{borderColor:accent,color:accent}} className="mb-7 self-start rounded-full border-2 bg-black/40 px-6 py-3 text-2xl font-black tracking-wider">{sceneLabel(scene.type,index)}</div><div className="rounded-[32px] border border-white/15 bg-black/45 p-9 shadow-2xl backdrop-blur-sm"><h1 style={{fontSize:headlinePx(scene.headline,64)}} className="font-black leading-[1.08] tracking-tight">{scene.headline}</h1><p className="mt-6 text-[34px] font-semibold leading-[1.35] text-slate-100">{scene.body}</p></div>{links.length?<div className="mt-7 grid gap-4">{links.map((x:string,i:number)=><div key={i} style={{borderColor:accent}} className="rounded-2xl border bg-black/45 px-7 py-5 text-[28px] font-bold">{x}</div>)}</div>:null}</div></AbsoluteFill>;};

const SceneView:React.FC<{scene:DynamicScene;index:number;channel?:DynamicChannel;template?:string;templateConfig?:CustomTemplateConfig}>=({scene,index,channel,template="classic-docker",templateConfig})=>{if(template.startsWith("custom:")&&templateConfig)return <CustomTemplateScene scene={scene} index={index} channel={channel} cfg={templateConfig}/>;if(template==="tech-cards")return <TechCardsTemplateScene scene={scene} index={index} channel={channel}/>;if(template==="minimal-clean")return <MinimalTemplateScene scene={scene} index={index} channel={channel}/>;if(template==="cyber-tech")return <CyberTemplateScene scene={scene} index={index} channel={channel}/>;if(template==="terminal-cli")return <TerminalTemplateScene scene={scene} index={index} channel={channel}/>;const t=(scene.type||"").toLowerCase();if(t==="hook"||t==="intro")return <HookScene scene={scene} index={index}/>;if(t==="problem")return <ProblemScene scene={scene} index={index}/>;if(t==="solution")return <SolutionScene scene={scene} index={index}/>;if(t==="workflow"||t==="example")return <WorkflowScene scene={scene} index={index}/>;if(t==="benefits"||t==="summary")return <BenefitsScene scene={scene} index={index}/>;if(t==="outro")return <OutroScene scene={scene} index={index} channel={channel}/>;return <SolutionScene scene={scene} index={index}/>;};

export const ScriptExplainer:React.FC<ScriptExplainerProps>=({scenes,channel,template="classic-docker",templateConfig})=>{const frame=useCurrentFrame();const {durationInFrames}=useVideoConfig();const fi=interpolate(frame,[0,15],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});const fo=interpolate(frame,[Math.max(0,durationInFrames-20),durationInFrames],[1,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});const templateClass={"classic-docker":"bg-gradient-to-b from-slate-950 via-slate-900 to-black font-sans","tech-cards":"bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 font-sans","minimal-clean":"bg-slate-950 font-sans","cyber-tech":"bg-gradient-to-b from-black via-cyan-950 to-black font-sans","terminal-cli":"bg-black font-mono"}[template]||"bg-gradient-to-b from-slate-950 via-slate-900 to-black font-sans";return <AbsoluteFill style={{opacity:fi*fo,fontFamily:"DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif"}} className={`relative overflow-hidden ${templateClass} text-white select-none`}><div className="absolute top-8 left-1/2 z-50 -translate-x-1/2 rounded-full border border-sky-400/50 bg-slate-950/90 px-7 py-3 text-2xl font-black tracking-widest text-sky-200">{channel?.channelName||"Explainer Studio"}</div><div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-sky-600/15 blur-[140px]"/><div className="absolute top-1/2 -right-40 h-[700px] w-[700px] rounded-full bg-indigo-600/15 blur-[160px]"/><div className="absolute -bottom-40 left-1/4 h-[600px] w-[600px] rounded-full bg-blue-600/15 blur-[140px]"/><Series>{scenes.map((scene,index)=>{const d=Math.max(30,Number(scene.durationInFrames||180));const a=audioSrc(scene.audioPath);return <Series.Sequence key={index} durationInFrames={d}>{a?<Audio src={a}/>:null}<SceneView scene={scene} index={index} channel={channel} template={template} templateConfig={templateConfig}/></Series.Sequence>})}</Series></AbsoluteFill>};
