import { useCallback, useRef, useState } from 'react';
import { bookAmbulance, type BookingInput } from '@workspace/api-client-react';
import { errorMessage,useApp } from './store';

const guestKey = 'n360.guest-drill';
export function lastGuestDrill(): string | undefined {
  try { return sessionStorage.getItem(guestKey) ?? undefined; } catch { return undefined; }
}
export function useSaveDrill() {
  const {record} = useApp();
  const owner = record?.patient.health_id;
  const [isPending,setPending] = useState(false);
  const [error,setError] = useState('');
  const busy = useRef(false);
  const last = useRef<{fingerprint:string;id:string} | null>(null);
  const save = useCallback(async (data:Omit<BookingInput,'mutation_id'>) => {
    if (busy.current) throw new Error('A demo drill is already being saved.');
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const fingerprint = JSON.stringify([owner,data.patient_type,data.emergency_type,data.pickup_village]);
      const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint));
      const storageKey = `n360.drill-retry:${Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}`;
      let id = last.current?.fingerprint === fingerprint ? last.current.id : undefined;
      try { id ??= sessionStorage.getItem(storageKey) ?? undefined; } catch { /* in-memory retry still works */ }
      id ??= crypto.randomUUID();
      last.current = {fingerprint,id};
      try { sessionStorage.setItem(storageKey,id); } catch { /* in-memory retry still works */ }
      const booking = await bookAmbulance({...data,mutation_id:id},{
        headers:owner ? {'x-nourish-record':owner} : undefined,
        signal:AbortSignal.timeout(8500),
      });
      last.current = null;
      try {
        sessionStorage.removeItem(storageKey);
        if (!owner) sessionStorage.setItem(guestKey,booking.id);
      } catch { /* confirmed by server */ }
      return booking;
    } catch (e) {
      const message=errorMessage(e,'Simulation could not be saved. Retry the same drill, or call 108 in a real emergency.');
      setError(message);
      throw new Error(message);
    } finally { busy.current=false; setPending(false); }
  },[owner]);
  return {save,isPending,error,reset:()=>setError('')};
}
