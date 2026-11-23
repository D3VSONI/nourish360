import type { AssessmentInput, Patient, PatientRecord, Visit } from '@workspace/api-client-react';
import { evaluate } from '@workspace/nourish-logic';

const expiresIn = 12 * 60 * 60 * 1000;
const cacheKey = 'demo-session';
const table = 'state';
type CacheState = { record: PatientRecord | null; queue: AssessmentInput[] };
type Cached = CacheState & { expires: number };

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('nourish360-demo', 1);
    req.onupgradeneeded = () => req.result.createObjectStore(table);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function operation<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(table, mode);
      const req = action(tx.objectStore(table));
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = tx.onerror = () => reject(tx.error ?? req.error);
    });
  } finally { db.close(); }
}
export async function readOffline(): Promise<CacheState> {
  const state = (await operation('readonly',store => store.get(cacheKey))) as Cached | undefined;
  if (state?.record?.patient.is_demo && state.expires > Date.now()) return {record:state.record, queue:state.queue};
  if (state) await clearOffline();
  return {record:null,queue:[]};
}
export async function saveOffline(record: PatientRecord | null, queue: AssessmentInput[]): Promise<void> {
  if (!record?.patient.is_demo) { await clearOffline(); return; }
  await operation('readwrite',store => store.put({ record, queue, expires:Date.now()+expiresIn } satisfies Cached,cacheKey));
}
export async function clearOffline() { await operation('readwrite',store => store.clear()); }
export function analyzeOffline(patient: Patient,input:AssessmentInput,prior:Visit[]): Visit { return evaluate(patient,input,prior); }

export async function readDraft(healthId: string) {
  const draft = await operation('readonly',store => store.get(`draft:${healthId}`)) as {vitals:Record<string,string>; symptoms:string[]; expires:number}|undefined;
  if (draft && draft.expires > Date.now()) return draft;
  return undefined;
}
export async function saveDraft(healthId: string, vitals: Record<string,string>, symptoms: string[]) {
  await operation('readwrite',store => store.put({vitals,symptoms,expires:Date.now()+expiresIn},`draft:${healthId}`));
}
export async function clearDraft(healthId:string) { await operation('readwrite',store => store.delete(`draft:${healthId}`)); }
