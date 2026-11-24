import { useEffect,useRef,useState } from 'react';
import { Link,useLocation } from 'wouter';
import { Activity,Baby,CloudOff,Droplets,Eye,HeartPulse,Loader2,Stethoscope,Thermometer,TriangleAlert,WandSparkles } from 'lucide-react';
import type { AssessmentInput,Vitals } from '@workspace/api-client-react';
import { useApp } from '@/lib/store';
import { clearDraft,readDraft,saveDraft } from '@/lib/offline';
import { useToast } from '@/hooks/use-toast';
import { local,localizeMessage,offlineSaved,roleLabel,saved,useLang,villageName } from '@/lib/i18n';
import { emergencySample,muacApplicable,signKeys,signText,symptomWire,units,vitalFields,vitalLabels,vitalRanges,type SignKey } from '@/lib/checkup-copy';
import { FieldStepper } from '@/components/field-stepper';
import { BreathCounter } from '@/components/breath-counter';
import { Listen } from '@/components/listen';

const icons={breath:Activity,chest:Activity,fever:Thermometer,cold:Thermometer,feed:Baby,vomit:TriangleAlert,drowsy:HeartPulse,navel:Droplets,head:TriangleAlert,vision:Eye,swelling:Activity,blood:Droplets,movement:Baby,pain:HeartPulse,pad:Droplets,chills:Thermometer,discharge:Droplets,faint:TriangleAlert,breast:HeartPulse} satisfies Record<SignKey,typeof Activity>;

