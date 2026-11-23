import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  analyzeVisit,
  getSession,
  syncVisits,
  type AssessmentInput,
  type PatientRecord,
  type PatientType,
  type Visit,
} from '@workspace/api-client-react';
import { analyzeOffline, clearOffline, readOffline, saveOffline } from '@/lib/offline';

export type EmergencyPrefill = { patient_type?: PatientType; emergency_type?: string; village?: string };

type Ctx = {
  record: PatientRecord | null;
  queue: AssessmentInput[];
  online: boolean;
  syncing: boolean;
  ready: boolean;
  role: PatientType | null;
  setRole: (r: PatientType) => void;
  adoptRecord: (r: PatientRecord) => Promise<void>;
  submitAssessment: (input: AssessmentInput) => Promise<{ visit: Visit; offline: boolean }>;
  syncNow: () => Promise<void>;
  forgetLocal: () => Promise<void>;
  emergencyOpen: boolean;
  emergencyPrefill: EmergencyPrefill;
  openEmergency: (p?: EmergencyPrefill) => void;
  closeEmergency: () => void;
  privacyOpen: boolean;
  setPrivacyOpen: (v: boolean) => void;
};

const AppCtx = createContext<Ctx | null>(null);
const ROLE_KEY = 'n360.role';

export function AppProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [queue, setQueue] = useState<AssessmentInput[]>([]);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [ready, setReady] = useState(false);
  const [role, setRoleState] = useState<PatientType | null>(() => (localStorage.getItem(ROLE_KEY) as PatientType | null) ?? null);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyPrefill, setPrefill] = useState<EmergencyPrefill>({});
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const recRef = useRef<PatientRecord | null>(null);
  const queueRef = useRef<AssessmentInput[]>([]);
  const syncingRef = useRef(false);
  const submittingRef = useRef(false);

  const update = useCallback((r: PatientRecord | null, q: AssessmentInput[]) => {
    recRef.current = r;
    queueRef.current = q;
    setRecord(r);
    setQueue(q);
  }, []);

  const persist = useCallback(async (r: PatientRecord | null, q: AssessmentInput[], required = false) => {
    try { await saveOffline(r, q); } catch {
      if (required) throw new Error('This browser could not save the assessment offline. Keep the form open and reconnect.');
    }
    update(r, q);
  }, [update]);

  const setRole = useCallback((r: PatientType) => {
    try { localStorage.setItem(ROLE_KEY, r); } catch { /* in-memory role still works */ }
    setRoleState(r);
  }, []);

  const adoptRecord = useCallback(async (r: PatientRecord) => {
    setRole(r.patient.patient_type);
    const same = recRef.current?.patient.health_id === r.patient.health_id;
    const queued = same ? queueRef.current : [];
    const pending = new Set(queued.map(v => v.mutation_id));
    const visible = new Set(r.visits.map(v => v.id));
    const local = same ? (recRef.current?.visits ?? []).filter(v => pending.has(v.id) && !visible.has(v.id)) : [];
    await persist({ ...r, visits: [...r.visits, ...local] }, queued);
  }, [persist, setRole]);

  const syncNow = useCallback(async () => {
    const rec = recRef.current;
    if (!rec || !navigator.onLine || syncingRef.current || submittingRef.current) return;
    const id = rec.patient.health_id;
    const current = () => recRef.current?.patient.health_id === id;
    const req = () => ({ headers: { 'x-nourish-record': id }, signal: AbortSignal.timeout(8500) });
    syncingRef.current = true;
    setSyncing(true);
    try {
      let fresh = await getSession(req());
      if (!current() || fresh.patient.health_id !== id) return;
      while (current() && queueRef.current.length) {
        const res = await syncVisits({ visits: queueRef.current.slice(0, 50) }, req());
        if (!current() || !res.synced_ids.length) return;
        const synced = new Set(res.synced_ids);
        const kept = new Map((recRef.current?.visits ?? []).map(v => [v.id,v]));
        res.visits.forEach(v => kept.set(v.id, v));
        await persist({ ...fresh, visits: [...kept.values()].sort((a,b) => a.created_at.localeCompare(b.created_at)) }, queueRef.current.filter(v => !synced.has(v.mutation_id)));
        const server = new Map(fresh.visits.map(v => [v.id, v]));
        res.visits.forEach(v => server.set(v.id, v));
        fresh = { ...fresh, visits: [...server.values()].sort((a,b) => a.created_at.localeCompare(b.created_at)) };
      }
      if (current()) await persist(fresh, queueRef.current);
    } catch { /* Keep queued visits. The sync control allows a manual retry. */ }
    finally { syncingRef.current = false; setSyncing(false); }
  }, [persist]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { record: r, queue: q } = await readOffline();
        if (alive && !recRef.current) update(r, q);
      } catch { /* empty */ }
      if (navigator.onLine) {
        try {
          const s = await getSession({signal:AbortSignal.timeout(6000)});
          if (alive) await adoptRecord(s);
        } catch (error) {
          if (alive && (error as {status?:number})?.status === 401 && !queueRef.current.length) await persist(null, []);
        }
      }
      if (alive) { setReady(true); if (queueRef.current.length) void syncNow(); }
    })();
    return () => { alive = false; };
  }, [adoptRecord, persist, syncNow, update]);

  useEffect(() => {
    const on = () => { setOnline(true); void syncNow(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const retry = window.setInterval(() => { if (queueRef.current.length && navigator.onLine) void syncNow(); }, 30_000);
    return () => { window.clearInterval(retry); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [syncNow]);

  const submitAssessment = useCallback(async (input: AssessmentInput) => {
    const rec = recRef.current;
    if (!rec) throw new Error('No active synthetic profile.');
    if (syncingRef.current || submittingRef.current) throw new Error('Wait for the current save or sync to finish.');
    const id = rec.patient.health_id;
    submittingRef.current = true;
    try {
      if (navigator.onLine && !queueRef.current.length) {
        try {
          const visit = await analyzeVisit(input, { headers: { 'x-nourish-record': id }, signal: AbortSignal.timeout(6500) });
          if (recRef.current?.patient.health_id !== id) throw new Error('The active profile changed.');
          const kept = rec.visits.filter(v => v.id !== visit.id);
          await persist({ ...rec, visits: [...kept, visit] }, queueRef.current);
          return { visit, offline: false };
        } catch (error) {
          const err = error as {status?:number;data?:{error?:string};name?:string};
          if (err.status && err.status < 500) throw new Error(err.data?.error ?? 'The assessment could not be saved.');
          if (!err.status && err.name !== 'TypeError' && err.name !== 'TimeoutError' && err.name !== 'AbortError') throw error;
        }
      }
      if (recRef.current?.patient.health_id !== id) throw new Error('The active profile changed.');
      const visit = analyzeOffline(rec.patient, input, rec.visits);
      await persist({ ...rec, visits: [...rec.visits, visit] }, [...queueRef.current, input], true);
      return { visit, offline: true };
    } finally { submittingRef.current = false; }
  }, [persist]);

  const forgetLocal = useCallback(async () => {
    update(null, []);
    setRoleState(null);
    await clearOffline();
    try { localStorage.removeItem(ROLE_KEY); localStorage.removeItem('n360.draft'); } catch { /* storage disabled */ }
  }, [update]);

  const openEmergency = useCallback((p?: EmergencyPrefill) => { setPrefill(p ?? {}); setEmergencyOpen(true); }, []);
  const closeEmergency = useCallback(() => setEmergencyOpen(false), []);

  return (
    <AppCtx.Provider value={{ record, queue, online, syncing, ready, role, setRole, adoptRecord, submitAssessment, syncNow, forgetLocal, emergencyOpen, emergencyPrefill, openEmergency, closeEmergency, privacyOpen, setPrivacyOpen }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}

export const ROLE_META: Record<PatientType, { label: string; hindi: string; sub: string; slug: string }> = {
  CHILD: { label: 'Child', hindi: 'शिशु', sub: '0 to 5 years. Growth, nutrition and danger-sign triage.', slug: 'child' },
  PREGNANT_LADY: { label: 'Pregnant lady', hindi: 'गर्भवती', sub: 'Antenatal checks and high-risk pregnancy flags.', slug: 'pregnant' },
  MOTHER: { label: 'Mother', hindi: 'माँ', sub: 'After delivery. Recovery, bleeding and fever watch.', slug: 'mother' },
};

export const slugToRole = (s?: string): PatientType | null =>
  (Object.keys(ROLE_META) as PatientType[]).find((k) => ROLE_META[k].slug === s) ?? null;
