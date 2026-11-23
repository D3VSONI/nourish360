import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useLang } from '@/lib/i18n';

export function Listen({text,testId}:{text:string;testId?:string}) {
  const {lang,tr}=useLang();
  const [playing,setPlaying]=useState(false);
  const [unavailable,setUnavailable]=useState(false);
  const owned=useRef<SpeechSynthesisUtterance|null>(null);
  useEffect(()=>{
    setPlaying(false);setUnavailable(false);
    window.speechSynthesis?.getVoices();
    return()=>{if(owned.current){const engine=window.speechSynthesis;owned.current=null;engine?.cancel();}};
  },[lang,text]);
  const speak=()=>{
    const engine=window.speechSynthesis;
    if(!engine || typeof SpeechSynthesisUtterance==='undefined'){setUnavailable(true);return;}
    if(owned.current){engine.cancel();owned.current=null;setPlaying(false);return;}
    const locale=lang==='hi'?'hi-IN':'en-IN';
    const voices=engine.getVoices().filter(v=>v.localService);
    const voice=voices.find(v=>v.lang.toLowerCase()===locale.toLowerCase())??voices.find(v=>v.lang.toLowerCase().startsWith(`${lang}-`));
    if(!voice){setUnavailable(true);return;}
    engine.cancel();
    const u=new SpeechSynthesisUtterance(text); u.lang=locale;u.voice=voice;u.rate=.9;
    u.onend=()=>{if(owned.current===u){owned.current=null;setPlaying(false);}};
    u.onerror=(e)=>{if(owned.current===u){owned.current=null;setPlaying(false);setUnavailable(!['canceled','interrupted'].includes(e.error));}};
    owned.current=u;setUnavailable(false);setPlaying(true);
    try{engine.speak(u);}catch{owned.current=null;setPlaying(false);setUnavailable(true);}
  };
  return <span className="inline-flex flex-wrap items-center gap-2"><button type="button" data-testid={testId} className="inline-flex min-h-[52px] shrink-0 items-center gap-2 rounded-xl border border-current/25 px-3 text-sm font-bold" onClick={speak}>{playing?<VolumeX size={17}/>:<Volume2 size={17}/>} {playing?tr('Stop','बंद करें'):tr('Listen','सुनें')}</button>{unavailable&&<span role="status" className="max-w-xs text-sm">{tr('No voice for this language is available on this device. You can still read the text.','इस फ़ोन में इस भाषा की आवाज़ नहीं है। आप जानकारी पढ़ सकते हैं।')}</span>}</span>;
}
