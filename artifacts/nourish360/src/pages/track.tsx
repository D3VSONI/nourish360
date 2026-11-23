import { useEffect,useState } from 'react';
import { Link,useParams } from 'wouter';
import { ArrowLeft,Clock,Loader2,PhoneOutgoing,Route,TriangleAlert } from 'lucide-react';
import { getGetAmbulanceQueryKey,useGetAmbulance,useTriggerFamilyCall } from '@workspace/api-client-react';
import { VillageMap } from '@/components/village-map';
import { Call108 } from '@/components/shell';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/lib/store';
import { useLang,villageName } from '@/lib/i18n';
import { bypassReason,scenarioKey,scenarioText } from '@/lib/emergency-copy';
import { EmergencyGuide } from '@/components/emergency-guide';
import { Listen } from '@/components/listen';

export default function Track(){
  const {id=''}=useParams<{id:string}>();const {ready,record,online,openEmergency}=useApp();const {tr,lang}=useLang();
  const q=useGetAmbulance(id,{query:{enabled:!!id&&ready&&online,queryKey:[...getGetAmbulanceQueryKey(id),record?.patient.health_id],refetchInterval:8000}});
  const call=useTriggerFamilyCall();const {toast}=useToast();const [now,setNow]=useState(Date.now()),[played,setPlayed]=useState<string>();
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
  if(!ready||q.isLoading)return <div className="mx-auto max-w-5xl animate-pulse p-6"><div className="h-[340px] rounded-3xl bg-muted"/></div>;
  if(!q.data||q.error&&[401,403,404].includes((q.error as {status?:number}).status??0))return <div className="mx-auto max-w-lg px-4 py-10"><div className="panel"><h1 className="text-2xl font-extrabold">{online?tr('Practice not available','अभ्यास उपलब्ध नहीं'):tr('Reconnect for tracking','ट्रैकिंग के लिए नेटवर्क जोड़ें')}</h1><div className="mt-4 flex flex-wrap gap-2"><Call108 testId="link-call-108-track-empty"/>{online?<button type="button" onClick={()=>void q.refetch()} className="tap" data-testid="button-retry-track">{tr('Retry','फिर कोशिश करें')}</button>:<button type="button" onClick={()=>openEmergency()} className="tap">{tr('Offline checklist','ऑफ़लाइन सूची')}</button>}</div></div></div>;
  const b=q.data;const start=Date.parse(b.created_at);const total=Math.max(b.eta_seconds+Math.max(0,Math.floor((q.dataUpdatedAt-start)/1000)),1);
  const left=Math.max(0,b.eta_seconds-Math.max(0,Math.floor((now-q.dataUpdatedAt)/1000)));const progress=Math.min(1,Math.max(0,1-left/total));
  const eta=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;
  const live=online&&!q.isError;const status=left===0?tr('Arrived in practice','अभ्यास में पहुँच गई'):b.status==='DISPATCHED'?tr('Practice started','अभ्यास शुरू'):tr('Moving in the drill','अभ्यास में रास्ते पर');
  const familyMessage=tr('This is a Notion360 practice alert. No ambulance was sent. In a real emergency call 108.','यह Notion360 के अभ्यास की सूचना है। कोई एम्बुलेंस नहीं भेजी गई। असली इमरजेंसी में 108 मिलाएँ।');
  return <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
    <Link href="/" className="tap gap-2" data-testid="link-back-home"><ArrowLeft size={19}/>{tr('Home','मुख्य पेज')}</Link>
    <div className="zone zone-red flex flex-wrap items-center justify-between gap-3 p-4" data-testid="text-sim-warning"><div><h1 className="text-xl font-extrabold">{tr('Simulation only','सिर्फ अभ्यास')}</h1><p className="text-sm">{tr('No ambulance has been sent. The route and crew are fictional.','कोई एम्बुलेंस नहीं भेजी गई। रास्ता और टीम काल्पनिक हैं।')}</p></div><Call108 testId="link-call-108-track"/></div>
    <section className="relative isolate overflow-hidden rounded-3xl border-2 border-primary/40 bg-accent">
      <VillageMap route={b.route} pickup={{lat:b.pickup_lat,lng:b.pickup_lng}} destination={{lat:b.destination.lat,lng:b.destination.lng,name:villageName(b.destination.name,lang)}} progress={progress} showTiles={live} className="h-[350px] w-full"/>
      <div className="absolute left-3 top-3 z-[500] max-w-[75%] rounded-xl border bg-white p-3 shadow"><p className="flex items-center gap-1 text-xs font-bold text-primary"><Clock size={16}/>{tr('Practice countdown','अभ्यास में बाकी समय')}</p><p className="mt-1 text-3xl font-extrabold tabular-nums" data-testid="text-eta">{left?eta:tr('Arrived','पहुँच गई')}</p><p className="text-xs font-bold">{status}</p></div>
      {!live&&<p className="absolute bottom-6 left-3 z-[500] max-w-[85%] rounded-lg border bg-white p-2 text-xs font-bold">{tr('Offline diagram · countdown uses the last update','ऑफ़लाइन नक्शा · समय पिछली जानकारी पर आधारित है')}</p>}
    </section>
    <div className="grid gap-4 md:grid-cols-2"><section className="panel p-4">
      <h2 className="text-lg font-extrabold">{tr('Practice vehicle and route','अभ्यास की गाड़ी और रास्ता')}</h2><p className="mt-1 font-mono text-sm">{b.booking_code}</p><p className="mt-1 font-mono text-xl font-bold" data-testid="text-vehicle">{b.ambulance_number}</p><p className="mt-1 text-sm">{tr('Fictional crew: Ravi Kumar','काल्पनिक चालक: रवि कुमार')} · {b.driver_phone}</p>
      <p className="mt-3 text-sm">{scenarioText(scenarioKey(b.emergency_type),lang)} · {villageName(b.pickup_village,lang)}</p><p className="mt-3 flex items-center gap-2 font-bold"><Route size={21} className="shrink-0 text-primary"/>{villageName(b.destination.name,lang)} · {b.destination.distance_km} {tr('km','किमी')}</p>
      {b.bypassed_facilities.map(f=><div key={f.name} className="mt-2 rounded-xl border border-amber-400 bg-amber-50 p-2 text-sm"><p className="flex items-center gap-2 font-bold"><TriangleAlert size={17} className="shrink-0"/>{tr('Bypassed','यह केंद्र छोड़ा')} · {villageName(f.name,lang)} · {f.distance_km} {tr('km','किमी')}</p><p className="mt-1">{bypassReason(f.reason,lang)}</p></div>)}
      <button type="button" onClick={()=>call.mutate({id:b.id},{onSuccess:()=>{setPlayed(b.id);toast({title:tr('Practice family alert logged. No call placed.','अभ्यास की सूचना दर्ज हुई। कोई कॉल नहीं गई।')});},onError:()=>toast({title:tr('Could not log the practice alert','अभ्यास की सूचना दर्ज नहीं हुई')})})} disabled={!live||call.isPending} className="tap mt-4 w-full gap-2" data-testid="button-family-call">{call.isPending?<Loader2 size={18} className="animate-spin"/>:<PhoneOutgoing size={18}/>} {tr('Simulate family alert','परिवार को सूचना देने का अभ्यास')}</button>
      {played===b.id&&<div className="mt-2"><Listen text={familyMessage}/></div>}
    </section><EmergencyGuide key={b.id} role={b.patient_type} offline={!live}/></div>
  </div>;
}
