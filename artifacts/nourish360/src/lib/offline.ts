import type { AssessmentInput, Patient, PatientRecord, Visit } from '@workspace/api-client-react';
import { evaluate } from '@workspace/nourish-logic';

const expiresIn = 12 * 60 * 60 * 1000;
const verifiedKey = 'n360.verified-demo-tab';
export const sharedRecordKey = 'n360.verified-demo-profile';
const table = 'state';
const outbox = 'assessments';
type Pending = { healthId:string; input:AssessmentInput; visit:Visit };
type Legacy = { record: PatientRecord | null; queue: AssessmentInput[] };
const profileKey = (id:string) => `profile:${id}`;

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('nourish360-demo', 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(table)) db.createObjectStore(table);
      const tx = req.transaction!;
      const queued = db.createObjectStore(outbox,{keyPath:['healthId','input.mutation_id']});
      queued.createIndex('profile','healthId');
      // Preserve old unsent visits without trusting the old cache as a signed-in session.
      const state = tx.objectStore(table);
      const old = state.get('demo-session');
      old.onsuccess = () => {
        const legacy = old.result as Legacy | undefined;
        if (legacy?.record?.patient.is_demo) {
          const record = legacy.record;
          const healthId = record.patient.health_id;
          const byId = new Map(record.visits.map(v => [v.id,v]));
          for (const input of legacy.queue ?? []) {
            queued.put({healthId,input,visit:byId.get(input.mutation_id) ?? evaluate(record.patient,input,record.visits)} satisfies Pending);
          }
        }
        state.delete('demo-session');
      };
    };
    req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(req.result); };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Close older Nourish360 tabs to enable local storage.'));
  });
}

async function run<T>(stores:string|string[],mode:IDBTransactionMode,action:(tx:IDBTransaction)=>IDBRequest<T>|void): Promise<T|undefined> {
  const db = await open();
  try {
    return await new Promise<T|undefined>((resolve,reject) => {
      const tx = db.transaction(stores,mode);
      const req = action(tx);
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Could not save data on this device.'));
    });
  } finally { db.close(); }
}

// A tab-local hint for reopening a previously verified synthetic record; it is not a credential.
export function verifiedOfflineId(): string | undefined {
  try {
    const x = JSON.parse(sessionStorage.getItem(verifiedKey) ?? 'null') as {id:string;expires:number}|null;
    if (x && x.expires>Date.now() && localStorage.getItem(sharedRecordKey)===x.id) return x.id;
  } catch { /* no verified offline record */ }
  return undefined;
}
export function rememberVerification(id:string | null) {
  try {
    if (id) {
      sessionStorage.setItem(verifiedKey,JSON.stringify({id,expires:Date.now()+expiresIn}));
      localStorage.setItem(sharedRecordKey,id);
    } else {
      const existing = JSON.parse(sessionStorage.getItem(verifiedKey) ?? 'null') as {id:string}|null;
      sessionStorage.removeItem(verifiedKey);
      if (existing && localStorage.getItem(sharedRecordKey)===existing.id) localStorage.removeItem(sharedRecordKey);
    }
  } catch { /* offline reopening unavailable in this tab */ }
}
export async function readOffline(id:string): Promise<PatientRecord|undefined> {
  const record = await run<PatientRecord>(table,'readonly',tx => tx.objectStore(table).get(profileKey(id)));
  return record?.patient.is_demo && record.patient.health_id===id ? record : undefined;
}
export async function readPending(id:string): Promise<Pending[]> {
  const pending = (await run<Pending[]>(outbox,'readonly',tx => tx.objectStore(outbox).index('profile').getAll(id))) ?? [];
  return pending.sort((a,b)=>a.visit.created_at.localeCompare(b.visit.created_at));
}
export async function saveOffline(record:PatientRecord,pending?:Pending) {
  if (!record.patient.is_demo) throw new Error('Only verified synthetic records can be cached.');
  await run([table,outbox],'readwrite',tx => {
    tx.objectStore(table).put(record,profileKey(record.patient.health_id));
    if (pending) tx.objectStore(outbox).put(pending);
  });
}
export async function acknowledgeOffline(record:PatientRecord,ids:string[]) {
  await run([table,outbox],'readwrite',tx => {
    tx.objectStore(table).put(record,profileKey(record.patient.health_id));
    for (const mutation of ids) tx.objectStore(outbox).delete([record.patient.health_id,mutation]);
  });
}
export async function clearOffline(id:string,erase=false) {
  await run([table,outbox],'readwrite',tx => {
    const state=tx.objectStore(table);
    state.delete(profileKey(id));
    state.delete(`draft:${id}`);
    if (!erase) return;
    const pending=tx.objectStore(outbox);
    const keys=pending.index('profile').getAllKeys(id);
    keys.onsuccess=()=>{ for (const key of keys.result) pending.delete(key); };
  });
}
export function analyzeOffline(patient: Patient,input:AssessmentInput,prior:Visit[]): Visit { return evaluate(patient,input,prior); }
type Attempt = {key:string;input:AssessmentInput};
export async function readDraft(healthId: string) {
  const draft = await run<{vitals:Record<string,string>;symptoms:string[];attempt?:Attempt;expires:number}>(table,'readonly',tx => tx.objectStore(table).get(`draft:${healthId}`));
  return draft && draft.expires > Date.now() ? draft : undefined;
}
export async function saveDraft(healthId: string, vitals: Record<string,string>, symptoms: string[],attempt?:Attempt) {
  await run(table,'readwrite',tx => tx.objectStore(table).put({vitals,symptoms,attempt,expires:Date.now()+expiresIn},`draft:${healthId}`));
}
export async function clearDraft(healthId:string) { await run(table,'readwrite',tx => tx.objectStore(table).delete(`draft:${healthId}`)); }
