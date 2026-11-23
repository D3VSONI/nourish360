import { useState } from 'react';
import { HeartHandshake,MapPin,MessagesSquare,Phone } from 'lucide-react';
import type { PatientType } from '@workspace/api-client-react';
import { local,useLang } from '@/lib/i18n';
import { steps } from '@/lib/emergency-copy';
import { Listen } from './listen';

const icons=[Phone,MessagesSquare,HeartHandshake,MapPin];
export function EmergencyGuide({role,offline=false}:{role:PatientType;offline?:boolean}){
  const {tr,lang}=useLang();const [checked,setChecked]=useState<number[]>([]);
  const content=steps[role].map(p=>local(p,lang));
  return <section className="panel p-4" data-testid="panel-emergency-guidance">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold">{offline?tr('Offline safety checklist','ऑफ़लाइन सुरक्षा सूची'):tr('What to do while waiting','इंतज़ार में क्या करें')}</h2><Listen text={content.join(' ')} testId="button-listen-guide"/></div>
    <ol className="mt-3 grid gap-2">{content.map((text,i)=>{const Icon=icons[i]!;return <li key={i}><label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border bg-white p-3"><Icon size={21} className="shrink-0 text-primary"/><span className="flex-1 text-sm font-semibold" data-testid={`text-guide-${i}`}>{text}</span><input type="checkbox" checked={checked.includes(i)} onChange={()=>setChecked(c=>c.includes(i)?c.filter(n=>n!==i):[...c,i])} className="size-6 shrink-0 accent-primary"/></label></li>;})}</ol>
  </section>;
}
