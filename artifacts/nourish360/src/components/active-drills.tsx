import { Link } from 'wouter';
import { Siren } from 'lucide-react';
import { useGetActiveDrills, useGetAmbulance } from '@workspace/api-client-react';
import { useApp } from '@/lib/store';
import { useLang,villageName } from "@/lib/i18n";
import { lastGuestDrill } from '@/lib/booking';

export function ActiveDrills() {
  const {record,ready,online} = useApp();
  const {tr,lang}=useLang();
  const id = record?.patient.health_id;
  const guestId = !id && ready ? lastGuestDrill() : undefined;
  const current = useGetActiveDrills({request:{headers:id?{'x-nourish-record':id}:undefined},query:{
    queryKey:['active-drills',id],enabled:!!id && ready && online,refetchInterval:15000,
  }});
  const guest = useGetAmbulance(guestId ?? '',{query:{enabled:!!guestId && online,refetchInterval:15000}});
  if (!online) return null;
  if (id && current.isError) return <p className="mt-4 text-sm text-muted-foreground" role="status">{tr('Could not load active drills.','चल रहे अभ्यास नहीं मिले।')} <button className="tap" onClick={()=>void current.refetch()}>{tr('Retry','फिर कोशिश करें')}</button></p>;
  const drills = id ? (current.data?.drills ?? []) : (guest.data && guest.data.status!=='ARRIVED' ? [guest.data] : []);
  if (!drills.length) return null;
  return <section className="mt-5 rounded-2xl border bg-card p-4" aria-label={tr('Active ambulance drills','चल रहे एम्बुलेंस अभ्यास')}>
    <h2 className="font-semibold">{tr('Active ambulance drills','चल रहे एम्बुलेंस अभ्यास')}</h2>
    {drills.map(drill=><Link key={drill.id} href={`/track/${drill.id}`} className="tap mt-2 w-fit gap-2 text-primary" data-testid="link-active-drill">
      <Siren className="h-4 w-4"/> {tr('Resume simulated tracking','अभ्यास की ट्रैकिंग फिर खोलें')} · {villageName(drill.pickup_village,lang)}
    </Link>)}
  </section>;
}
