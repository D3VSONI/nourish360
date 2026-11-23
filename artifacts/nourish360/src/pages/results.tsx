import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { CloudOff, Loader2, Plus, Route, Siren, Volume2, VolumeX } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useRequestReview, type PatientType, type RiskTier, type Visit } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { useApp } from '@/lib/store';
import { Call108 } from '@/components/shell';
import { TIER_STYLE } from '@/components/demo-bar';
import { useToast } from '@/hooks/use-toast';
import { villages } from '@workspace/nourish-logic';
import { useSaveDrill } from '@/lib/booking';
import { ActiveDrills } from '@/components/active-drills';

const HEAD: Record<RiskTier, { title: string; line: string }> = {
  GREEN: { title: 'No warning flags in this demo', line: 'The limited demo rules found no warning flags. This does not rule out a health concern.' },
  AMBER: { title: 'Concerning. Needs review.', line: 'Subtle changes were flagged. A clinician should look at this.' },
  RED: { title: 'Critical demo flags', line: 'This example shows an urgent referral. In a real emergency, call 108 now.' },
};
const SERIES: Record<PatientType, { key: string; label: string; color: string }[]> = {
  CHILD: [{ key: 'weight_kg', label: 'Weight kg', color: 'hsl(var(--chart-1))' }, { key: 'muac_cm', label: 'MUAC cm', color: 'hsl(var(--chart-3))' }, { key: 'temp_c', label: 'Temp °C', color: 'hsl(var(--chart-2))' }],
  PREGNANT_LADY: [{ key: 'bp_sys', label: 'BP sys', color: 'hsl(var(--chart-1))' }, { key: 'bp_dia', label: 'BP dia', color: 'hsl(var(--chart-5))' }, { key: 'hb', label: 'Hb', color: 'hsl(var(--chart-2))' }],
  MOTHER: [{ key: 'bp_sys', label: 'BP sys', color: 'hsl(var(--chart-1))' }, { key: 'hb', label: 'Hb', color: 'hsl(var(--chart-2))' }, { key: 'temp_c', label: 'Temp °C', color: 'hsl(var(--chart-3))' }],
};

function speak(text: string, onEnd: () => void) {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'hi-IN'; u.rate = 0.9; u.onend = onEnd; u.onerror = onEnd;
  const v = window.speechSynthesis.getVoices().find((x) => x.lang.startsWith('hi'));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
  return true;
}

