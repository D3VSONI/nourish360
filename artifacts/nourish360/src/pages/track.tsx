import { useEffect, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, Loader2, PhoneOutgoing, Route } from 'lucide-react';
import { getGetAmbulanceQueryKey, useGetAmbulance, useTriggerFamilyCall } from '@workspace/api-client-react';
import { VillageMap } from '@/components/village-map';
import { Call108 } from '@/components/shell';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/lib/store';

export default function Track() {
  const { id = '' } = useParams<{ id: string }>();
  const {ready,record,online} = useApp();
  const q = useGetAmbulance(id, { query: { enabled: !!id && ready && online, queryKey: [...getGetAmbulanceQueryKey(id),record?.patient.health_id], refetchInterval: 8000 } });
  const call = useTriggerFamilyCall();
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());
  const [checked, setChecked] = useState<number[]>([]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  if (!ready || q.isLoading) return <div className="mx-auto max-w-5xl space-y-4 px-4 py-8"><div className="h-[45vh] animate-pulse rounded-[2rem] bg-muted" /><div className="h-40 animate-pulse rounded-[2rem] bg-muted" /></div>;
  if (!online || q.isError || !q.data) return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-display text-3xl font-semibold">{online ? 'Simulation not available' : 'Reconnect to view tracking'}</h1>
      <p className="mt-2 text-muted-foreground">If this is a real emergency, do not wait.</p>
      <Call108 className="mt-6 justify-center" />
      {online && <button onClick={() => q.refetch()} className="mt-4 block w-full text-sm underline" data-testid="button-retry-track">Retry</button>}
    </div>
  );

  const b = q.data;
  const start = new Date(b.created_at).getTime();
  const total = Math.max(b.eta_seconds + Math.max(0, Math.floor((q.dataUpdatedAt - start) / 1000)), 1);
  const left = Math.max(0, b.eta_seconds - Math.max(0, Math.floor((now - q.dataUpdatedAt) / 1000)));
  const progress = Math.min(1, Math.max(0, 1 - left / total));
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground" data-testid="link-back-home"><ArrowLeft className="h-4 w-4" /> Home</Link>
      <div className="mt-3 rounded-2xl border-2 border-dashed border-[hsl(var(--tier-red)/.6)] bg-[hsl(var(--tier-red)/.06)] p-4 text-sm" data-testid="text-sim-warning">
        <b>Simulation.</b> No ambulance has been dispatched and no driver is coming. For a real emergency, call 108 now.
        <Call108 className="mt-3 w-full justify-center sm:ml-3 sm:mt-0 sm:w-auto" />
      </div>

      <section className="relative mt-4 overflow-hidden rounded-[2rem] border">
        <VillageMap route={b.route} pickup={{ lat: b.pickup_lat, lng: b.pickup_lng }} destination={{ lat: b.destination.lat, lng: b.destination.lng, name: b.destination.name }} progress={progress} className="h-[46vh] min-h-[300px] w-full" />
        <div className="absolute left-3 top-3 z-[500] rounded-2xl bg-card/95 p-4 shadow-lg backdrop-blur">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Simulated arrival · {b.status.replace('_', ' ')}</p>
          <p className="font-display text-4xl font-semibold tabular-nums text-primary" data-testid="text-eta">{left ? `${mm}:${ss}` : 'Arrived'}</p>
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.3fr]">
        <section className="rounded-[2rem] border bg-card p-5">
          <p className="font-mono text-xs text-muted-foreground">Booking {b.booking_code}</p>
          <p className="font-mono text-2xl font-semibold" data-testid="text-vehicle">{b.ambulance_number}</p>
          <p className="text-sm">Fictional crew: {b.driver_name} · {b.driver_phone}</p>
          <p className="mt-3 text-sm"><b>{b.emergency_type}</b> · pickup {b.pickup_village}</p>
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold"><Route className="h-4 w-4" /> To {b.destination.name}</p>
          {b.bypassed_facilities.map((x) => <p key={x.name} className="mt-1 text-xs text-muted-foreground">Passed {x.name} ({x.distance_km} km): {x.reason}</p>)}
          <button onClick={() => call.mutate({ id: b.id }, { onSuccess: (r) => {
            if ('speechSynthesis' in window) {
              const message = new SpeechSynthesisUtterance('This is a Nourish360 demo alert. No ambulance was sent. In a real emergency, call one zero eight.');
              message.lang = 'en-IN';
              window.speechSynthesis.speak(message);
            }
            toast({ title: 'Family call simulated', description: r.message });
          }, onError: () => toast({ title: 'Could not simulate call' }) })}
            disabled={call.isPending} data-testid="button-family-call"
            className="press mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {call.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOutgoing className="h-4 w-4" />} Simulate family voice call
          </button>
        </section>
        <section className="rounded-[2rem] border bg-card p-5">
          <h2 className="font-display text-2xl font-semibold">While you wait</h2>
          <p className="text-xs text-muted-foreground">General guidance from the demo service. Follow the 108 call-taker's instructions first.</p>
          <ol className="mt-4 space-y-2">
            {b.guide.map((g, i) => (
              <li key={i} className="rounded-2xl bg-background p-3 text-sm" data-testid={`text-guide-${i}`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input className="mt-1 h-4 w-4 shrink-0 accent-primary" type="checkbox" checked={checked.includes(i)}
                    onChange={() => setChecked(old => old.includes(i) ? old.filter(n => n !== i) : [...old, i])} />
                  <span>{g}</span>
                </label>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