export default function Assess(){
  const {record,submitAssessment,online,ready,syncing}=useApp();const {lang,tr}=useLang();const {toast}=useToast();const [,navigate]=useLocation();
  const [vitals,setVitals]=useState<Record<string,string>>({});const [symptoms,setSymptoms]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);const [loaded,setLoaded]=useState<string>();const [error,setError]=useState('');
  const submitted=useRef(false);const attempted=useRef<{key:string;input:AssessmentInput}|null>(null);
  const healthId=record?.patient.health_id;
  useEffect(()=>{
    if(!healthId)return;let active=true;submitted.current=false;setError('');
    void readDraft(healthId).catch(()=>undefined).then(d=>{if(!active)return;setVitals(d?.vitals??{});setSymptoms(d?.symptoms??[]);attempted.current=d?.attempt??null;setLoaded(healthId);});
    return()=>{active=false;};
  },[healthId]);
  useEffect(()=>{if(healthId&&loaded===healthId&&!submitted.current&&!busy)void saveDraft(healthId,vitals,symptoms,attempted.current??undefined).catch(()=>undefined);},[vitals,symptoms,healthId,loaded,busy]);
  if(!ready||(healthId&&loaded!==healthId))return <div className="mx-auto max-w-3xl animate-pulse px-4 py-10"><div className="h-60 rounded-3xl bg-muted"/></div>;
  if(!record||!healthId)return <section className="mx-auto max-w-lg px-4 py-12"><div className="panel p-6"><h1 className="text-2xl font-bold">{tr('Open a patient profile first','पहले मरीज़ की प्रोफ़ाइल खोलें')}</h1><Link href="/" data-testid="link-choose-role" className="tap tap-primary mt-4">{tr('Choose a role','किसकी जाँच है?')}</Link></div></section>;
  const role=record.patient.patient_type;
  const hasMuac=role==='CHILD'&&muacApplicable(record.patient.profile.dob_months);
  const fields=vitalFields[role].filter(k=>k!=='muac_cm'||hasMuac);
  const muac=vitals.muac_cm===''||vitals.muac_cm===undefined?undefined:Number(vitals.muac_cm);
  const how=tr('Fill the measurements you have, then choose any signs you noticed. This is practice, not a diagnosis.','जो माप लिए हैं, उन्हें भरें। जो लक्षण दिखे, उन्हें चुनें। यह सिर्फ अभ्यास है, बीमारी की पहचान नहीं।');
  const change=(key:keyof Vitals,value:string)=>setVitals(v=>({...v,[key]:value}));
  const submit=async()=>{
    setError('');setBusy(true);const measured:Vitals={};
    for(const key of fields)if(vitals[key]?.trim())measured[key]=Number(vitals[key]);
    try{
      const key=JSON.stringify([healthId,measured,symptoms]);
      if(attempted.current?.key!==key)attempted.current={key,input:{mutation_id:crypto.randomUUID(),vitals:measured,symptoms,recorded_at:new Date().toISOString()}};
      await saveDraft(healthId,vitals,symptoms,attempted.current).catch(()=>undefined);
      const {offline}=await submitAssessment(attempted.current.input);submitted.current=true;await clearDraft(healthId).catch(()=>undefined);
      toast({title:local(offline?offlineSaved:saved,lang)});navigate('/results');
    }catch(e){setError(e instanceof Error?e.message:'The assessment could not be saved.');}finally{setBusy(false);}
  };
  const fill=()=>{const s=emergencySample[role];setVitals(Object.fromEntries(Object.entries(s.vitals).map(([k,v])=>[k,String(v)])));setSymptoms([symptomWire(s.sign)]);setError('');};
  return <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
    <header><p className="text-sm font-bold text-primary">{roleLabel(role,lang)} · {tr('Visit','जाँच')} {record.visits.length+1}</p><h1 className="font-display mt-2 text-3xl font-bold" data-testid="text-patient-name">{record.patient.full_name}</h1><p className="mt-1 text-sm text-muted-foreground">{healthId} · {villageName(record.patient.village,lang)}</p><div className="mt-3 flex flex-wrap gap-2"><Listen text={how}/><button type="button" data-testid="button-sample-emergency" onClick={fill} className="tap gap-2"><WandSparkles size={18}/>{tr('Fill emergency example','इमरजेंसी का उदाहरण भरें')}</button></div></header>
    <section className="panel p-4 sm:p-6"><h2 className="flex items-center gap-2 text-xl font-bold"><Stethoscope size={21} className="text-primary"/>{tr('Measurements','माप')}</h2><p className="my-2 text-sm text-muted-foreground">{how}</p>
      <div className="grid gap-3 sm:grid-cols-2">{fields.map(key=>{const [min,max,step,start]=vitalRanges[key];return <FieldStepper key={key} label={local(vitalLabels[key],lang)} unit={local(units[key],lang)} value={vitals[key]??''} onChange={v=>change(key,v)} {...{min,max,step,start}} testId={`input-vital-${key}`}/>;})}</div>
      {role==='CHILD'&&<BreathCounter onUse={n=>change('resp_rate',String(n))}/>}
      {hasMuac&&<aside className="mt-3 rounded-2xl border bg-background p-3" data-testid="panel-muac-bands"><p className="text-sm font-bold">{tr('Practice MUAC bands · 6–59 months only','बाँह की गोलाई का अभ्यास · सिर्फ 6–59 महीने')}</p><div className="mt-2 grid grid-cols-3 gap-1 text-center text-xs font-bold"><span className="rounded-lg border-b-4 border-[#DC2626] bg-red-50 p-2">&lt;11.5</span><span className="rounded-lg border-b-4 border-[#D97706] bg-amber-50 p-2">11.5–12.4</span><span className="rounded-lg border-b-4 border-[#16A34A] bg-green-50 p-2">≥12.5</span></div>{muac!==undefined&&muac>=3&&muac<=65&&<p className="mt-2 text-sm">{tr('Example band:','अभ्यास का स्तर:')} {muac<11.5?tr('Red','लाल'):muac<12.5?tr('Amber','पीला'):tr('Green','हरा')}</p>}</aside>}
    </section>
    <section className="panel p-4 sm:p-6"><h2 className="text-xl font-bold">{tr('Signs noticed today','आज दिखे लक्षण')}</h2><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{signKeys[role].map(key=>{const wire=symptomWire(key),on=symptoms.includes(wire),Icon=icons[key];return <button type="button" key={key} onClick={()=>setSymptoms(s=>on?s.filter(x=>x!==wire):[...s,wire])} aria-pressed={on} data-testid={`chip-symptom-${wire}`} className={`flex min-h-[52px] items-center gap-3 rounded-xl border-2 p-3 text-left font-bold ${on?'border-primary bg-accent text-primary':'border-border bg-white'}`}><Icon size={22} className="shrink-0"/>{signText(key,lang)}{on&&<span className="ml-auto" aria-hidden="true">✓</span>}</button>;})}</div></section>
    <div className="panel p-3"><div role="alert" className={error?'mb-2 text-sm font-bold text-red-800':'hidden'}>{localizeMessage(error,lang)}</div><button type="button" onClick={()=>void submit()} disabled={(!symptoms.length&&!fields.some(k=>vitals[k]))||busy||syncing} data-testid="button-analyse" className="tap tap-primary w-full gap-2">{busy?<Loader2 className="animate-spin" size={18}/>:!online?<CloudOff size={18}/>:null}{online?tr('Analyse visit','जाँच का नतीजा देखें'):tr('Save offline and see result','फ़ोन पर सहेजें और नतीजा देखें')}</button></div>
  </div>;
}
