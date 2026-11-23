import { Link } from 'wouter';
import { Siren } from 'lucide-react';
import { useGetActiveDrills, useGetAmbulance } from '@workspace/api-client-react';
import { useApp } from '@/lib/store';
import { lastGuestDrill } from '@/lib/booking';

export function ActiveDrills() {
  const {record,ready,online} = useApp();
  const id = record?.patient.health_id;
  const guestId = !id && ready ? lastGuestDrill() : undefined;
  const current = useGetActiveDrills({request:{headers:id?{'x-nourish-record':id}:undefined},query:{
    queryKey:['active-drills',id],enabled:!!id && ready && online,refetchInterval:15000,
  }});
  const guest = useGetAmbulance(guestId ?? '',{query:{enabled:!!guestId && online,refetchInterval:15000}});
  if (!online) return null;
  if (id && current.isError) return <p className="mt-4 text-sm text-muted-foreground" role="status">Couldn’t load active drills. <button className="underline" onClick={()=>void current.refetch()}>Retry</button></p>;
  const drills = id ? (current.data?.drills ?? []) : (guest.data && guest.data.status!=='ARRIVED' ? [guest.data] : []);
  if (!drills.length) return null;
  return <section className="mt-5 rounded-2xl border bg-card p-4" aria-label="Active ambulance drills">
    <h2 className="font-semibold">Active ambulance drills</h2>
    {drills.map(drill=><Link key={drill.id} href={`/track/${drill.id}`} className="mt-2 flex w-fit items-center gap-2 text-sm font-semibold text-primary hover:underline" data-testid="link-active-drill">
      <Siren className="h-4 w-4"/> Resume simulated tracking · {drill.pickup_village}
    </Link>)}
  </section>;
}
