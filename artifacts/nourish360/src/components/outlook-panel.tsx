import { CalendarDays,HeartHandshake } from 'lucide-react';
import type { Forecast } from '@workspace/api-client-react';
import { outlook } from '@/lib/result-copy';
import { useLang } from '@/lib/i18n';
import { Listen } from './listen';

export function OutlookPanel({forecasts}:{forecasts:Forecast[]}){
  const {tr,lang}=useLang();
  return <section className="panel p-4" aria-label={tr('Six-month practice outlook','छह महीने का अभ्यास')}> <h2 className="flex items-center gap-2 text-xl font-extrabold"><CalendarDays size={21} className="text-primary"/>{tr('Next six months','अगले छह महीने')}</h2><p className="mt-1 text-sm text-muted-foreground">{tr('Illustrative follow-up, not a personal prediction. Do not wait to get help.','यह आगे की जाँच का उदाहरण है, आपकी भविष्यवाणी नहीं। मदद लेने में देर न करें।')}</p>
    <div className="mt-3 grid gap-3">{forecasts.map((f,i)=>{const item=outlook(f,lang);return <article key={item.key??i} className="rounded-2xl border bg-white p-3" data-testid={`card-forecast-${i}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{item.title}</h3><Listen testId={`button-speak-${i}`} text={`${item.title}. ${item.reason} ${item.action}`}/></div><p className="mt-1 text-sm font-semibold text-primary">{item.time}</p>
      {item.interval&&<div className="mt-2 grid grid-cols-6 gap-1" aria-label={item.time}>{Array.from({length:6},(_,index)=><span key={index} aria-hidden className={`grid h-8 place-items-center rounded-md text-xs font-bold ${index+1>=item.interval![0]&&index+1<=item.interval![1]?'bg-accent text-primary':'bg-muted text-muted-foreground'}`}>{index+1}</span>)}</div>}
      <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p><p className="mt-2 flex gap-2 rounded-xl bg-accent/60 p-2 text-sm"><HeartHandshake size={19} className="shrink-0 text-primary"/>{item.action}</p>
    </article>;})}</div>
  </section>;
}
