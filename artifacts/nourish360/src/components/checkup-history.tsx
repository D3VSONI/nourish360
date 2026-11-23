import { useState } from 'react';
import { CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts';
import type { PatientType,Visit,Vitals } from '@workspace/api-client-react';
import { dateLabel,local,useLang } from '@/lib/i18n';
import { units,vitalFields,vitalLabels } from '@/lib/checkup-copy';
import { trendLabel } from '@/lib/result-copy';

export function CheckupHistory({role,visits}:{role:PatientType;visits:Visit[]}){
  const {tr,lang}=useLang();const [key,setKey]=useState<keyof Vitals>();const latest=visits.at(-1)!;
  const available=vitalFields[role].filter(k=>visits.some(v=>v.vitals[k]!==undefined));const field=key&&available.includes(key)?key:available[0];
  const dates=field?visits.flatMap(v=>v.vitals[field]!==undefined?[{date:Date.parse(v.created_at),value:v.vitals[field]}]:[]):[];
  return <section className="panel min-w-0 p-4" aria-label={tr('Past and latest readings','पिछले और नए माप')}>
    <h2 className="text-xl font-extrabold">{tr('Past and latest','पिछले और नए माप')}</h2><p className="mt-1 text-sm font-bold text-primary" data-testid="text-trend">{trendLabel(latest.trend,lang)}</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="panel-visit-comparison">{available.map(k=>{const prior=visits.slice(0,-1).reverse().find(x=>x.vitals[k]!==undefined)?.vitals[k];const now=latest.vitals[k];return <div key={k} className="rounded-xl border bg-white p-3"><h3 className="text-sm font-bold">{local(vitalLabels[k],lang)}</h3><div className="mt-1 flex flex-wrap gap-x-1 text-lg tabular-nums"><span className="text-muted-foreground" aria-label={tr('Previous','पिछला')}>{prior??'—'}</span><span aria-hidden>→</span><strong aria-label={tr('Latest','नया')}>{now??'—'}</strong><span className="self-center text-xs">{local(units[k],lang)}</span></div></div>;})}</div>
    {field&&<><label className="mt-4 block text-sm font-bold">{tr('View one measurement over time','समय के साथ एक माप देखें')}<select className="field mt-1 block w-full" value={field} onChange={e=>setKey(e.target.value as keyof Vitals)}>{available.map(k=><option key={k} value={k}>{local(vitalLabels[k],lang)} ({local(units[k],lang)})</option>)}</select></label>
    <div className="mt-3 h-48 w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={dates}><CartesianGrid strokeDasharray="4 4"/><XAxis type="number" dataKey="date" domain={['dataMin','dataMax']} tickFormatter={t=>dateLabel(String(new Date(t).toISOString()),lang)} tick={{fontSize:11}}/><YAxis width={39} tick={{fontSize:11}}/><Tooltip labelFormatter={n=>dateLabel(new Date(Number(n)).toISOString(),lang,true)} formatter={n=>[`${n} ${local(units[field],lang)}`,local(vitalLabels[field],lang)]}/><Line type="linear" name={local(vitalLabels[field],lang)} dataKey="value" stroke="#0F766E" strokeWidth={3} dot={{r:4}} isAnimationActive={false}/></LineChart></ResponsiveContainer></div></>}
  </section>;
}
