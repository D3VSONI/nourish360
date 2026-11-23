import { type ReactNode } from 'react';
import { Link } from 'wouter';
import { CloudOff, Phone, RefreshCw, ShieldCheck, Siren, Wifi, WifiOff } from 'lucide-react';
import { useApp } from '@/lib/store';
import { localizeMessage,useLang } from '@/lib/i18n';
import { EmergencySheet } from '@/components/emergency-sheet';
import { PrivacyDrawer } from '@/components/privacy-drawer';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/** Real emergency: always tel:108. Never a simulation. */
export function Call108({ className, compact, testId = 'link-call-108' }: { className?: string; compact?: boolean; testId?: string }) {
  const { tr } = useLang();
  return (
    <a
      href="tel:108"
      data-testid={testId}
      aria-label={tr('Real emergency: call 108 ambulance', 'असली आपातकाल: 108 एम्बुलेंस को कॉल करें')}
      className={cn('tap tap-red press relative isolate', className)}
    >
      <span className="beacon relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
      <Phone className="h-5 w-5" />
      {compact ? tr('Call 108', '108 कॉल') : tr('Real emergency? Call 108', 'असली इमरजेंसी? 108 मिलाएँ')}
    </a>
  );
}

export function SyncBadge({ testId = 'status-sync' }: { testId?: string }) {
  const { online, queue, syncing, syncError, syncNow } = useApp();
  const { tr,lang } = useLang();
  return (
    <button
      onClick={() => void syncNow()}
      disabled={!online || syncing}
      data-testid={testId}
      className={cn(
        'press inline-flex min-h-[52px] items-center gap-1.5 rounded-full border-2 px-3 text-sm font-semibold',
        online ? 'border-[hsl(var(--tier-green))] bg-[hsl(var(--tier-green)/.1)] text-[hsl(142_70%_22%)]' : 'border-[hsl(var(--tier-amber))] bg-[hsl(var(--tier-amber)/.12)] text-[hsl(26_80%_26%)]',
      )}
      title={localizeMessage(syncError,lang) || (online ? tr('Tap to sync now', 'अभी भेजें') : tr('Offline. Assessments are kept on this device.', 'ऑफ़लाइन। जाँच इसी फ़ोन पर सहेजी जाती है।'))}
    >
      {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : online ? <Wifi className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
      {online
        ? queue.length ? tr(`${queue.length} to sync`, `${queue.length} सिंक बाकी`) : tr('Online', 'ऑनलाइन')
        : tr('Offline', 'ऑफ़लाइन') + (queue.length ? ` · ${queue.length}` : '')}
    </button>
  );
}

function LangToggle() {
  const { lang, setLang } = useLang();
  const opt = (l: 'en' | 'hi', label: string) => (
    <button
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      data-testid={`button-lang-${l}`}
      lang={l}
      className={cn('min-h-[52px] rounded-full px-3 text-sm font-bold transition-colors', lang === l ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent')}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Language / भाषा" className="inline-flex items-center rounded-full border-2 border-foreground/80 bg-card p-0.5">
      {opt('en', 'English')}{opt('hi', 'हिंदी')}
    </div>
  );
}

function OfflineToggle() {
  const { forcedOffline, toggleOffline } = useApp();
  const { tr } = useLang();
  const { toast } = useToast();
  return (
    <button
      onClick={() => {
        toggleOffline();
        toast({ title: forcedOffline ? tr('Demo offline mode off', 'डेमो ऑफ़लाइन मोड बंद') : tr('Demo offline mode on', 'डेमो ऑफ़लाइन मोड चालू'), description: tr('Simulated network only. Your phone is unchanged.', 'सिर्फ़ अभ्यास नेटवर्क। फ़ोन पर कोई बदलाव नहीं।') });
      }}
      role="switch"
      aria-checked={forcedOffline}
      data-testid="button-toggle-offline"
      className={cn('press inline-flex min-h-[52px] items-center gap-2 rounded-full border-2 px-3 text-sm font-semibold', forcedOffline ? 'border-[hsl(var(--tier-amber))] bg-[hsl(var(--tier-amber)/.14)]' : 'border-border bg-card hover:bg-accent')}
    >
      {forcedOffline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
      {tr('Demo offline', 'डेमो ऑफ़लाइन')}
      <span aria-hidden className={cn('relative h-5 w-9 rounded-full transition-colors', forcedOffline ? 'bg-[hsl(var(--tier-amber))]' : 'bg-foreground/25')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-card transition-transform', forcedOffline ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </span>
    </button>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { openEmergency, setPrivacyOpen, syncError } = useApp();
  const { tr,lang } = useLang();
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="border-b-2 border-[hsl(var(--tier-amber))] bg-[hsl(var(--tier-amber)/.12)] px-4 py-2 text-center text-sm font-medium" data-testid="text-demo-notice">
        {tr('DEMO ONLY · invented records · not a medical diagnosis · ambulance drill is a simulation', 'सिर्फ़ डेमो · काल्पनिक रिकॉर्ड · यह डॉक्टर की जाँच नहीं · एम्बुलेंस सिर्फ अभ्यास है')}
      </div>
      <header className="sticky top-0 z-40 border-b-2 border-border bg-background/95 backdrop-blur" data-testid="header-main">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="flex min-h-[48px] items-center gap-3" data-testid="link-home">
            <span className="grid h-11 w-11 place-items-center rounded-xl border-2 border-[hsl(175_80%_16%)] bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
                <path d="M8.5 11.5h2l1-2 1.5 4 1-2h1.5" />
              </svg>
            </span>
            <span className="leading-tight">
              <span className="block text-xl font-extrabold text-primary">Notion360</span>
              <span className="text-xs font-semibold text-muted-foreground">{tr('Sonipat field check-up', 'सोनीपत · स्वास्थ्य जाँच')}</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <LangToggle />
            <Call108 compact className="hidden sm:inline-flex" testId="link-call-108-header" />
          </div>
        </div>
        <div className="border-t-2 border-border/70 bg-card/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2">
            <SyncBadge />
            <OfflineToggle />
            <button onClick={() => setPrivacyOpen(true)} data-testid="button-open-privacy" className="press inline-flex min-h-[52px] items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 text-sm font-semibold hover:bg-accent">
              <ShieldCheck className="h-4 w-4 text-[hsl(var(--tier-green))]" /> {tr('Privacy', 'गोपनीयता')}
            </button>
            <button onClick={() => openEmergency()} data-testid="button-open-emergency" className="press ml-auto inline-flex min-h-[52px] items-center gap-1.5 rounded-full border-2 border-dashed border-foreground/60 bg-card px-3 text-sm font-semibold hover:bg-accent">
              <Siren className="h-4 w-4" /> {tr('Practice drill', 'एम्बुलेंस अभ्यास')}
            </button>
          </div>
        </div>
      </header>
      <main>
        {syncError && <p role="status" className="mx-auto max-w-6xl px-4 pt-3 text-sm font-medium text-[hsl(26_80%_26%)]">{localizeMessage(syncError,lang)}</p>}
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-24 pt-16 text-sm text-muted-foreground sm:pb-10">
        <div className="phulkari mb-6 h-1" />
        {tr('Notion360 uses invented profiles and illustrative Sonipat locations. It does not diagnose, treat or dispatch. In any emergency, dial', 'Notion360 काल्पनिक प्रोफ़ाइल इस्तेमाल करता है। यह इलाज या एम्बुलेंस नहीं भेजता। किसी भी आपातकाल में डायल करें')}{' '}
        <a href="tel:108" data-testid="link-footer-108" className="font-bold text-[hsl(var(--tier-red))] underline">108</a>.
      </footer>
      {/* Mobile: real emergency always within thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-background/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:hidden">
        <Call108 className="w-full" testId="link-call-108-mobile" />
      </div>
      <EmergencySheet />
      <PrivacyDrawer />
    </div>
  );
}