export default function Results() {
  const { record, queue, ready, openEmergency, online } = useApp();
  const [,navigate] = useLocation();
  const review = useRequestReview();
  const book = useSaveDrill();
  const { toast } = useToast();
  const [speaking, setSpeaking] = useState<number | null>(null);

  if (!ready) return <div className="mx-auto max-w-5xl space-y-4 px-4 py-10"><div className="h-40 animate-pulse rounded-[2rem] bg-muted" /><div className="h-72 animate-pulse rounded-[2rem] bg-muted" /></div>;
  if (!record || !record.visits.length) return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="phulkari mx-auto mb-6 h-20 w-20 rounded-3xl" />
      <h1 className="font-display text-3xl font-semibold">No visits yet</h1>
      <p className="mt-2 text-muted-foreground">Record a first check-up to see the trend and outlook.</p>
      <Link href={record ? '/assess' : '/'} className="press mt-6 inline-block rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground" data-testid="link-start-visit">{record ? 'Start a visit' : 'Choose a role'}</Link>
    </div>
  );

  const { patient } = record;
  const visits = [...record.visits].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const v: Visit = visits[visits.length - 1];
  const pending = new Set(queue.map((q) => q.mutation_id));
  const isLocal = pending.has(v.id);
  const chart = visits.map((x) => ({ date: format(new Date(x.created_at), 'd MMM'), ...x.vitals }));

  const askReview = () => review.mutate({ id: v.id }, {
    onSuccess: (r) => toast({ title: 'Tele-review requested (demo)', description: r.message }),
    onError: () => toast({ title: 'Request failed', description: 'Try again once online.' }),
  });
  const startDrill = () => {
    const text = v.symptoms.join(' ').toLowerCase();
    const emergency_type = /bleed|blood loss|soaking|pad/.test(text) ? 'Excessive bleeding' :
      /seizur|headache|blurred/.test(text) || (v.vitals.bp_sys ?? 0) >= 160 || (v.vitals.bp_dia ?? 0) >= 110 ? 'Seizures or very high BP' :
      /fever|breath/.test(text) ? 'High fever or breathing difficulty' : 'Other urgent concern';
    const village = villages.find(x => x.name.toLowerCase() === patient.village.toLowerCase());
    if (!online || !village) { openEmergency({patient_type:patient.patient_type, emergency_type, village:village?.name}); return; }
    void book.save({patient_type:patient.patient_type,emergency_type,pickup_village:village.name}).then(booking=>{
      toast({title:'Saved to Database',description:'Demo drill only. No ambulance was sent.'});
      navigate(`/track/${booking.id}`);
    }).catch(e=>toast({title:'Simulation could not start',description:e.message}));
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{patient.health_id} · {patient.village} · {patient.masked_phone}</p>
          <h1 className="font-display text-4xl font-semibold" data-testid="text-patient-name">{patient.full_name}</h1>
        </div>
        <Link href="/assess" className="press inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-medium hover:border-primary" data-testid="link-new-visit"><Plus className="h-4 w-4" /> New visit</Link>
      </div>
      <ActiveDrills />

      <section className={`rise mt-6 overflow-hidden rounded-[2rem] ${TIER_STYLE[v.risk_tier]}`} data-testid="banner-risk">
        <div className="phulkari p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-widest opacity-90">
            <span className="rounded-full bg-black/15 px-2.5 py-1">{v.risk_tier}</span>
            <span>{format(new Date(v.created_at), 'd MMM yyyy, HH:mm')}</span>
            {isLocal && <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1"><CloudOff className="h-3 w-3" /> On-device result, pending sync</span>}
          </div>
          <h2 className="font-display mt-3 text-4xl font-semibold md:text-5xl">{HEAD[v.risk_tier].title}</h2>
          <p className="mt-2 max-w-xl opacity-90">{HEAD[v.risk_tier].line}</p>
          {v.triggered_rules.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">{v.triggered_rules.map((r, i) => <li key={i} className="rounded-full bg-black/15 px-3 py-1 text-sm" data-testid={`text-rule-${i}`}>{r}</li>)}</ul>
          )}
          <p className="mt-4 text-sm font-medium" data-testid="text-next-step">Next: {v.next_step}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {v.risk_tier === 'RED' && <>
              <Call108 className="bg-white !text-[hsl(var(--tier-red))]" />
              <button onClick={startDrill} disabled={book.isPending} data-testid="button-dispatch-sim"
                className="press inline-flex items-center gap-2 rounded-full border border-white/60 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{book.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Siren className="h-4 w-4" />}{online ? 'Start ambulance drill (simulation)' : 'Open offline checklist'}</button>
            </>}
            {v.risk_tier === 'AMBER' && (
              <button onClick={askReview} disabled={review.isPending || isLocal || !online} data-testid="button-request-review"
                className="press inline-flex items-center gap-2 rounded-full bg-[hsl(285_38%_14%)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {review.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{isLocal ? 'Review available after sync' : 'Request PHC tele-review (demo)'}
              </button>
            )}
          </div>
        </div>
        {v.routed_facility && (
          <div className="border-t border-black/10 bg-black/10 p-5 text-sm" data-testid="panel-referral">
            <p className="flex items-center gap-2 font-semibold"><Route className="h-4 w-4" /> Suggested facility: {v.routed_facility.facility.name} · {v.routed_facility.facility.distance_km} km</p>
            {v.routed_facility.bypassed.map((b) => <p key={b.name} className="mt-1 opacity-85">Passed {b.name} ({b.distance_km} km): {b.reason}</p>)}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rise rounded-[2rem] border bg-card p-5 md:p-6" style={{ animationDelay: '.1s' }}>
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-2xl font-semibold">Past vs present</h3>
            <span className="rounded-full bg-muted px-3 py-1 font-mono text-xs" data-testid="text-trend">{v.trend}</span>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {SERIES[patient.patient_type].map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm">{v.trend_details.map((t, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{t}</li>)}</ul>
        </section>

        <section className="rise rounded-[2rem] border bg-card p-5 md:p-6" style={{ animationDelay: '.16s' }}>
          <h3 className="font-display text-2xl font-semibold">Next six months</h3>
          <p className="text-xs text-muted-foreground">Rule-based projection if today's trend continues. Not a prediction of fact.</p>
          {v.six_month_forecast.length === 0 ? (
            <p className="phulkari mt-4 rounded-2xl border p-5 text-sm">No added risk projected. Keep routine visits.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {v.six_month_forecast.map((f, i) => (
                <article key={i} className="rounded-2xl border bg-background p-4" data-testid={`card-forecast-${i}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{f.condition}</p>
                      <p className="font-mono text-[11px] uppercase text-muted-foreground">{f.probability_level} · {f.timeline}</p>
                    </div>
                    <button aria-label="Read in Hindi" data-testid={`button-speak-${i}`}
                      onClick={() => { if (speaking === i) { window.speechSynthesis.cancel(); setSpeaking(null); return; } if (speak(f.hindi, () => setSpeaking(null))) setSpeaking(i); else toast({ title: 'Voice not supported on this device' }); }}
                      className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                      {speaking === i ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-foreground/75">{f.clinical_reason}</p>
                  <p className="mt-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">{f.preventive_action}</p>
                  <p className="mt-2 text-sm text-primary" lang="hi">{f.hindi}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-[2rem] border bg-card p-5">
        <h3 className="font-display text-xl font-semibold">Visit history</h3>
        <ol className="mt-3 divide-y">
          {[...visits].reverse().map((x) => (
            <li key={x.id} className="flex items-center gap-3 py-2.5 text-sm" data-testid={`row-visit-${x.id}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${TIER_STYLE[x.risk_tier].split(' ')[0]}`} />
              <span className="font-mono text-xs">{format(new Date(x.created_at), 'd MMM yyyy')}</span>
              <span className="flex-1 truncate text-muted-foreground">{x.symptoms.join(', ') || 'No danger signs'}</span>
              {pending.has(x.id) && <span className="font-mono text-[10px] uppercase text-[hsl(var(--tier-amber))]">queued</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
