import { useState } from 'react';
import { useLocation } from 'wouter';
import { Download, Loader2, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import { exportRecord, useEndSession, useEraseRecord } from '@workspace/api-client-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useApp } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

export function PrivacyDrawer() {
  const { privacyOpen, setPrivacyOpen, record, queue, forgetLocal, online } = useApp();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const erase = useEraseRecord();
  const end = useEndSession();
  const [exporting, setExporting] = useState(false);
  const [confirm, setConfirm] = useState('');
  const hid = record?.patient.health_id;

  const download = async () => {
    if (!hid) return;
    setExporting(true);
    try {
      const data = await exportRecord(hid);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = `${hid}-export.json`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Export failed', description: 'Check your connection and try again.' });
    } finally { setExporting(false); }
  };

  const doErase = () => {
    if (!hid) return;
    erase.mutate({ healthId: hid }, {
      onSuccess: async (r) => {
        const cleared = await forgetLocal().then(() => true, () => false);
        setConfirm(''); setPrivacyOpen(false); navigate('/');
        toast({ title: 'Record erased', description: cleared ? r.message : `${r.message} This browser could not clear local storage. Clear site data on the device.` });
      },
      onError: () => toast({ title: 'Erase failed', description: 'Nothing was removed. Try again online.' }),
    });
  };

  const signOut = () => {
    end.mutate(undefined, {
      onSuccess: async () => {
        const cleared = await forgetLocal().then(() => true, () => false);
        setPrivacyOpen(false); navigate('/');
        if (!cleared) toast({ title: 'Signed out', description: 'This browser could not clear its local copy. Clear site data on the device.' });
      },
      onError: () => toast({ title: 'Could not sign out', description: 'Reconnect and try again.' }),
    });
  };

  return (
    <Drawer open={privacyOpen} onOpenChange={setPrivacyOpen}>
      <DrawerContent className="bg-card">
        <div className="mx-auto w-full max-w-lg px-5 pb-8">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle className="font-display flex items-center gap-2 text-2xl"><ShieldCheck className="h-6 w-6 text-[hsl(var(--tier-green))]" /> Your data, your say</DrawerTitle>
            <DrawerDescription>DPDP Act 2023 rights for this synthetic demo profile: see it, take it, or erase it.</DrawerDescription>
          </DrawerHeader>
          {!record ? (
            <div className="phulkari rounded-2xl border p-6 text-center text-sm text-muted-foreground">No profile on this device. Nothing stored, nothing to erase.</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border bg-background p-4 font-mono text-xs" data-testid="text-privacy-summary">
                <div>{hid}</div>
                <div className="text-muted-foreground">{record.patient.masked_phone} · {record.visits.length} visits · {queue.length} waiting to sync</div>
              </div>
              <button onClick={download} disabled={exporting || !online} data-testid="button-export" className="press flex w-full items-center gap-3 rounded-2xl border p-4 text-left hover:bg-muted disabled:opacity-50">
                {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5 text-primary" />}
                <span><b className="block">Download my record</b><span className="text-xs text-muted-foreground">JSON with visits, consent and audit trail</span></span>
              </button>
              <button onClick={signOut} disabled={end.isPending || !online} data-testid="button-sign-out" className="press flex w-full items-center gap-3 rounded-2xl border p-4 text-left hover:bg-muted disabled:opacity-50">
                <LogOut className="h-5 w-5" /><span><b className="block">Sign out & clear this device</b><span className="text-xs text-muted-foreground">Server record stays; local copy and queue are removed</span></span>
              </button>
              <div className="rounded-2xl border border-[hsl(var(--tier-red)/.4)] p-4">
                <p className="flex items-center gap-2 font-semibold text-[hsl(var(--tier-red))]"><Trash2 className="h-4 w-4" /> Erase permanently</p>
                <p className="mt-1 text-xs text-muted-foreground">Type ERASE to confirm. This anonymises the record on the server.</p>
                <div className="mt-3 flex gap-2">
                  <input value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} placeholder="ERASE" data-testid="input-erase-confirm" className="min-w-0 flex-1 rounded-xl border bg-background px-3 font-mono text-sm" />
                  <button onClick={doErase} disabled={confirm !== 'ERASE' || erase.isPending || !online} data-testid="button-erase" className="press rounded-xl bg-[hsl(var(--tier-red))] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                    {erase.isPending ? 'Erasing' : 'Erase'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
