import "./index.css";
import {Composition} from "remotion";
import {DockerExplainer} from "./DockerExplainer/DockerExplainer";
import {dockerExplainerSchema} from "./DockerExplainer/types";
import {ScriptExplainer,scriptExplainerSchema} from "./ScriptExplainer/ScriptExplainer";
export const RemotionRoot:React.FC=()=> <><Composition id="DockerExplainer" component={DockerExplainer} durationInFrames={1280} fps={30} width={1080} height={1920} schema={dockerExplainerSchema} defaultProps={{title:"Docker là gì?",subtitle:"Giải thích trong 50 giây"}}/><Composition id="ScriptExplainer" component={ScriptExplainer} durationInFrames={1800} fps={30} width={1080} height={1920} schema={scriptExplainerSchema} calculateMetadata={({props})=>({durationInFrames:Math.max(1,(props.scenes||[]).reduce((n,s)=>n+Number(s.durationInFrames||150),0))})} defaultProps={{title:"Explainer Studio",channel:{channelName:"Explainer Studio"},scenes:[{type:"content",headline:"Explainer Studio",body:"Nội dung",voiceover:"Voiceover",keywords:[],audioPath:"",durationInFrames:150}]}}/></>;
