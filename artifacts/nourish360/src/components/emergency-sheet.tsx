import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { AlertTriangle, Loader2, MapPin } from 'lucide-react';
import { useBookAmbulance, useGetCatalog, type PatientType } from '@workspace/api-client-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useApp, ROLE_META } from '@/lib/store';
import { Call108 } from '@/components/shell';
import { cn } from '@/lib/utils';
import { guides } from '@workspace/nourish-logic';

export const EMERGENCY_TYPES = [
  'Excessive bleeding',
  'Seizures or very high BP',
  'High fever or breathing difficulty',
  'Labour pain',
  'Unconscious or very drowsy',
  'Other urgent concern',
];

const chip = (on: boolean) =>
  cn('press rounded-xl border px-3 py-2.5 text-left text-sm transition-colors', on ? 'border-[hsl(var(--tier-red))] bg-[hsl(var(--tier-red)/.08)] font-semibold text-[hsl(var(--tier-red))]' : 'hover:bg-muted');

export function EmergencySheet() {
  const { emergencyOpen, closeEmergency, emergencyPrefill, record, online } = useApp();
  const [, navigate] = useLocation();
  const catalog = useGetCatalog();
  const book = useBookAmbulance();
  const [ptype, setPtype] = useState<PatientType>('PREGNANT_LADY');
  const [etype, setEtype] = useState(EMERGENCY_TYPES[0]);
  const [village, setVillage] = useState('');

  useEffect(() => {
    if (!emergencyOpen) return;
    setPtype(emergencyPrefill.patient_type ?? record?.patient.patient_type ?? 'PREGNANT_LADY');
    setEtype(emergencyPrefill.emergency_type ?? EMERGENCY_TYPES[0]);
    setVillage(emergencyPrefill.village ?? record?.patient.village ?? '');
    book.reset();
  }, [emergencyOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const villages = catalog.data?.villages ?? [];
  const chosen = villages.find((v) => v.name === village);

  const submit = () => {
    if (!chosen) return;
    book.mutate(
      { data: { patient_type: ptype, emergency_type: etype, pickup_village: chosen.name } },
      { onSuccess: (b) => { closeEmergency(); navigate(`/track/${b.id}`); } },
    );
  };

  return (
    <Sheet open={emergencyOpen} onOpenChange={(o) => !o && closeEmergency()}>
      <SheetContent side="right" className="w-full overflow-y-auto border-l-4 border-l-[hsl(var(--tier-red))] bg-card sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">Ambulance drill</SheetTitle>
          <SheetDescription>This starts a <b>simulation</b> only. No ambulance is sent. For a real emergency, call 108 now.</SheetDescription>
        </SheetHeader>
        <Call108 className="mt-4 w-full justify-center py-4 text-lg" />
        <div className="mt-6 space-y-5">
          <section>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">1 · Who</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ROLE_META) as PatientType[]).map((r) => (
                <button key={r} onClick={() => setPtype(r)} className={chip(ptype === r)} data-testid={`button-etype-patient-${r}`}>
                  <span className="block">{ROLE_META[r].label}</span>
                  <span className="text-xs opacity-70">{ROLE_META[r].hindi}</span>
                </button>
              ))}
            </div>
          </section>
          <section>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">2 · What is happening</p>
            <div className="grid gap-2">
              {EMERGENCY_TYPES.map((t) => (
                <button key={t} onClick={() => setEtype(t)} className={chip(etype === t)} data-testid={`button-emergency-${t}`}>{t}</button>
              ))}
            </div>
          </section>
          <section>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">3 · Demo village (preset point)</p>
            {catalog.isLoading ? (
              <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />)}</div>
            ) : catalog.isError ? (
              <button onClick={() => catalog.refetch()} className="text-sm underline" data-testid="button-retry-catalog">Could not load villages. Retry</button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {villages.map((v) => (
                  <button key={v.name} onClick={() => setVillage(v.name)} className={chip(village === v.name)} data-testid={`button-village-${v.name}`}>
                    <MapPin className="mr-1 inline h-3.5 w-3.5" />{v.name}
                  </button>
                ))}
              </div>
            )}
          </section>
          {book.isError && (
            <p className="flex items-center gap-2 rounded-xl bg-[hsl(var(--tier-red)/.1)] p-3 text-sm text-[hsl(var(--tier-red))]">
              <AlertTriangle className="h-4 w-4" /> Simulation could not start. Call 108 directly.
            </p>
          )}
          {!online && (
            <section className="rounded-2xl border bg-background p-4">
              <h3 className="font-semibold">Offline emergency checklist</h3>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                {guides[ptype].map((step) => <li key={step}>{step}</li>)}
              </ol>
            </section>
          )}
          <button
            onClick={submit}
            disabled={!chosen || book.isPending || !online}
            data-testid="button-start-simulation"
            className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 font-semibold text-background disabled:opacity-40"
          >
            {book.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {online ? 'Start tracking simulation' : 'Simulation needs a connection. Call 108'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
