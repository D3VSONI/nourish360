import { useLocation } from 'wouter';
import { Loader2,Sparkles } from 'lucide-react';
import { useGetCatalog,useStartDemo,type RiskTier } from '@workspace/api-client-react';
import { useApp } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { roleLabel,useLang,villageName } from '@/lib/i18n';

export const TIER_STYLE:Record<RiskTier,string>={GREEN:'bg-[#16A34A]',AMBER:'bg-[#D97706]',RED:'bg-[#DC2626]'};
export function DemoBar(){
  const {adoptRecord,online}=useApp();const {tr,lang}=useLang();const catalog=useGetCatalog({query:{enabled:online}});const start=useStartDemo();const [,navigate]=useLocation();const {toast}=useToast();
  const pick=(id:string)=>start.mutate({data:{health_id:id}},{onSuccess:async r=>{await adoptRecord(r);navigate(r.visits.length?'/results':'/assess');},onError:()=>toast({title:tr('Demo could not open. Try again.','डेमो नहीं खुला। फिर कोशिश करें।')})});
  return <section className="panel border-dashed p-4" data-testid="panel-demo"><h2 className="flex items-center gap-2 text-lg font-bold text-primary"><Sparkles size={20}/>{tr('Try a demo record','डेमो रिकॉर्ड खोलें')}</h2><p className="mt-1 text-sm text-muted-foreground">{tr('Practice with three past visits.','तीन पुरानी जाँचों के साथ अभ्यास करें।')}</p>
    {!online&&<p className="mt-2 text-sm font-bold">{tr('Connect to open a new demo.','नया डेमो खोलने के लिए नेटवर्क जोड़ें।')}</p>}
    {catalog.isLoading?<div className="mt-3 h-[52px] animate-pulse rounded-xl bg-muted"/>:catalog.isError?<button type="button" className="tap mt-3" disabled={!online} onClick={()=>void catalog.refetch()} data-testid="button-retry-demo">{tr('Could not load demos. Retry','डेमो नहीं मिले। फिर कोशिश करें')}</button>:<div className="mt-3 grid gap-2 sm:grid-cols-3">{catalog.data?.demo_cases.map(c=><button key={c.health_id} type="button" disabled={!online||start.isPending} onClick={()=>pick(c.health_id)} data-testid={`button-demo-${c.health_id}`} className="tap min-w-0 justify-start text-start"><span aria-hidden="true" className={`h-8 w-2 shrink-0 rounded-full ${TIER_STYLE[c.risk_tier]}`}/><span><strong className="block text-sm">{roleLabel(c.patient_type,lang)}</strong><span className="block text-xs text-muted-foreground">{c.health_id.slice(-4)} · {villageName(c.village,lang)}</span></span>{start.isPending&&start.variables?.data.health_id===c.health_id&&<Loader2 size={18} className="ml-auto animate-spin"/>}</button>)}</div>}
  </section>;
}
