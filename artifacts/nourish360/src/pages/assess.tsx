import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { CloudOff, Loader2 } from 'lucide-react';
import type { AssessmentInput, PatientType, Vitals } from '@workspace/api-client-react';
import { useApp, ROLE_META } from '@/lib/store';
import { cn } from '@/lib/utils';
import { clearDraft, readDraft, saveDraft } from '@/lib/offline';
import { useToast } from '@/hooks/use-toast';

type VField = { key: keyof Vitals; label: string; unit: string; step?: string };
const VITALS: Record<PatientType, VField[]> = {
  CHILD: [
    { key: 'resp_rate', label: 'Breaths per minute', unit: '/min' },
    { key: 'temp_c', label: 'Temperature', unit: '°C', step: '0.1' },
    { key: 'muac_cm', label: 'MUAC', unit: 'cm', step: '0.1' },
    { key: 'weight_kg', label: 'Current weight', unit: 'kg', step: '0.1' },
  ],
  PREGNANT_LADY: [
    { key: 'bp_sys', label: 'BP systolic', unit: 'mmHg' },
    { key: 'bp_dia', label: 'BP diastolic', unit: 'mmHg' },
    { key: 'hb', label: 'Haemoglobin', unit: 'g/dL', step: '0.1' },
    { key: 'weight_kg', label: 'Current weight', unit: 'kg', step: '0.1' },
  ],
  MOTHER: [
    { key: 'bp_sys', label: 'BP systolic', unit: 'mmHg' },
    { key: 'bp_dia', label: 'BP diastolic', unit: 'mmHg' },
    { key: 'hb', label: 'Haemoglobin', unit: 'g/dL', step: '0.1' },
    { key: 'temp_c', label: 'Temperature', unit: '°C', step: '0.1' },
  ],
};
export const SYMPTOMS: Record<PatientType, string[]> = {
  CHILD: ['Fast or difficult breathing', 'High fever', 'Cold body', 'Unable to drink or breastfeed', 'Vomiting everything', 'Lethargic or unconscious', 'Umbilical redness or pus'],
  PREGNANT_LADY: ['Severe headache', 'Blurred vision or flashes', 'Sudden swelling of face or hands', 'Vaginal bleeding', 'Reduced or absent fetal movement', 'Severe abdominal pain'],
  MOTHER: ['Soaking more than one pad per hour', 'High fever or chills', 'Foul-smelling discharge', 'Severe dizziness or fainting', 'Breast engorgement or pain'],
};
export default function Assess() {
  const { record, submitAssessment, online, ready, syncing } = useApp();
  const [, navigate] = useLocation();
  const role = record?.patient.patient_type;
  const [vitals, setVitals] = useState<Record<string, string>>({});
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [error, setError] = useState('');
  const submitted = useRef(false);
  const attempted = useRef<{key:string;input:AssessmentInput} | null>(null);
  const {toast} = useToast();
  const healthId = record?.patient.health_id;

  useEffect(() => {
    if (!healthId) return;
    let active = true;
    submitted.current = false;
    void readDraft(healthId).catch(() => undefined).then(d => {
      if (!active) return;
      setVitals(d?.vitals ?? {});
      setSymptoms(d?.symptoms ?? []);
      attempted.current = d?.attempt ?? null;
      setLoaded(healthId);
    });
    return () => { active = false; };
  }, [healthId]);
  useEffect(() => {
    if (!healthId || loaded !== healthId || submitted.current || busy) return;
    void saveDraft(healthId,vitals,symptoms,attempted.current ?? undefined).catch(() => undefined);
  }, [vitals, symptoms, healthId, loaded, busy]);

  if (!ready || (healthId && loaded !== healthId)) return <div className="mx-auto max-w-3xl space-y-3 px-4 py-10">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-3xl bg-muted" />)}</div>;
  if (!record || !role) return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="phulkari mx-auto mb-6 h-20 w-20 rounded-3xl" />
      <h1 className="font-display text-3xl font-semibold">No one selected yet</h1>
      <p className="mt-2 text-muted-foreground">Register a synthetic profile or load a demo case first.</p>
      <Link href="/" className="press mt-6 inline-block rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground" data-testid="link-choose-role">Choose a role</Link>
    </div>
  );

  const toggle = (s: string) => setSymptoms((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const submit = async () => {
    setError('');
    setBusy(true);
    const v: Vitals = {};
    for (const f of VITALS[role]) if (vitals[f.key]) v[f.key] = Number(vitals[f.key]);
    try {
      const key = JSON.stringify([record.patient.health_id,v,symptoms]);
      if (attempted.current?.key!==key) attempted.current={key,input:{ mutation_id:crypto.randomUUID(),vitals:v,symptoms,recorded_at:new Date().toISOString() }};
      await saveDraft(record.patient.health_id,vitals,symptoms,attempted.current).catch(()=>undefined);
      const {offline} = await submitAssessment(attempted.current.input);
      submitted.current = true;
      await clearDraft(record.patient.health_id).catch(() => undefined);
      toast({title:offline ? 'Saved Offline — Will Sync Automatically' : 'Saved to Database'});
      navigate('/results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this demo assessment.');
    } finally { setBusy(false); }
  };
  const any = symptoms.length > 0 || Object.values(vitals).some(Boolean);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <p className="font-mono text-xs uppercase tracking-[.2em] text-muted-foreground">{ROLE_META[role].label} · visit {record.visits.length + 1}</p>
      <h1 className="font-display mt-1 text-4xl font-semibold" data-testid="text-patient-name">{record.patient.full_name}</h1>
      <p className="font-mono text-xs text-muted-foreground">{record.patient.health_id} · {record.patient.village}</p>

      <section className="rise mt-8 rounded-[2rem] border bg-card p-5 md:p-6">
        <h2 className="font-display text-xl font-semibold">Measurements</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {VITALS[role].map((f) => (
            <label key={f.key} className="group rounded-2xl border bg-background p-3 transition focus-within:border-primary">
              <span className="text-xs text-muted-foreground">{f.label}</span>
              <span className="flex items-baseline gap-2">
                <input type="number" step={f.step ?? '1'} inputMode="decimal" value={vitals[f.key] ?? ''} onChange={(e) => setVitals((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-transparent font-mono text-2xl outline-none" placeholder="--" data-testid={`input-vital-${f.key}`} />
                <span className="font-mono text-xs text-muted-foreground">{f.unit}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rise mt-5 rounded-[2rem] border bg-card p-5 md:p-6" style={{ animationDelay: '.08s' }}>
        <h2 className="font-display text-xl font-semibold">Danger signs seen today</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {SYMPTOMS[role].map((s) => {
            const on = symptoms.includes(s);
            return (
              <button key={s} onClick={() => toggle(s)} aria-pressed={on} data-testid={`chip-symptom-${s}`}
                className={cn('press rounded-full border px-4 py-2 text-sm transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:border-primary/50')}>
                {s}
              </button>
            );
          })}
        </div>
      </section>

      <div className="sticky bottom-4 mt-6 rounded-[1.5rem] border bg-card/95 p-3 shadow-lg backdrop-blur">
        {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
        <button onClick={submit} disabled={!any || busy || syncing} data-testid="button-analyse"
          className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-semibold text-primary-foreground disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : !online && <CloudOff className="h-4 w-4" />}
          {online ? 'Analyse visit' : 'Analyse on this device (will sync later)'}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Draft saved on this device. Rule-based demo output, not a diagnosis.</p>
      </div>
    </div>
  );
}
