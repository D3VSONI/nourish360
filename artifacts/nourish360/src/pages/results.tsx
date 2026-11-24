import { useState } from 'react';
import { Link,useLocation } from 'wouter';
import { CalendarDays,CloudOff,HeartPulse,Loader2,MapPin,Plus,Siren,TriangleAlert } from 'lucide-react';
import { useRequestReview } from '@workspace/api-client-react';
import { villages } from '@workspace/nourish-logic';
import { useApp } from '@/lib/store';
import { dateLabel,local,localizeMessage,saved,useLang,villageName } from '@/lib/i18n';
import { Call108 } from '@/components/shell';
import { useToast } from '@/hooks/use-toast';
import { useSaveDrill } from '@/lib/booking';
import { ActiveDrills } from '@/components/active-drills';
import { TIER_STYLE } from '@/components/patient-attention-panel';
import { CheckupHistory } from '@/components/checkup-history';
import { OutlookPanel } from '@/components/outlook-panel';
import { Listen } from '@/components/listen';
import { routineNext,ruleLabel,tierCopy } from '@/lib/result-copy';
import { symptomText } from '@/lib/checkup-copy';
import { bypassReason,scenarioWire,type Scenario } from '@/lib/emergency-copy';

export default function Results(){
  const {record,queue,ready,openEmergency,online}=useApp();const {lang,tr}=useLang();const [,navigate]=useLocation();const {toast}=useToast();
  const review=useRequestReview();const book=useSaveDrill();const [reviewed,setReviewed]=useState<string>();const [selectedVisitId,setSelectedVisitId]=useState<string>();
  if(!ready)return <div className="mx-auto max-w-4xl animate-pulse p-6"><div className="h-64 rounded-3xl bg-muted"/></div>;
  if(!record||!record.visits.length)return <div className="mx-auto max-w-md px-4 py-12"><section className="panel"><h1 className="text-2xl font-extrabold">{tr('No visits yet','अभी कोई जाँच नहीं')}</h1><Link href={record?'/assess':'/'} className="tap tap-primary mt-4" data-testid="link-start-visit">{record?tr('Start a visit','जाँच शुरू करें'):tr('Choose a role','किसकी जाँच है?')}</Link></section></div>;
  const {patient}=record;const visits=[...record.visits].sort((a,b)=>a.created_at.localeCompare(b.created_at));const latest=visits.at(-1)!;const v=visits.find(visit=>visit.id===selectedVisitId)??latest;
  const pending=new Set(queue.map(q=>q.mutation_id));const queued=pending.has(v.mutation_id??v.id);const style=tierCopy[v.risk_tier];
  const title=local(style.title,lang),note=local(style.note,lang);
  const next=v.risk_tier==='GREEN'?routineNext(patient.patient_type,lang):v.risk_tier==='AMBER'?tr('Show these readings to a clinician.','ये माप डॉक्टर को दिखाएँ।'):tr('In a real emergency, call 108.','असली इमरजेंसी में 108 मिलाएँ।');
  const askReview=()=>review.mutate({id:v.id},{onSuccess:()=>{setReviewed(v.id);toast({title:tr('Practice review logged. No clinic was contacted.','अभ्यास की समीक्षा दर्ज हुई। किसी स्वास्थ्य केंद्र से संपर्क नहीं हुआ।')});},onError:()=>toast({title:tr('Could not log the review. Try again online.','समीक्षा दर्ज नहीं हुई। नेटवर्क जोड़कर फिर कोशिश करें।')})});
  const startDrill=()=>{
    const text=v.symptoms.join(' ').toLowerCase();
    const scenario:Scenario=/bleed|blood loss|soaking|pad/.test(text)?'bleeding':/seizur|headache|blurred/.test(text)||(v.vitals.bp_sys??0)>=160||(v.vitals.bp_dia??0)>=110?'bp':/fever|breath/.test(text)?'breathing':'other';
    const village=villages.find(x=>x.name.toLowerCase()===patient.village.toLowerCase());const emergency_type=scenarioWire(scenario);
    if(!online||!village){openEmergency({patient_type:patient.patient_type,emergency_type,village:village?.name});return;}
    void book.save({patient_type:patient.patient_type,emergency_type,pickup_village:village.name}).then(b=>{toast({title:local(saved,lang),description:tr('Practice only. No ambulance was sent.','सिर्फ अभ्यास। कोई एम्बुलेंस नहीं भेजी गई।')});navigate(`/track/${b.id}`);}).catch(e=>toast({title:tr('Practice could not start','अभ्यास शुरू नहीं हो पाया'),description:localizeMessage(e.message,lang)}));
  };
  return <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold text-primary">{v.id===latest.id?tr('Latest check-up','सबसे नई जाँच'):tr('Past check-up','पुरानी जाँच')}</p><h1 className="font-display break-words text-3xl font-extrabold" data-testid="text-patient-name">{patient.full_name}</h1><p className="mt-1 text-sm text-muted-foreground">{patient.health_id} · {villageName(patient.village,lang)} · {patient.masked_phone}</p>{v.id!==latest.id&&<button type="button" className="mt-2 text-sm font-bold text-primary underline" onClick={()=>setSelectedVisitId(undefined)}>{tr('Show latest check-up','सबसे नई जाँच दिखाएँ')}</button>}</div><Link href="/assess" className="tap tap-primary gap-2" data-testid="link-new-visit"><Plus size={20}/>{tr('New visit','नई जाँच')}</Link></header>
    <section className={`zone ${style.zone} p-4 sm:p-6`} data-testid="banner-risk">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold"><span className={`size-3 rounded-full ${TIER_STYLE[v.risk_tier]}`} aria-hidden/><span>{local(style.tag,lang)}</span><time dateTime={v.created_at} className="font-normal text-muted-foreground">{dateLabel(v.created_at,lang,true)}</time>{queued&&<span className="inline-flex items-center gap-1 rounded-lg border bg-white px-2"><CloudOff size={15}/>{tr('Pending sync','फ़ोन पर सहेजी गई')}</span>}</div>
      <h2 className="mt-2 text-2xl font-extrabold sm:text-4xl">{title}</h2><p className="mt-1 max-w-2xl text-sm sm:text-base">{note}</p>
      {v.triggered_rules.length>0&&<ul className="mt-3 flex flex-wrap gap-2">{v.triggered_rules.map((r,i)=><li key={i} className="rounded-xl border bg-white px-3 py-1.5 text-sm font-bold" data-testid={`text-rule-${i}`}>{ruleLabel(r,lang)}</li>)}</ul>}
      <p className="mt-3 flex items-center gap-2 text-sm font-bold" data-testid="text-next-step">{v.risk_tier==='GREEN'?<CalendarDays size={19}/>:<HeartPulse size={19}/>} {next}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2"><Listen text={`${title}. ${note} ${next}`}/>
        {v.risk_tier==='AMBER'&&<button type="button" className="tap tap-primary" disabled={review.isPending||queued||!online||reviewed===v.id} data-testid="button-request-review" onClick={askReview}>{review.isPending&&<Loader2 size={18} className="animate-spin"/>}{reviewed===v.id?tr('Review logged','समीक्षा दर्ज है'):queued?tr('Sync first','पहले जाँच भेजें'):tr('Log practice review','अभ्यास की समीक्षा दर्ज करें')}</button>}
        {v.risk_tier==='RED'&&<><Call108 testId="link-call-108-results"/><button type="button" className="tap gap-2" disabled={book.isPending} data-testid="button-dispatch-sim" onClick={startDrill}>{book.isPending?<Loader2 size={18} className="animate-spin"/>:<Siren size={18}/>} {online?tr('Start practice drill','अभ्यास शुरू करें'):tr('Open offline checklist','ऑफ़लाइन सूची खोलें')}</button></>}
      </div>
      {v.routed_facility&&<div className="mt-4 rounded-xl border bg-white p-3 text-sm" data-testid="panel-referral"><p className="flex items-center gap-2 font-bold"><MapPin size={19} className="shrink-0"/>{tr('Example referral','रेफ़रल का उदाहरण')} · {villageName(v.routed_facility.facility.name,lang)} · {v.routed_facility.facility.distance_km} {tr('km','किमी')}</p>{v.routed_facility.bypassed.map(b=><p key={b.name} className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2"><TriangleAlert size={16} className="mt-0.5 shrink-0"/>{villageName(b.name,lang)} ({b.distance_km} {tr('km','किमी')}) · {bypassReason(b.reason,lang)}</p>)}</div>}
    </section>
    <ActiveDrills/>
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]"><CheckupHistory key={patient.health_id} role={patient.patient_type} visits={visits}/><OutlookPanel forecasts={v.six_month_forecast}/></div>
     <section className="panel p-4"><h2 className="text-xl font-extrabold">{tr('Visit history','पुरानी जाँचें')}</h2><p className="mt-1 text-sm text-muted-foreground">{tr('Select a visit to open its readings and follow-up.', 'माप और आगे की जानकारी देखने के लिए जाँच चुनें।')}</p><ol className="mt-2 divide-y">{[...visits].reverse().map(visit=><li key={visit.id} data-testid={`row-visit-${visit.id}`}><button type="button" aria-pressed={visit.id===v.id} onClick={()=>setSelectedVisitId(visit.id)} className={`flex min-h-[58px] w-full items-start gap-2 rounded-lg py-3 text-left text-sm transition-colors hover:bg-muted/60 ${visit.id===v.id?'bg-accent/60':''}`}><span className={`mt-1.5 size-3 shrink-0 rounded-full ${TIER_STYLE[visit.risk_tier]}`} aria-label={local(tierCopy[visit.risk_tier].tag,lang)}/><time dateTime={visit.created_at} className="shrink-0 font-bold">{dateLabel(visit.created_at,lang)}</time><span className="min-w-0 flex-1 text-muted-foreground">{visit.symptoms.length?visit.symptoms.map(s=>symptomText(s,lang)).join(' · '):tr('No symptoms recorded','कोई लक्षण दर्ज नहीं')}</span>{pending.has(visit.mutation_id??visit.id)&&<span className="rounded-lg bg-amber-50 px-2 font-bold text-amber-900">{tr('Queued','भेजना बाकी')}</span>}</button></li>)}</ol></section>
  </div>;
}
