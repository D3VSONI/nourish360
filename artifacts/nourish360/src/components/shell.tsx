import { type ReactNode } from 'react';
import { Link } from 'wouter';
import { CloudOff, Phone, RefreshCw, ShieldCheck, Siren, Wifi } from 'lucide-react';
import { useApp } from '@/lib/store';
import { EmergencySheet } from '@/components/emergency-sheet';
import { PrivacyDrawer } from '@/components/privacy-drawer';
import { cn } from '@/lib/utils';

export function Call108({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <a
      href="tel:108"
      data-testid="link-call-108"
      className={cn(
        'press relative isolate inline-flex items-center gap-2 rounded-full bg-[hsl(var(--tier-red))] px-4 py-2.5 font-semibold text-[hsl(var(--destructive-foreground))] shadow-[0_6px_18px_-6px_hsl(var(--tier-red)/.7)]',
        className,
      )}
    >
      <span className="beacon relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
      <Phone className="h-4 w-4" />
      {compact ? 'Call 108' : 'Real emergency? Call 108'}
    </a>
  );
}

export function SyncBadge() {
  const { online, queue, syncing, syncError, syncNow } = useApp();
  return (
    <button
      onClick={() => void syncNow()}
      disabled={!online || syncing}
      data-testid="status-sync"
      className={cn(
        'press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors',
        online ? 'border-[hsl(var(--tier-green)/.35)] bg-[hsl(var(--tier-green)/.08)] text-[hsl(var(--tier-green))]' : 'border-[hsl(var(--tier-amber)/.5)] bg-[hsl(var(--tier-amber)/.12)] text-[hsl(30_70%_30%)]',
      )}
      title={syncError || (online ? 'Tap to sync now' : 'Offline. Assessments are kept on this device.')}
    >
      {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : online ? <Wifi className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
      {online ? (queue.length ? `${queue.length} to sync` : 'Online') : `Offline${queue.length ? ` · ${queue.length} queued` : ''}`}
    </button>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { openEmergency, setPrivacyOpen, syncError } = useApp();
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="border-b border-[hsl(var(--tier-amber)/.4)] bg-[hsl(var(--secondary)/.25)] px-4 py-1.5 text-center font-mono text-[11px] tracking-wide text-foreground/80" data-testid="text-demo-notice">
        DEMO ONLY · synthetic records · not a medical diagnosis · ambulance tracking is a simulation
      </div>
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5" data-testid="link-home">
            <span className="phulkari grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <span className="font-display text-lg font-bold">N</span>
            </span>
            <span className="leading-none">
              <span className="font-display block text-xl font-semibold text-primary">Nourish360</span>
              <span className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Sonipat · demo</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block"><SyncBadge /></div>
            <button
              onClick={() => setPrivacyOpen(true)}
              data-testid="button-open-privacy"
              className="press hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted md:inline-flex"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--tier-green))]" /> DPDP controls
            </button>
            <button
              onClick={() => openEmergency()}
              data-testid="button-open-emergency"
              className="press inline-flex items-center gap-1.5 rounded-full border-2 border-[hsl(var(--tier-red))] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[hsl(var(--tier-red))] hover:bg-[hsl(var(--tier-red)/.08)]"
            >
              <Siren className="h-4 w-4" /> <span className="hidden sm:inline">Ambulance</span> drill
            </button>
            <Call108 compact className="text-sm" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2 sm:hidden">
          <SyncBadge />
          <button onClick={() => setPrivacyOpen(true)} data-testid="button-open-privacy-mobile" className="inline-flex items-center gap-1 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5" /> DPDP
          </button>
        </div>
      </header>
      <main>
        {syncError && <p role="status" className="mx-auto max-w-6xl px-4 pt-2 text-sm text-muted-foreground">{syncError}</p>}
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-16 text-xs text-muted-foreground">
        <div className="phulkari mb-6 h-2 rounded-full opacity-70" />
        Nourish360 uses invented profiles and illustrative Sonipat locations. It does not diagnose, treat or dispatch. In any emergency, dial <a href="tel:108" className="font-semibold text-[hsl(var(--tier-red))] underline">108</a>.
      </footer>
      <EmergencySheet />
      <PrivacyDrawer />
    </div>
  );
}
