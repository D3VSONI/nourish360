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
import { acknowledgeOffline, analyzeOffline, clearOffline, readOffline, readPending, rememberVerification, saveOffline, sharedRecordKey, verifiedOfflineId } from '@/lib/offline';
import { validateAssessment } from '@workspace/nourish-logic';
import { useToast } from '@/hooks/use-toast';
import { local,saved as savedLabel,useLang } from '@/lib/i18n';

export type EmergencyPrefill = { patient_type?: PatientType; emergency_type?: string; village?: string };

type Ctx = {
  record: PatientRecord | null;
  queue: AssessmentInput[];
  online: boolean;
  forcedOffline: boolean;
  toggleOffline: () => void;
  syncing: boolean;
  syncError: string;
  ready: boolean;
  role: PatientType | null;
  setRole: (r: PatientType) => void;
  adoptRecord: (r: PatientRecord) => Promise<void>;
  submitAssessment: (input: AssessmentInput) => Promise<{ visit: Visit; offline: boolean }>;
  syncNow: () => Promise<void>;
  forgetLocal: (erase?: boolean) => Promise<void>;
  emergencyOpen: boolean;
  emergencyPrefill: EmergencyPrefill;
  openEmergency: (p?: EmergencyPrefill) => void;
  closeEmergency: () => void;
  privacyOpen: boolean;
  setPrivacyOpen: (v: boolean) => void;
};

const AppCtx = createContext<Ctx | null>(null);
const ROLE_KEY = 'n360.role';
const OFFLINE_KEY = 'n360.demo-offline';
function initialOffline(){try{return sessionStorage.getItem(OFFLINE_KEY)==='true';}catch{return false;}}

