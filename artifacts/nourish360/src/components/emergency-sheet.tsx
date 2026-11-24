import { useEffect,useState } from 'react';
import { useLocation } from 'wouter';
import { Activity,Droplets,HeartPulse,Loader2,MapPin,Siren,Thermometer,TriangleAlert } from 'lucide-react';
import type { PatientType } from '@workspace/api-client-react';
import { villages } from '@workspace/nourish-logic';
import { Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle } from '@/components/ui/sheet';
import { useApp } from '@/lib/store';
import { Call108 } from '@/components/shell';
import { useSaveDrill } from '@/lib/booking';
import { local,localizeMessage,roleLabel,saved,useLang,villageName } from '@/lib/i18n';
import { scenarioKey,scenarios,scenarioText,scenarioWire,type Scenario } from '@/lib/emergency-copy';
import { useToast } from '@/hooks/use-toast';
import { EmergencyGuide } from './emergency-guide';

const roles:PatientType[]=['CHILD','PREGNANT_LADY','MOTHER'];
const icons={bleeding:Droplets,bp:Activity,breathing:Thermometer,labor:HeartPulse,alertness:TriangleAlert,other:Siren};
const chip=(on:boolean)=>`tap justify-start gap-2 text-start ${on?'border-primary bg-accent text-primary':'bg-white'}`;
export function EmergencySheet(){
  const {emergencyOpen,closeEmergency,emergencyPrefill,record,online}=useApp();const [,navigate]=useLocation();const book=useSaveDrill();const {lang,tr}=useLang();const {toast}=useToast();
  const [role,setRole]=useState<PatientType>('PREGNANT_LADY');const [scenario,setScenario]=useState<Scenario>('bleeding');const [village,setVillage]=useState('');const [stage,setStage]=useState<1|2>(1);
  useEffect(()=>{
    if(!emergencyOpen)return;
    setRole(emergencyPrefill.patient_type??record?.patient.patient_type??'PREGNANT_LADY');setScenario(emergencyPrefill.emergency_type?scenarioKey(emergencyPrefill.emergency_type):'bleeding');setVillage(emergencyPrefill.village??record?.patient.village??'');setStage(1);book.reset();
  },[emergencyOpen]); // Set defaults on opening, not while editing.
  const chosen=villages.some(v=>v.name===village);
  const submit=()=>{
    if(!online||!chosen)return;
    void book.save({patient_type:role,emergency_type:scenarioWire(scenario),pickup_village:village}).then(b=>{toast({title:local(saved,lang),description:tr('Practice only. No ambulance was sent.','सिर्फ अभ्यास। कोई एम्बुलेंस नहीं भेजी गई।')});closeEmergency();navigate(`/track/${b.id}`);}).catch(()=>undefined);
  };
  return <Sheet open={emergencyOpen} onOpenChange={o=>{if(!o)closeEmergency();}}>
    <SheetContent side="right" closeLabel={tr('Close','बंद करें')} className="w-full overflow-y-auto border-l-4 border-l-[#DC2626] bg-background p-4 sm:max-w-lg sm:p-6">
      <SheetHeader className="pe-10 text-left"><SheetTitle className="text-2xl font-extrabold">{tr('Ambulance practice drill','एम्बुलेंस का अभ्यास')}</SheetTitle><SheetDescription>{tr('Simulation only. No ambulance will be sent.','सिर्फ अभ्यास। कोई एम्बुलेंस नहीं भेजी जाएगी।')}</SheetDescription></SheetHeader>
      <Call108 className="mt-3 w-full" testId="link-call-108-sheet"/>
      <div className="mt-4 space-y-4">
      {stage===1||!online?<>
        <fieldset><legend className="mb-2 font-extrabold">{tr('1 · Who needs help?','1 · किसे मदद चाहिए?')}</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{roles.map(r=><button key={r} type="button" aria-pressed={role===r} className={chip(role===r)} data-testid={`button-etype-patient-${r}`} onClick={()=>setRole(r)}>{roleLabel(r,lang)}</button>)}</div></fieldset>
        {online&&<><fieldset><legend className="mb-2 font-extrabold">{tr('What is happening?','क्या हो रहा है?')}</legend><div className="grid grid-cols-2 gap-2">{(Object.keys(scenarios) as Scenario[]).map(k=>{const Icon=icons[k];return <button key={k} type="button" aria-pressed={scenario===k} className={chip(scenario===k)} data-testid={`button-emergency-${scenarioWire(k)}`} onClick={()=>setScenario(k)}><Icon size={20} className="shrink-0"/>{scenarioText(k,lang)}</button>;})}</div></fieldset><button type="button" className="tap tap-primary w-full" data-testid="button-drill-next" onClick={()=>setStage(2)}>{tr('Choose pickup village','गाँव चुनें')}</button></>}
      </>:<>
        <fieldset><legend className="mb-2 font-extrabold">{tr('2 · Sample pickup village','2 · नमूना गाँव')}</legend><div className="grid grid-cols-2 gap-2">{villages.map(v=><button key={v.name} type="button" aria-pressed={village===v.name} className={chip(village===v.name)} data-testid={`button-village-${v.name}`} onClick={()=>setVillage(v.name)}><MapPin size={18} className="shrink-0"/>{villageName(v.name,lang)}</button>)}</div></fieldset>
        {book.error&&<p role="alert" className="zone zone-red p-3 font-bold">{localizeMessage(book.error,lang)}</p>}
        <div className="flex flex-wrap gap-2"><button type="button" className="tap" onClick={()=>setStage(1)}>{tr('Back','वापस')}</button><button type="button" disabled={!chosen||book.isPending} className="tap tap-primary flex-1 gap-2" data-testid="button-start-simulation" onClick={submit}>{book.isPending&&<Loader2 size={18} className="animate-spin"/>}{tr('Start simulated tracking','अभ्यास की ट्रैकिंग शुरू करें')}</button></div>
      </>}
      {!online&&<><p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold">{tr('Practice tracking needs a connection. Call 108 for real help.','अभ्यास की ट्रैकिंग के लिए नेटवर्क चाहिए। असली मदद के लिए 108 मिलाएँ।')}</p><EmergencyGuide key={role} role={role} offline/></>}
      </div>
    </SheetContent>
  </Sheet>;
}
