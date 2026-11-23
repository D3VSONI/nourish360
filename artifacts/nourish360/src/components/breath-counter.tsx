import { useEffect,useRef,useState } from 'react';
import { Activity,Timer } from 'lucide-react';
import { useLang } from '@/lib/i18n';

export function BreathCounter({onUse}:{onUse:(perMinute:number)=>void}){
  const {tr}=useLang();const [mode,setMode]=useState<'idle'|'running'|'done'>('idle');
  const [remaining,setRemaining]=useState(15); const [count,setCount]=useState(0);const deadline=useRef(0);
  useEffect(()=>{
    if(mode!=='running')return;
    const tick=()=>{const left=Math.max(0,Math.ceil((deadline.current-Date.now())/1000));setRemaining(left);if(!left)setMode('done');};
    const id=setInterval(tick,100);return()=>clearInterval(id);
  },[mode]);
  const start=()=>{setCount(0);setRemaining(15);deadline.current=Date.now()+15000;setMode('running');};
  return <div className="mt-3 rounded-2xl border border-primary/30 bg-accent/60 p-4" aria-label={tr('15-second breathing practice','15 सेकंड साँस गिनने का अभ्यास')}>
    <p className="flex items-center gap-2 font-bold"><Timer size={20}/>{tr('15-second breath counter','15 सेकंड में साँसें गिनें')}</p>
    <p className="mt-1 text-sm text-muted-foreground">{tr('Practice only. Tap once per breath. For a real measurement, count for a full minute.','सिर्फ अभ्यास। हर साँस पर एक बार दबाएँ। असली माप के लिए पूरा एक मिनट गिनें।')}</p>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {mode!=='running'&&<button type="button" data-testid="button-start-breath-counter" className="min-h-[52px] rounded-xl border bg-white px-4 font-bold" onClick={start}>{mode==='done'?tr('Start again','फिर शुरू करें'):tr('Start 15 seconds','15 सेकंड शुरू करें')}</button>}
      {mode==='running'&&<><span className="rounded-xl bg-white px-3 py-3 text-xl tabular-nums" role="timer" aria-label={tr('Seconds remaining','बाकी सेकंड')}>{remaining} {tr('s','सेकंड')}</span><button type="button" data-testid="button-count-breath" className="inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-primary px-4 font-bold text-white" onClick={()=>{if(Date.now()<deadline.current)setCount(c=>c+1);}}><Activity size={18}/>{tr('Count a breath','साँस गिनें')} · {count}</button><button type="button" className="min-h-[52px] px-2 text-sm underline" onClick={()=>setMode('idle')}>{tr('Cancel','रद्द करें')}</button></>}
      {mode==='done'&&<><p role="status" data-testid="text-breath-result" className="font-bold">{count*4} {tr('breaths/min (estimate)','साँस/मिनट (अंदाज़ा)')}</p><button type="button" data-testid="button-use-breath-rate" disabled={count===0||count*4>150} className="min-h-[52px] rounded-xl bg-primary px-4 font-bold text-white disabled:opacity-50" onClick={()=>onUse(count*4)}>{tr('Use practice count','अभ्यास की गिनती भरें')}</button></>}
    </div>
  </div>;
}