const sortVisits = (visits:Visit[]) => visits.sort((a,b)=>a.created_at.localeCompare(b.created_at));
function mergePending(record:PatientRecord,pending:Awaited<ReturnType<typeof readPending>>) {
  const merged = new Map(record.visits.map(v=>[v.mutation_id ?? v.id,v]));
  pending.forEach(p=>{ if (!merged.has(p.input.mutation_id)) merged.set(p.input.mutation_id,p.visit); });
  return {...record,visits:sortVisits([...merged.values()])};
}
export function errorMessage(error:unknown,fallback:string) {
  const e=error as {data?:{error?:string};message?:string}|undefined;
  return e?.data?.error ?? fallback;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [queue, setQueue] = useState<AssessmentInput[]>([]);
  const [physicalOnline, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [forcedOffline,setForcedOffline]=useState(initialOffline);
  const offlineRef=useRef(forcedOffline);
  const online=physicalOnline&&!forcedOffline;
  const [syncing, setSyncing] = useState(false);
  const [ready, setReady] = useState(false);
  const [role, setRoleState] = useState<PatientType | null>(() => (localStorage.getItem(ROLE_KEY) as PatientType | null) ?? null);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyPrefill, setPrefill] = useState<EmergencyPrefill>({});
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [syncError,setSyncError] = useState('');
  const {toast} = useToast();
  const {lang}=useLang();
  const langRef=useRef(lang);
  langRef.current=lang;
  const recRef = useRef<PatientRecord | null>(null);
  const revision = useRef(0);
  const syncingRef = useRef(false);
  const submittingRef = useRef(false);

  const update = useCallback((r: PatientRecord | null, q: AssessmentInput[]) => {
    recRef.current = r;
    setRecord(r);
    setQueue(q);
  }, []);

  const setRole = useCallback((r: PatientType) => {
    try { localStorage.setItem(ROLE_KEY, r); } catch { /* in-memory role still works */ }
    setRoleState(r);
  }, []);

  const adoptRecord = useCallback(async (r: PatientRecord) => {
    const rev = ++revision.current;
    if (!r.patient.is_demo) throw new Error('Only synthetic sample profiles may be opened.');
    const id = r.patient.health_id;
    if (recRef.current?.patient.health_id!==id) update(null,[]);
    rememberVerification(id);
    setSyncError('');
    let pending: Awaited<ReturnType<typeof readPending>> = [];
    try { pending = await readPending(id); await saveOffline(r); }
    catch { if (rev===revision.current) setSyncError('Local storage is unavailable. Offline changes cannot be saved on this device.'); }
    if (rev!==revision.current) return;
    setRole(r.patient.patient_type);
    update(mergePending(r,pending),pending.map(p=>p.input));
  }, [setRole,update]);

  const forgetLocal = useCallback(async (erase=false) => {
    const id = recRef.current?.patient.health_id ?? verifiedOfflineId();
    ++revision.current;
    rememberVerification(null);
    update(null, []);
    setRoleState(null);
    setSyncError('');
    if (id) await clearOffline(id,erase);
    try { localStorage.removeItem(ROLE_KEY); localStorage.removeItem('n360.draft'); } catch { /* storage disabled */ }
  }, [update]);

  const syncNow = useCallback(async () => {
    const rec = recRef.current;
    if (!rec || !navigator.onLine || offlineRef.current || syncingRef.current || submittingRef.current) return;
    const id = rec.patient.health_id;
    const rev = revision.current;
    const current = () => revision.current===rev && recRef.current?.patient.health_id === id;
    const req = () => ({ headers: { 'x-nourish-record': id }, signal: AbortSignal.timeout(8500) });
    syncingRef.current = true;
    setSyncing(true);
    setSyncError('');
    try {
      let fresh = await getSession(req());
      if (!current() || fresh.patient.health_id !== id) return;
      rememberVerification(id);
      let pending = await readPending(id);
      let saved = false;
      while (current() && !offlineRef.current && navigator.onLine && pending.length) {
        const res = await syncVisits({ visits: pending.slice(0, 50).map(p=>p.input) }, req());
        if (!current()) return;
        if (!res.synced_ids.length) throw new Error('No offline assessments were acknowledged.');
        const server = new Map(fresh.visits.map(v=>[v.id,v]));
        res.visits.forEach(v=>server.set(v.id,v));
        fresh = {...fresh,visits:[...server.values()]};
        await acknowledgeOffline(fresh,res.synced_ids);
        pending = await readPending(id);
        if (current()) update(mergePending(fresh,pending),pending.map(p=>p.input));
        saved = true;
      }
      if (!current()) return;
      await saveOffline(fresh);
      if (!current()) return;
      update(mergePending(fresh,pending),pending.map(p=>p.input));
      if (saved) toast({title:local(savedLabel,langRef.current),description:local(['Offline assessments synced.','ऑफ़लाइन जाँचें भेज दी गईं।'],langRef.current)});
    } catch (error) {
      if (!current()) return;
      const status=(error as {status?:number})?.status;
      if (status===401 || status===403 || status===409) {
        ++revision.current;
        rememberVerification(null);
        update(null,[]);
        setSyncError('Sign in to the same profile to sync its queued assessments.');
      } else {
        setSyncError(errorMessage(error,'Sync did not finish. Offline assessments remain on this device.'));
      }
    } finally { syncingRef.current = false; setSyncing(false); }
  }, [toast,update]);

  useEffect(() => {
    let alive = true;
    const rev = revision.current;
    async function reopenOffline() {
      const id = verifiedOfflineId();
      if (!id) return;
      const cached = await readOffline(id);
      const pending = await readPending(id);
      if (cached && alive && revision.current===rev && verifiedOfflineId()===id) {
        setRole(cached.patient.patient_type);
        update(mergePending(cached,pending),pending.map(p=>p.input));
      }
    }
    (async () => {
      try {
        if (navigator.onLine && !offlineRef.current) {
          const session = await getSession({signal:AbortSignal.timeout(6000)});
          if (alive && revision.current===rev) await adoptRecord(session);
        } else await reopenOffline();
      } catch (error) {
        if (!alive || revision.current!==rev) return;
        const e = error as {status?:number;name?:string};
        if ([401,403].includes(e.status ?? 0)) rememberVerification(null);
        else if (!e.status && ['TypeError','TimeoutError','AbortError'].includes(e.name ?? '')) {
          // Wi-Fi may be connected even when the API is unreachable.
          await reopenOffline().catch(() => undefined);
        }
      } finally { if (alive) setReady(true); }
    })();
    return () => { alive = false; };
  }, [adoptRecord,setRole,update]);

  useEffect(() => {
    const on = () => { setOnline(true); void syncNow(); };
    const off = () => setOnline(false);
    const focus = () => { if (recRef.current && navigator.onLine) void syncNow(); };
    const changed = (event:StorageEvent) => {
      if (event.key!==sharedRecordKey || !recRef.current || event.newValue===recRef.current.patient.health_id) return;
      ++revision.current;
      rememberVerification(null);
      update(null,[]);
      setSyncError('This browser’s active profile changed in another tab. Sign in again here.');
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('focus',focus);
    window.addEventListener('storage',changed);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('focus',focus); window.removeEventListener('storage',changed); };
  }, [syncNow,update]);
  const activeId = record?.patient.health_id;
  const queuedCount = queue.length;
  useEffect(() => {
    if (!ready || !online || !activeId || !queuedCount) return;
    void syncNow();
    const retry=window.setInterval(syncNow,30_000);
    return ()=>window.clearInterval(retry);
  }, [activeId,online,queuedCount,ready,syncNow]);

  const submitAssessment = useCallback(async (input: AssessmentInput) => {
    const rec = recRef.current;
    if (!rec) throw new Error('No active synthetic profile.');
    if (syncingRef.current || submittingRef.current) throw new Error('Wait for the current save or sync to finish.');
    const invalid = validateAssessment(input);
    if (invalid) throw new Error(invalid);
    const id = rec.patient.health_id;
    const rev = revision.current;
    const current = () => revision.current===rev && recRef.current?.patient.health_id===id;
    submittingRef.current = true;
    try {
      const pending = await readPending(id).catch(() => []);
      if (!current()) throw new Error('The active profile changed.');
      if (navigator.onLine && !offlineRef.current && !pending.length) {
        try {
          const visit = await analyzeVisit(input,{headers:{'x-nourish-record':id},signal:AbortSignal.timeout(6500)});
          if (!current()) throw new Error('The active profile changed.');
          const fresh = {...rec,visits:sortVisits([...rec.visits.filter(v=>v.id!==visit.id && (v.mutation_id ?? v.id)!==input.mutation_id),visit])};
          await saveOffline(fresh).catch(() => undefined);
          if (!current()) throw new Error('The active profile changed.');
          update(fresh,[]);
          return {visit,offline:false};
        } catch (error) {
          const err = error as {status?:number;name?:string};
          if (err.status && err.status<500) {
            if ([401,403,409].includes(err.status) && current()) {
              ++revision.current;
              rememberVerification(null);
              update(null,[]);
              setSyncError('The assessment was not sent. Sign in to the correct profile and retry.');
            }
            throw new Error(errorMessage(error,'The assessment could not be saved.'));
          }
          if (!err.status && !['TypeError','TimeoutError','AbortError'].includes(err.name ?? '')) throw error;
        }
      }
      if (!current()) throw new Error('The active profile changed.');
      const prior = rec.visits.filter(v=>v.id!==input.mutation_id);
      const visit = analyzeOffline(rec.patient,input,prior);
      const next = {healthId:id,input,visit};
      const pendingIds = new Set(pending.map(p=>p.input.mutation_id));
      try { await saveOffline({...rec,visits:prior.filter(v=>v.mutation_id || !pendingIds.has(v.id))},next); }
      catch { throw new Error('This browser could not save the assessment offline. Keep the form open and reconnect.'); }
      if (!current()) throw new Error('The assessment was saved on this device. Reopen its profile to sync it.');
      const combined = [...pending.filter(p=>p.input.mutation_id!==input.mutation_id),next];
      update(mergePending({...rec,visits:prior},combined),combined.map(p=>p.input));
      return {visit,offline:true};
    } finally { submittingRef.current = false; }
  }, [update]);

  const openEmergency = useCallback((p?: EmergencyPrefill) => { setPrefill(p ?? {}); setEmergencyOpen(true); }, []);
  const closeEmergency = useCallback(() => setEmergencyOpen(false), []);
  const toggleOffline=useCallback(()=>{
    const next=!offlineRef.current;
    offlineRef.current=next;
    setForcedOffline(next);
    try { sessionStorage.setItem(OFFLINE_KEY,String(next)); } catch { /* stays active in memory */ }
    if (next || !navigator.onLine) return;
    if (recRef.current) { void syncNow();return; }
    const rev=revision.current;
    void getSession({signal:AbortSignal.timeout(6000)}).then(r=>{
      if(revision.current===rev&&!offlineRef.current) return adoptRecord(r);
      return undefined;
    }).catch(()=>undefined);
  },[adoptRecord,syncNow]);

  return (
    <AppCtx.Provider value={{ record, queue, online, forcedOffline,toggleOffline,syncing, syncError, ready, role, setRole, adoptRecord, submitAssessment, syncNow, forgetLocal, emergencyOpen, emergencyPrefill, openEmergency, closeEmergency, privacyOpen, setPrivacyOpen }}>
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
